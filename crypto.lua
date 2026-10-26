-- =========================================================
--  CRYPTO : marche simule cote serveur (persistant)
-- =========================================================
local Market = {}   -- [coin] = { price, history = {}, cfg }
local CoinCfg = {}
for _, c in ipairs(Config.Crypto.Coins) do CoinCfg[c.id] = c end

local function randn()
    -- Box-Muller
    local u1, u2 = math.random(), math.random()
    return math.sqrt(-2 * math.log(u1 + 1e-9)) * math.cos(2 * math.pi * u2)
end

local function change24(m)
    local h = m.history
    if #h < 2 then return 0 end
    return OPhone.Round(((m.price - h[1]) / h[1]) * 100, 2)
end

local function snapshot()
    local out = {}
    for _, c in ipairs(Config.Crypto.Coins) do
        local m = Market[c.id]
        out[#out + 1] = { id = c.id, name = c.name, symbol = c.symbol, color = c.color, price = OPhone.Round(m.price, 2), change = change24(m), history = m.history }
    end
    return out
end

local function persist()
    for id, m in pairs(Market) do
        MySQL.update('INSERT INTO ophone_crypto_market (coin, price, history) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE price = VALUES(price), history = VALUES(history)', { id, m.price, json.encode(m.history) })
    end
end

local function tick()
    for id, m in pairs(Market) do
        local cfg = m.cfg
        -- marche aleatoire log-normale + rappel doux vers le prix de base
        local drift = (math.log(cfg.price) - math.log(m.price)) * 0.015
        local p = m.price * math.exp(drift + cfg.volatility * randn() * 0.35)
        m.price = OPhone.Clamp(p, cfg.min, cfg.max)
        m.history[#m.history + 1] = OPhone.Round(m.price, 2)
        while #m.history > Config.Crypto.HistorySize do table.remove(m.history, 1) end
    end
    persist()
    TriggerClientEvent('ophone:client:cryptoTick', -1, snapshot())
end

MySQL.ready(function()
    math.randomseed(os.time())
    local rows = MySQL.query.await('SELECT coin, price, history FROM ophone_crypto_market') or {}
    local saved = {}
    for _, r in ipairs(rows) do saved[r.coin] = r end
    for _, c in ipairs(Config.Crypto.Coins) do
        local s = saved[c.id]
        local hist = s and OPhone.Decode(s.history, nil) or nil
        if not hist or #hist == 0 then
            hist = {}
            local p = c.price
            for i = 1, Config.Crypto.HistorySize do
                p = OPhone.Clamp(p * math.exp(c.volatility * randn() * 0.35), c.min, c.max)
                hist[i] = OPhone.Round(p, 2)
            end
        end
        Market[c.id] = { price = s and tonumber(s.price) or hist[#hist], history = hist, cfg = c }
    end
    CreateThread(function()
        while true do
            Wait(Config.Crypto.TickInterval * 1000)
            tick()
        end
    end)
end)

local function wallet(cid)
    local rows = MySQL.query.await('SELECT coin, amount FROM ophone_crypto_wallets WHERE citizenid = ?', { cid }) or {}
    local w = {}
    for _, r in ipairs(rows) do w[r.coin] = tonumber(r.amount) end
    return w
end

local function addCoins(cid, coin, delta)
    MySQL.update.await('INSERT INTO ophone_crypto_wallets (citizenid, coin, amount) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE amount = amount + VALUES(amount)', { cid, coin, delta })
end

local function logTx(cid, coin, kind, amount, price)
    MySQL.insert('INSERT INTO ophone_crypto_transactions (citizenid, coin, type, amount, price) VALUES (?, ?, ?, ?, ?)', { cid, coin, kind, amount, price })
end

OPhone.Callback('crypto:data', function(src)
    local Player = OPhone.GetPlayer(src)
    if not Player then return { ok = false } end
    local cid = Player.PlayerData.citizenid
    local tx = MySQL.query.await('SELECT coin, type, amount, price, UNIX_TIMESTAMP(created_at) AS ts FROM ophone_crypto_transactions WHERE citizenid = ? ORDER BY id DESC LIMIT 30', { cid }) or {}
    return { ok = true, market = snapshot(), wallet = wallet(cid), bank = Player.PlayerData.money.bank, walletId = 'OBX-' .. cid, transactions = tx, fees = { buy = Config.Crypto.BuyFee, sell = Config.Crypto.SellFee } }
end)

OPhone.Callback('crypto:buy', function(src, data)
    local Player = OPhone.GetPlayer(src)
    local m = Market[tostring(data.coin)]
    if not Player or not m then return { ok = false } end
    if not OPhone.Throttle(src, 'crypto', 800) then return { ok = false, error = 'Trop rapide' } end
    local dollars = math.floor(tonumber(data.dollars) or 0)
    if dollars < 1 or dollars > 1000000 then return { ok = false, error = 'Montant invalide' } end
    local qty = OPhone.Round((dollars * (1 - Config.Crypto.BuyFee)) / m.price, 6)
    if qty <= 0 then return { ok = false, error = 'Montant trop faible' } end
    if not OPhone.Charge(Player, dollars, ('Achat %s %s'):format(qty, m.cfg.symbol)) then return { ok = false, error = 'Solde insuffisant' } end
    addCoins(Player.PlayerData.citizenid, m.cfg.id, qty)
    logTx(Player.PlayerData.citizenid, m.cfg.id, 'buy', qty, m.price)
    return { ok = true, qty = qty, wallet = wallet(Player.PlayerData.citizenid), bank = Player.PlayerData.money.bank }
end)

OPhone.Callback('crypto:sell', function(src, data)
    local Player = OPhone.GetPlayer(src)
    local m = Market[tostring(data.coin)]
    if not Player or not m then return { ok = false } end
    if not OPhone.Throttle(src, 'crypto', 800) then return { ok = false, error = 'Trop rapide' } end
    local qty = OPhone.Round(tonumber(data.qty) or 0, 6)
    local cid = Player.PlayerData.citizenid
    local have = wallet(cid)[m.cfg.id] or 0
    if qty <= 0 or qty > have + 1e-7 then return { ok = false, error = 'Quantite invalide' } end
    local dollars = math.floor(qty * m.price * (1 - Config.Crypto.SellFee))
    if dollars < 1 then return { ok = false, error = 'Montant trop faible' } end
    local affected = MySQL.update.await('UPDATE ophone_crypto_wallets SET amount = amount - ? WHERE citizenid = ? AND coin = ? AND amount >= ?', { qty, cid, m.cfg.id, qty - 1e-7 })
    if not affected or affected < 1 then return { ok = false, error = 'Quantite invalide' } end
    OPhone.Pay(Player, dollars, ('Vente %s %s'):format(qty, m.cfg.symbol))
    logTx(cid, m.cfg.id, 'sell', qty, m.price)
    return { ok = true, dollars = dollars, wallet = wallet(cid), bank = Player.PlayerData.money.bank }
end)

OPhone.Callback('crypto:transfer', function(src, data)
    local Player = OPhone.GetPlayer(src)
    local m = Market[tostring(data.coin)]
    if not Player or not m then return { ok = false } end
    if not OPhone.Throttle(src, 'crypto', 1500) then return { ok = false, error = 'Trop rapide' } end
    local qty = OPhone.Round(tonumber(data.qty) or 0, 6)
    if qty <= 0 then return { ok = false, error = 'Quantite invalide' } end
    local cid = Player.PlayerData.citizenid
    local to = tostring(data.to or ''):gsub('%s', ''):gsub('^OBX%-', ''):gsub('^obx%-', '')
    local Target = (to:match('^%d+$') and OPhone.QB.Functions.GetPlayerByPhone(to)) or OPhone.QB.Functions.GetPlayerByCitizenId(to:upper())
    local targetCid = Target and Target.PlayerData.citizenid or (MySQL.scalar.await('SELECT citizenid FROM players WHERE citizenid = ?', { to:upper() }))
    if not targetCid then return { ok = false, error = 'Portefeuille introuvable' } end
    if targetCid == cid then return { ok = false, error = 'Impossible vers toi-meme' } end
    local affected = MySQL.update.await('UPDATE ophone_crypto_wallets SET amount = amount - ? WHERE citizenid = ? AND coin = ? AND amount >= ?', { qty, cid, m.cfg.id, qty - 1e-7 })
    if not affected or affected < 1 then return { ok = false, error = 'Quantite invalide' } end
    addCoins(targetCid, m.cfg.id, qty)
    logTx(cid, m.cfg.id, 'send', qty, m.price)
    logTx(targetCid, m.cfg.id, 'receive', qty, m.price)
    if Target then OPhone.Notify(Target.PlayerData.source, { app = 'crypto', title = 'Crypto recue', body = ('+%s %s'):format(qty, m.cfg.symbol) }) end
    return { ok = true, wallet = wallet(cid) }
end)

-- Exports pour d'autres scripts (ex: braquages qui payent en crypto)
exports('AddCrypto', function(citizenid, coin, qty) if Market[coin] then addCoins(citizenid, coin, qty) return true end return false end)
exports('GetCryptoPrice', function(coin) return Market[coin] and Market[coin].price or nil end)
