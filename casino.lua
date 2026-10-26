-- =========================================================
--  CASINO EN LIGNE  - 100% autoritaire serveur (anti-triche)
--  Jeux : Slots, Roulette, Blackjack, Crash, Mines, Dice
-- =========================================================
local C = Config.Casino
local BJ, CrashGames, MinesGames = {}, {}, {}

local function validBet(src, bet)
    bet = math.floor(tonumber(bet) or 0)
    if bet < C.MinBet or bet > C.MaxBet then return nil, ('Mise entre %s%s et %s%s'):format(Config.Currency, C.MinBet, Config.Currency, C.MaxBet) end
    if not OPhone.Throttle(src, 'casino', C.Cooldown) then return nil, 'Doucement...' end
    return bet
end

local function history(Player, game, bet, payout)
    MySQL.insert('INSERT INTO ophone_casino_history (citizenid, name, game, bet, payout) VALUES (?, ?, ?, ?, ?)', {
        Player.PlayerData.citizenid, OPhone.GetName(Player), game, bet, payout,
    })
end

local function settle(Player, game, bet, payout)
    payout = math.floor(payout)
    if payout > 0 then OPhone.Pay(Player, payout, 'Casino - ' .. game .. ' (gain)') end
    history(Player, game, bet, payout)
    return Player.PlayerData.money[Config.MoneyAccount]
end

