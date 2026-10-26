local QBCore = exports['qb-core']:GetCoreObject()
OPhone.QB = QBCore

OPhone.Airplane = {}     -- [src] = true
OPhone.Throttles = {}    -- [src] = { key = time }

-- =========================================================
--  HELPERS
-- =========================================================
function OPhone.Callback(name, fn)
    QBCore.Functions.CreateCallback('ophone:' .. name, function(source, cb, data)
        local ok, res = pcall(fn, source, type(data) == 'table' and data or {}, data)
        if not ok then
            print(('^1[obsidian_phone] erreur callback %s : %s^7'):format(name, res))
            return cb({ ok = false, error = 'Erreur serveur' })
        end
        cb(res == nil and { ok = true } or res)
    end)
end

function OPhone.Throttle(src, key, ms)
    local now = GetGameTimer()
    OPhone.Throttles[src] = OPhone.Throttles[src] or {}
    local last = OPhone.Throttles[src][key]
    if last and now - last < ms then return false end
    OPhone.Throttles[src][key] = now
    return true
end

function OPhone.GetPlayer(src)
    return QBCore.Functions.GetPlayer(src)
end

function OPhone.GetNumber(Player)
    return Player and Player.PlayerData.charinfo and tostring(Player.PlayerData.charinfo.phone) or nil
end

function OPhone.GetName(Player)
    local c = Player.PlayerData.charinfo
    return ('%s %s'):format(c.firstname or '', c.lastname or '')
end

function OPhone.GetSourceByNumber(number)
    if not number then return nil end
    local Player = QBCore.Functions.GetPlayerByPhone(tostring(number))
    return Player and Player.PlayerData.source or nil
end

function OPhone.HasPhone(src)
    if not Config.RequireItem then return true end
    local Player = OPhone.GetPlayer(src)
    if not Player then return false end
    local item = Player.Functions.GetItemByName(Config.PhoneItem)
    return item ~= nil and (item.amount or item.count or 1) > 0
end

-- Une source peut-elle recevoir quelque chose ? (item + mode avion)
function OPhone.IsReachable(src)
    if not src then return false end
    if OPhone.Airplane[src] then return false end
    return OPhone.HasPhone(src)
end

function OPhone.Notify(src, data)
    if not src or OPhone.Airplane[src] then return end
    TriggerClientEvent('ophone:client:notify', src, data)
end

function OPhone.NotifyNumber(number, data)
    local src = OPhone.GetSourceByNumber(number)
    if src then OPhone.Notify(src, data) end
end

function OPhone.ContactName(citizenid, number)
    local row = MySQL.single.await('SELECT name FROM ophone_contacts WHERE citizenid = ? AND number = ? LIMIT 1', { citizenid, number })
    return row and row.name or number
end

local function decode(str, default)
    if not str or str == '' then return default end
    local ok, res = pcall(json.decode, str)
    return ok and res or default
end
OPhone.Decode = decode