-- ------------------------------------------------- SLOTS
local slotPool, slotTotal = {}, 0
for _, s in ipairs(C.Slots.Symbols) do slotTotal = slotTotal + s.weight; slotPool[#slotPool + 1] = s end
local function pickSymbol()
    local r = math.random() * slotTotal
    for _, s in ipairs(slotPool) do
        r = r - s.weight
        if r <= 0 then return s end
    end
    return slotPool[1]
end

OPhone.Callback('casino:slots', function(src, data)
    local Player = OPhone.GetPlayer(src)
    local bet, err = validBet(src, data.bet)
    if not Player or not bet then return { ok = false, error = err } end
    if not OPhone.Charge(Player, bet, 'Casino - Slots (mise)') then return { ok = false, error = 'Solde insuffisant' } end
    local reels, line = {}, {}
    for i = 1, 3 do
        local mid = pickSymbol()
        line[i] = mid
        reels[i] = { pickSymbol().id, mid.id, pickSymbol().id }
    end
    local payout, win = 0, nil
    if line[1].id == line[2].id and line[2].id == line[3].id then
        payout, win = bet * line[1].pay3, 'triple'
    else
        local cherries = 0
        for i = 1, 3 do if line[i].id == 'cherry' then cherries = cherries + 1 end end
        if cherries == 2 then payout, win = bet * C.Slots.TwoCherries, 'cherries' end
    end
    local balance = settle(Player, 'Slots', bet, payout)
    return { ok = true, reels = reels, payout = payout, win = win, balance = balance }
end)

-- ------------------------------------------------- ROULETTE (europeenne)
local RED = {}
for _, n in ipairs({ 1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36 }) do RED[n] = true end

local function rouletteWins(bet, n)
    local t, v = bet.type, tonumber(bet.value)
    if t == 'number' then return n == v and 36 or 0 end
    if n == 0 then return 0 end
    if t == 'red' then return RED[n] and 2 or 0 end
    if t == 'black' then return (not RED[n]) and 2 or 0 end
    if t == 'odd' then return n % 2 == 1 and 2 or 0 end
    if t == 'even' then return n % 2 == 0 and 2 or 0 end
    if t == 'low' then return n <= 18 and 2 or 0 end
    if t == 'high' then return n >= 19 and 2 or 0 end
    if t == 'dozen' and v then return math.ceil(n / 12) == v and 3 or 0 end
    if t == 'column' and v then return ((n - 1) % 3) + 1 == v and 3 or 0 end
    return 0
end

OPhone.Callback('casino:roulette', function(src, data)
    local Player = OPhone.GetPlayer(src)
    if not Player or type(data.bets) ~= 'table' or #data.bets == 0 or #data.bets > 40 then return { ok = false, error = 'Place une mise' } end
    local total, bets = 0, {}
    local validTypes = { number = true, red = true, black = true, odd = true, even = true, low = true, high = true, dozen = true, column = true }
    for _, b in ipairs(data.bets) do
        local amt = math.floor(tonumber(b.amount) or 0)
        if not validTypes[b.type] or amt <= 0 then return { ok = false, error = 'Mise invalide' } end
        if b.type == 'number' and ((tonumber(b.value) or -1) < 0 or (tonumber(b.value) or 99) > 36) then return { ok = false, error = 'Mise invalide' } end
        total = total + amt
        bets[#bets + 1] = { type = b.type, value = b.value, amount = amt }
    end
    local bet, err = validBet(src, total)
    if not bet then return { ok = false, error = err } end
    if not OPhone.Charge(Player, total, 'Casino - Roulette (mise)') then return { ok = false, error = 'Solde insuffisant' } end
    local n = math.random(0, 36)
    local payout = 0
    for _, b in ipairs(bets) do payout = payout + b.amount * rouletteWins(b, n) end
    local balance = settle(Player, 'Roulette', total, payout)
    return { ok = true, number = n, color = n == 0 and 'green' or (RED[n] and 'red' or 'black'), payout = payout, balance = balance }
end)

-- ------------------------------------------------- BLACKJACK
local SUITS, RANKS = { 'S', 'H', 'D', 'C' }, { 'A','2','3','4','5','6','7','8','9','10','J','Q','K' }
local function newDeck()
    local d = {}
    for _ = 1, 4 do for _, s in ipairs(SUITS) do for _, r in ipairs(RANKS) do d[#d + 1] = { r = r, s = s } end end end
    for i = #d, 2, -1 do local j = math.random(i); d[i], d[j] = d[j], d[i] end
    return d
end
local function handValue(h)
    local total, aces = 0, 0
    for _, c in ipairs(h) do
        if c.r == 'A' then total, aces = total + 11, aces + 1
        elseif c.r == 'K' or c.r == 'Q' or c.r == 'J' then total = total + 10
        else total = total + tonumber(c.r) end
    end
    while total > 21 and aces > 0 do total, aces = total - 10, aces - 1 end
    return total
end
local function bjView(g, reveal)
    local dealer = reveal and g.dealer or { g.dealer[1], { r = '?', s = '?' } }
    return {
        ok = true, player = g.player, dealer = dealer, bet = g.bet, done = g.done,
        playerValue = handValue(g.player), dealerValue = reveal and handValue(g.dealer) or handValue({ g.dealer[1] }),
        result = g.result, payout = g.payout, canDouble = #g.player == 2 and not g.done, balance = g.balance,
    }
end
local function bjFinish(src, Player, g, result, mult)
    g.done, g.result = true, result
    g.payout = math.floor(g.bet * mult)
    g.balance = settle(Player, 'Blackjack', g.bet, g.payout)
    BJ[src] = nil
    return bjView(g, true)
end
local function dealerPlay(src, Player, g)
    while handValue(g.dealer) < 17 do g.dealer[#g.dealer + 1] = table.remove(g.deck) end
    local p, d = handValue(g.player), handValue(g.dealer)
    if d > 21 or p > d then return bjFinish(src, Player, g, 'win', 2) end
    if p == d then return bjFinish(src, Player, g, 'push', 1) end
    return bjFinish(src, Player, g, 'lose', 0)
end

OPhone.Callback('casino:bj', function(src, data)
    local Player = OPhone.GetPlayer(src)
    if not Player then return { ok = false } end
    local action = data.action
    local g = BJ[src]
    if action == 'deal' then
        if g then return bjView(g, false) end
        local bet, err = validBet(src, data.bet)
        if not bet then return { ok = false, error = err } end
        if not OPhone.Charge(Player, bet, 'Casino - Blackjack (mise)') then return { ok = false, error = 'Solde insuffisant' } end
        local deck = newDeck()
        g = { deck = deck, bet = bet, player = { table.remove(deck), table.remove(deck) }, dealer = { table.remove(deck), table.remove(deck) } }
        BJ[src] = g
        local p, d = handValue(g.player), handValue(g.dealer)
        if p == 21 and d == 21 then return bjFinish(src, Player, g, 'push', 1) end
        if p == 21 then return bjFinish(src, Player, g, 'blackjack', 2.5) end
        if d == 21 then return bjFinish(src, Player, g, 'lose', 0) end
        return bjView(g, false)
    end
    if not g then return { ok = false, error = 'Aucune partie' } end
    if action == 'hit' then
        g.player[#g.player + 1] = table.remove(g.deck)
        local v = handValue(g.player)
        if v > 21 then return bjFinish(src, Player, g, 'bust', 0) end
        if v == 21 then return dealerPlay(src, Player, g) end
        return bjView(g, false)
    elseif action == 'stand' then
        return dealerPlay(src, Player, g)
    elseif action == 'double' then
        if #g.player ~= 2 then return { ok = false, error = 'Impossible' } end
        if not OPhone.Charge(Player, g.bet, 'Casino - Blackjack (double)') then return { ok = false, error = 'Solde insuffisant' } end
        g.bet = g.bet * 2
        g.player[#g.player + 1] = table.remove(g.deck)
        if handValue(g.player) > 21 then return bjFinish(src, Player, g, 'bust', 0) end
        return dealerPlay(src, Player, g)
    end
    return { ok = false }
end)

-- ------------------------------------------------- CRASH
local function crashMultiplier(ms) return math.exp(C.Crash.Growth * (ms / 1000)) end

OPhone.Callback('casino:crashStart', function(src, data)
    local Player = OPhone.GetPlayer(src)
    if not Player then return { ok = false } end
    if CrashGames[src] then return { ok = false, error = 'Partie en cours' } end
    local bet, err = validBet(src, data.bet)
    if not bet then return { ok = false, error = err } end
    if not OPhone.Charge(Player, bet, 'Casino - Crash (mise)') then return { ok = false, error = 'Solde insuffisant' } end
    local r = math.random()
    local point = math.floor(((1 - C.Crash.HouseEdge) / (1 - r)) * 100) / 100
    point = OPhone.Clamp(point, 1.0, C.Crash.MaxMultiplier)
    local auto = tonumber(data.auto)
    if auto and auto < 1.01 then auto = nil end
    local game = { bet = bet, point = point, start = GetGameTimer(), auto = auto }
    CrashGames[src] = game
    local crashAt = math.log(point) / C.Crash.Growth * 1000

    if auto and auto < point then
        SetTimeout(math.floor(math.log(auto) / C.Crash.Growth * 1000), function()
            if CrashGames[src] ~= game then return end
            CrashGames[src] = nil
            local P = OPhone.GetPlayer(src)
            if not P then return end
            local payout = math.floor(bet * auto)
            local bal = settle(P, 'Crash', bet, payout)
            TriggerClientEvent('ophone:client:casinoCrash', src, { cashed = true, multiplier = auto, payout = payout, point = point, balance = bal })
        end)
    end
    SetTimeout(math.floor(crashAt), function()
        if CrashGames[src] ~= game then
            TriggerClientEvent('ophone:client:casinoCrash', src, { reveal = true, point = point })
            return
        end
        CrashGames[src] = nil
        local P = OPhone.GetPlayer(src)
        if P then history(P, 'Crash', bet, 0) end
        TriggerClientEvent('ophone:client:casinoCrash', src, { crashed = true, point = point, balance = P and P.PlayerData.money[Config.MoneyAccount] })
    end)
    return { ok = true, growth = C.Crash.Growth, balance = Player.PlayerData.money[Config.MoneyAccount] }
end)

OPhone.Callback('casino:crashCashout', function(src)
    local Player = OPhone.GetPlayer(src)
    local g = CrashGames[src]
    if not Player or not g then return { ok = false, error = 'Trop tard !' } end
    local m = math.floor(crashMultiplier(GetGameTimer() - g.start) * 100) / 100
    if m >= g.point then return { ok = false, error = 'Crash !' } end
    CrashGames[src] = nil
    local payout = math.floor(g.bet * m)
    local bal = settle(Player, 'Crash', g.bet, payout)
    return { ok = true, multiplier = m, payout = payout, balance = bal }
end)

-- ------------------------------------------------- MINES
local function minesMultiplier(mines, picks)
    local n, m = C.Mines.Size, 1.0
    for i = 0, picks - 1 do m = m * (n - i) / (n - mines - i) end
    return OPhone.Round(m * (1 - C.Mines.HouseEdge), 2)
end

OPhone.Callback('casino:mines', function(src, data)
    local Player = OPhone.GetPlayer(src)
    if not Player then return { ok = false } end
    local g = MinesGames[src]
    if data.action == 'start' then
        if g then return { ok = false, error = 'Partie en cours' } end
        local mines = math.floor(tonumber(data.mines) or 3)
        if mines < 1 or mines > 24 then return { ok = false, error = 'Nombre de mines invalide' } end
        local bet, err = validBet(src, data.bet)
        if not bet then return { ok = false, error = err } end
        if not OPhone.Charge(Player, bet, 'Casino - Mines (mise)') then return { ok = false, error = 'Solde insuffisant' } end
        local cells = {}
        for i = 1, C.Mines.Size do cells[i] = i end
        for i = #cells, 2, -1 do local j = math.random(i); cells[i], cells[j] = cells[j], cells[i] end
        local set = {}
        for i = 1, mines do set[cells[i]] = true end
        MinesGames[src] = { bet = bet, mines = mines, set = set, revealed = {}, picks = 0 }
        return { ok = true, multiplier = 1.0, next = minesMultiplier(mines, 1), balance = Player.PlayerData.money[Config.MoneyAccount] }
    end
    if not g then return { ok = false, error = 'Aucune partie' } end
    local function minesList()
        local l = {}
        for k in pairs(g.set) do l[#l + 1] = k end
        return l
    end
    if data.action == 'reveal' then
        local idx = math.floor(tonumber(data.index) or 0)
        if idx < 1 or idx > C.Mines.Size or g.revealed[idx] then return { ok = false } end
        g.revealed[idx] = true
        if g.set[idx] then
            MinesGames[src] = nil
            history(Player, 'Mines', g.bet, 0)
            return { ok = true, boom = true, index = idx, mines = minesList(), balance = Player.PlayerData.money[Config.MoneyAccount] }
        end
        g.picks = g.picks + 1
        local mult = minesMultiplier(g.mines, g.picks)
        if g.picks >= C.Mines.Size - g.mines then
            MinesGames[src] = nil
            local payout = math.floor(g.bet * mult)
            local bal = settle(Player, 'Mines', g.bet, payout)
            return { ok = true, index = idx, multiplier = mult, cleared = true, payout = payout, mines = minesList(), balance = bal }
        end
        return { ok = true, index = idx, multiplier = mult, next = minesMultiplier(g.mines, g.picks + 1) }
    elseif data.action == 'cashout' then
        if g.picks == 0 then return { ok = false, error = 'Revele au moins une case' } end
        MinesGames[src] = nil
        local mult = minesMultiplier(g.mines, g.picks)
        local payout = math.floor(g.bet * mult)
        local bal = settle(Player, 'Mines', g.bet, payout)
        return { ok = true, cashed = true, multiplier = mult, payout = payout, mines = minesList(), balance = bal }
    end
    return { ok = false }
end)

-- ------------------------------------------------- DICE
OPhone.Callback('casino:dice', function(src, data)
    local Player = OPhone.GetPlayer(src)
    if not Player then return { ok = false } end
    local target = math.floor(tonumber(data.target) or 50)
    if target < 2 or target > 98 then return { ok = false, error = 'Cible invalide' } end
    local bet, err = validBet(src, data.bet)
    if not bet then return { ok = false, error = err } end
    local over = data.over == true
    local chance = over and (100 - target) / 100 or target / 100
    local mult = OPhone.Round((1 - C.Dice.HouseEdge) / chance, 4)
    if not OPhone.Charge(Player, bet, 'Casino - Dice (mise)') then return { ok = false, error = 'Solde insuffisant' } end
    local roll = math.random(0, 9999) / 100
    local win = (over and roll > target) or (not over and roll < target)
    local payout = win and math.floor(bet * mult) or 0
    local bal = settle(Player, 'Dice', bet, payout)
    return { ok = true, roll = roll, win = win, multiplier = mult, payout = payout, balance = bal }
end)

-- ------------------------------------------------- LOBBY
OPhone.Callback('casino:lobby', function(src)
    local Player = OPhone.GetPlayer(src)
    if not Player then return { ok = false } end
    local top = MySQL.query.await([[
        SELECT name, game, bet, payout, UNIX_TIMESTAMP(created_at) AS ts FROM ophone_casino_history
        WHERE payout > bet AND created_at > (NOW() - INTERVAL 7 DAY) ORDER BY (payout - bet) DESC LIMIT 10
    ]]) or {}
    local mine = MySQL.query.await('SELECT game, bet, payout, UNIX_TIMESTAMP(created_at) AS ts FROM ophone_casino_history WHERE citizenid = ? ORDER BY id DESC LIMIT 20', { Player.PlayerData.citizenid }) or {}
    local stats = MySQL.single.await('SELECT COUNT(*) AS games, COALESCE(SUM(payout - bet),0) AS net FROM ophone_casino_history WHERE citizenid = ?', { Player.PlayerData.citizenid }) or {}
    return { ok = true, balance = Player.PlayerData.money[Config.MoneyAccount], top = top, history = mine, stats = stats }
end)

AddEventHandler('ophone:server:dropped', function(src)
    -- les mises en cours sont perdues (comme un vrai casino en ligne qui coupe)
    BJ[src], CrashGames[src], MinesGames[src] = nil, nil, nil
end)