-- =========================================================
--  BOOT
-- =========================================================
local function defaultApps()
    local list = {}
    for _, app in ipairs(Config.Apps) do
        if app.core or app.default then list[#list + 1] = app.id end
    end
    return list
end

local function loadProfile(Player)
    local cid = Player.PlayerData.citizenid
    local row = MySQL.single.await('SELECT * FROM ophone_settings WHERE citizenid = ?', { cid })
    if not row then
        local apps = defaultApps()
        MySQL.insert.await('INSERT INTO ophone_settings (citizenid, settings, apps, setup_done) VALUES (?, ?, ?, 0)', { cid, '{}', json.encode(apps) })
        return { settings = {}, apps = apps, setupDone = false }
    end
    local apps = decode(row.apps, defaultApps())
    -- les apps "core" sont toujours presentes
    local has = {}
    for _, id in ipairs(apps) do has[id] = true end
    for _, app in ipairs(Config.Apps) do
        if app.core and not has[app.id] then apps[#apps + 1] = app.id end
    end
    return { settings = decode(row.settings, {}), apps = apps, setupDone = row.setup_done == 1 }
end

OPhone.Callback('boot', function(src)
    local Player = OPhone.GetPlayer(src)
    if not Player then return { ok = false } end
    local profile = loadProfile(Player)
    local cid = Player.PlayerData.citizenid
    local number = OPhone.GetNumber(Player)
    OPhone.Airplane[src] = profile.settings.airplane == true or nil

    local filters, coins, catalog = {}, {}, {}
    for _, f in ipairs(Config.Camera.Filters) do filters[#filters + 1] = { id = f.id, label = f.label } end
    for _, c in ipairs(Config.Crypto.Coins) do coins[#coins + 1] = { id = c.id, name = c.name, symbol = c.symbol, color = c.color } end
    for _, a in ipairs(Config.Apps) do catalog[#catalog + 1] = { id = a.id, core = a.core == true } end

    local unread = MySQL.scalar.await('SELECT COALESCE(SUM(unread),0) FROM ophone_conversation_members WHERE number = ? AND hidden = 0', { number }) or 0
    local missed = MySQL.scalar.await("SELECT COUNT(*) FROM ophone_calls WHERE receiver = ? AND status = 'missed' AND created_at > (NOW() - INTERVAL 1 DAY)", { number }) or 0

    return {
        ok = true,
        me = {
            citizenid = cid,
            number = number,
            name = OPhone.GetName(Player),
            firstname = Player.PlayerData.charinfo.firstname,
            job = { name = Player.PlayerData.job.name, label = Player.PlayerData.job.label, grade = Player.PlayerData.job.grade and Player.PlayerData.job.grade.name or '' },
        },
        settings = profile.settings,
        apps = profile.apps,
        setupDone = profile.setupDone,
        badges = { messages = tonumber(unread) or 0, phone = tonumber(missed) or 0 },
        config = {
            currency = Config.Currency,
            filters = filters,
            zooms = Config.Camera.Zooms,
            coins = coins,
            catalog = catalog,
            casino = { min = Config.Casino.MinBet, max = Config.Casino.MaxBet },
            emergency = (function()
                local t = {}
                for num, e in pairs(Config.EmergencyNumbers) do t[num] = e.label end
                return t
            end)(),
            video = Config.VideoCall.Enabled,
        },
    }
end)

-- =========================================================
--  REGLAGES / CONFIGURATION / APPS
-- =========================================================
OPhone.Callback('saveSettings', function(src, data)
    local Player = OPhone.GetPlayer(src)
    if not Player then return { ok = false } end
    local encoded = json.encode(data.settings or {})
    if #encoded > 12000 then return { ok = false, error = 'Reglages trop volumineux' } end
    OPhone.Airplane[src] = (data.settings and data.settings.airplane == true) or nil
    MySQL.update.await('UPDATE ophone_settings SET settings = ?, setup_done = IF(?, 1, setup_done) WHERE citizenid = ?', { encoded, data.setupDone == true, Player.PlayerData.citizenid })
    return { ok = true }
end)

OPhone.Callback('setAirplane', function(src, data)
    OPhone.Airplane[src] = data.enabled == true or nil
    return { ok = true }
end)

OPhone.Callback('setApps', function(src, data)
    local Player = OPhone.GetPlayer(src)
    if not Player or type(data.apps) ~= 'table' then return { ok = false } end
    local valid, out, seen = {}, {}, {}
    for _, a in ipairs(Config.Apps) do valid[a.id] = a end
    for _, id in ipairs(data.apps) do
        if type(id) == 'string' and valid[id] and not seen[id] then out[#out + 1] = id; seen[id] = true end
    end
    for _, a in ipairs(Config.Apps) do
        if a.core and not seen[a.id] then out[#out + 1] = a.id end
    end
    MySQL.update.await('UPDATE ophone_settings SET apps = ? WHERE citizenid = ?', { json.encode(out), Player.PlayerData.citizenid })
    return { ok = true, apps = out }
end)

OPhone.Callback('factoryReset', function(src)
    local Player = OPhone.GetPlayer(src)
    if not Player then return { ok = false } end
    MySQL.update.await('UPDATE ophone_settings SET settings = ?, apps = ?, setup_done = 0 WHERE citizenid = ?', { '{}', json.encode(defaultApps()), Player.PlayerData.citizenid })
    OPhone.Airplane[src] = nil
    return { ok = true }
end)

-- =========================================================
--  CONTACTS
-- =========================================================
OPhone.Callback('contacts:list', function(src)
    local Player = OPhone.GetPlayer(src)
    if not Player then return {} end
    return MySQL.query.await('SELECT id, name, number, avatar, favorite FROM ophone_contacts WHERE citizenid = ? ORDER BY name ASC', { Player.PlayerData.citizenid }) or {}
end)

OPhone.Callback('contacts:save', function(src, data)
    local Player = OPhone.GetPlayer(src)
    if not Player then return { ok = false } end
    local name = OPhone.SanitizeText(data.name, 60)
    local number = OPhone.SanitizeNumber(data.number)
    if name == '' or not number then return { ok = false, error = 'Nom ou numero invalide' } end
    local avatar = (type(data.avatar) == 'string' and data.avatar:match('^https://')) and data.avatar:sub(1, 255) or nil
    local cid = Player.PlayerData.citizenid
    if data.id then
        MySQL.update.await('UPDATE ophone_contacts SET name = ?, number = ?, avatar = ?, favorite = ? WHERE id = ? AND citizenid = ?', { name, number, avatar, data.favorite and 1 or 0, tonumber(data.id), cid })
    else
        local count = MySQL.scalar.await('SELECT COUNT(*) FROM ophone_contacts WHERE citizenid = ?', { cid }) or 0
        if count >= 300 then return { ok = false, error = 'Limite de contacts atteinte' } end
        data.id = MySQL.insert.await('INSERT INTO ophone_contacts (citizenid, name, number, avatar, favorite) VALUES (?, ?, ?, ?, ?)', { cid, name, number, avatar, data.favorite and 1 or 0 })
    end
    return { ok = true, id = data.id }
end)

OPhone.Callback('contacts:delete', function(src, data)
    local Player = OPhone.GetPlayer(src)
    if not Player then return { ok = false } end
    MySQL.update.await('DELETE FROM ophone_contacts WHERE id = ? AND citizenid = ?', { tonumber(data.id), Player.PlayerData.citizenid })
    return { ok = true }
end)

-- Partager son contact au joueur le plus proche (cible calculee cote client, verifiee ici)
OPhone.Callback('contacts:share', function(src, data)
    local Player = OPhone.GetPlayer(src)
    local target = tonumber(data.target)
    if not Player or not target or not OPhone.GetPlayer(target) then return { ok = false, error = 'Personne a proximite' } end
    local a, b = GetEntityCoords(GetPlayerPed(src)), GetEntityCoords(GetPlayerPed(target))
    if #(a - b) > 5.0 then return { ok = false, error = 'Trop loin' } end
    if not OPhone.IsReachable(target) then return { ok = false, error = 'Son telephone ne repond pas' } end
    TriggerClientEvent('ophone:client:contactOffer', target, { name = OPhone.GetName(Player), number = OPhone.GetNumber(Player) })
    return { ok = true }
end)

-- =========================================================
--  GALERIE
-- =========================================================
OPhone.Callback('gallery:list', function(src)
    local Player = OPhone.GetPlayer(src)
    if not Player then return {} end
    return MySQL.query.await('SELECT id, url, UNIX_TIMESTAMP(created_at) AS ts FROM ophone_gallery WHERE citizenid = ? ORDER BY id DESC LIMIT 300', { Player.PlayerData.citizenid }) or {}
end)

OPhone.Callback('gallery:add', function(src, data)
    local Player = OPhone.GetPlayer(src)
    if not Player or type(data.url) ~= 'string' or not data.url:match('^https://') then return { ok = false } end
    local id = MySQL.insert.await('INSERT INTO ophone_gallery (citizenid, url) VALUES (?, ?)', { Player.PlayerData.citizenid, data.url:sub(1, 512) })
    return { ok = true, id = id }
end)

OPhone.Callback('gallery:delete', function(src, data)
    local Player = OPhone.GetPlayer(src)
    if not Player then return { ok = false } end
    MySQL.update.await('DELETE FROM ophone_gallery WHERE id = ? AND citizenid = ?', { tonumber(data.id), Player.PlayerData.citizenid })
    return { ok = true }
end)

-- Donne la config d'upload au client uniquement au moment de prendre la photo
OPhone.Callback('camera:uploadConfig', function(src)
    if not OPhone.Throttle(src, 'upload', 1500) then return { ok = false, error = 'Doucement' } end
    return { ok = true, url = Config.Upload.url, field = Config.Upload.field, headers = Config.Upload.headers, encoding = Config.Upload.encoding, quality = Config.Upload.quality, provider = Config.Upload.provider }
end)

-- =========================================================
--  NOTES
-- =========================================================
OPhone.Callback('notes:list', function(src)
    local Player = OPhone.GetPlayer(src)
    if not Player then return {} end
    return MySQL.query.await('SELECT id, title, content, color, UNIX_TIMESTAMP(updated_at) AS ts FROM ophone_notes WHERE citizenid = ? ORDER BY updated_at DESC', { Player.PlayerData.citizenid }) or {}
end)

OPhone.Callback('notes:save', function(src, data)
    local Player = OPhone.GetPlayer(src)
    if not Player then return { ok = false } end
    local title = OPhone.SanitizeText(data.title, 80)
    if title == '' then title = 'Sans titre' end
    local content = type(data.content) == 'string' and data.content:sub(1, 5000) or ''
    local color = type(data.color) == 'string' and data.color:match('^#%x%x%x%x%x%x$') or nil
    local cid = Player.PlayerData.citizenid
    if data.id then
        MySQL.update.await('UPDATE ophone_notes SET title = ?, content = ?, color = ? WHERE id = ? AND citizenid = ?', { title, content, color, tonumber(data.id), cid })
        return { ok = true, id = data.id }
    end
    local id = MySQL.insert.await('INSERT INTO ophone_notes (citizenid, title, content, color) VALUES (?, ?, ?, ?)', { cid, title, content, color })
    return { ok = true, id = id }
end)

OPhone.Callback('notes:delete', function(src, data)
    local Player = OPhone.GetPlayer(src)
    if not Player then return { ok = false } end
    MySQL.update.await('DELETE FROM ophone_notes WHERE id = ? AND citizenid = ?', { tonumber(data.id), Player.PlayerData.citizenid })
    return { ok = true }
end)

-- =========================================================
--  SERVICES (metiers en service)
-- =========================================================
OPhone.Callback('services:list', function()
    local counts = {}
    for _, Player in pairs(QBCore.Functions.GetQBPlayers()) do
        local job = Player.PlayerData.job
        if job and job.onduty then counts[job.name] = (counts[job.name] or 0) + 1 end
    end
    local out = {}
    for _, s in ipairs(Config.Services) do
        out[#out + 1] = { job = s.job, label = s.label, icon = s.icon, color = s.color, online = counts[s.job] or 0 }
    end
    return out
end)

OPhone.Callback('services:message', function(src, data)
    local Player = OPhone.GetPlayer(src)
    if not Player then return { ok = false } end
    if not OPhone.Throttle(src, 'service', 15000) then return { ok = false, error = 'Attends un peu avant de renvoyer' } end
    local job, msg = tostring(data.job or ''), OPhone.SanitizeText(data.message, 300)
    if msg == '' then return { ok = false, error = 'Message vide' } end
    local coords = GetEntityCoords(GetPlayerPed(src))
    local sent = 0
    for _, P in pairs(QBCore.Functions.GetQBPlayers()) do
        if P.PlayerData.job.name == job and P.PlayerData.job.onduty and OPhone.IsReachable(P.PlayerData.source) then
            sent = sent + 1
            TriggerClientEvent('ophone:client:serviceAlert', P.PlayerData.source, {
                from = OPhone.GetName(Player), number = OPhone.GetNumber(Player), message = msg,
                coords = { x = coords.x, y = coords.y, z = coords.z }, anonymous = data.anonymous == true,
            })
        end
    end
    if sent == 0 then return { ok = false, error = 'Personne en service' } end
    return { ok = true, sent = sent }
end)

-- =========================================================
--  ITEM / NETTOYAGE
-- =========================================================
CreateThread(function()
    if Config.RequireItem then
        QBCore.Functions.CreateUseableItem(Config.PhoneItem, function(source)
            TriggerClientEvent('ophone:client:toggle', source)
        end)
    end
end)

QBCore.Functions.CreateCallback('ophone:hasPhone', function(source, cb)
    cb(OPhone.HasPhone(source))
end)

AddEventHandler('playerDropped', function()
    local src = source
    OPhone.Airplane[src] = nil
    OPhone.Throttles[src] = nil
    TriggerEvent('ophone:server:dropped', src)
end)

-- Exports utiles pour d'autres scripts
exports('Notify', function(src, title, body, app) OPhone.Notify(src, { app = app or 'system', title = title, body = body }) end)
exports('NotifyNumber', function(number, title, body, app) OPhone.NotifyNumber(number, { app = app or 'system', title = title, body = body }) end)
