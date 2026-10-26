-- =========================================================
--  PULSE (reseau social) + ANNONCES
-- =========================================================
local function handleOf(Player)
    local c = Player.PlayerData.charinfo
    local first = ((c.firstname or 'user'):lower():gsub('[^%w]', ''))
    local last = ((c.lastname or ''):sub(1, 1):lower())
    return '@' .. first .. last
end

OPhone.Callback('pulse:feed', function(src)
    local Player = OPhone.GetPlayer(src)
    if not Player then return {} end
    local cid = Player.PlayerData.citizenid
    local rows = MySQL.query.await('SELECT id, citizenid, author, handle, content, image, likes, UNIX_TIMESTAMP(created_at) AS ts FROM ophone_pulse_posts ORDER BY id DESC LIMIT 60') or {}
    for _, r in ipairs(rows) do
        local likes = OPhone.Decode(r.likes, {})
        r.likeCount = #likes
        r.liked = false
        for _, l in ipairs(likes) do if l == cid then r.liked = true end end
        r.mine = r.citizenid == cid
        r.likes, r.citizenid = nil, nil
    end
    return rows
end)

OPhone.Callback('pulse:post', function(src, data)
    local Player = OPhone.GetPlayer(src)
    if not Player then return { ok = false } end
    if not OPhone.Throttle(src, 'pulse', 10000) then return { ok = false, error = 'Attends 10s entre deux posts' } end
    local content = OPhone.SanitizeText(data.content, 280)
    if content == '' then return { ok = false, error = 'Post vide' } end
    local image = type(data.image) == 'string' and data.image:match('^https://') and data.image:sub(1, 512) or nil
    local author = OPhone.GetName(Player)
    local id = MySQL.insert.await('INSERT INTO ophone_pulse_posts (citizenid, author, handle, content, image, likes) VALUES (?, ?, ?, ?, ?, ?)', {
        Player.PlayerData.citizenid, author, handleOf(Player), content, image, '[]',
    })
    for _, P in pairs(OPhone.QB.Functions.GetQBPlayers()) do
        if P.PlayerData.source ~= src then
            TriggerClientEvent('ophone:client:pulse', P.PlayerData.source, { app = 'pulse', title = author, body = content:sub(1, 90), silent = true })
        end
    end
    return { ok = true, id = id }
end)

OPhone.Callback('pulse:like', function(src, data)
    local Player = OPhone.GetPlayer(src)
    if not Player then return { ok = false } end
    local row = MySQL.single.await('SELECT likes FROM ophone_pulse_posts WHERE id = ?', { tonumber(data.id) })
    if not row then return { ok = false } end
    local likes, cid, out, found = OPhone.Decode(row.likes, {}), Player.PlayerData.citizenid, {}, false
    for _, l in ipairs(likes) do if l == cid then found = true else out[#out + 1] = l end end
    if not found then out[#out + 1] = cid end
    MySQL.update.await('UPDATE ophone_pulse_posts SET likes = ? WHERE id = ?', { json.encode(out), tonumber(data.id) })
    return { ok = true, liked = not found, count = #out }
end)

OPhone.Callback('pulse:delete', function(src, data)
    local Player = OPhone.GetPlayer(src)
    if not Player then return { ok = false } end
    MySQL.update.await('DELETE FROM ophone_pulse_posts WHERE id = ? AND citizenid = ?', { tonumber(data.id), Player.PlayerData.citizenid })
    return { ok = true }
end)

OPhone.Callback('ads:list', function(src)
    local Player = OPhone.GetPlayer(src)
    if not Player then return {} end
    local rows = MySQL.query.await('SELECT id, citizenid, author, number, title, content, price, image, UNIX_TIMESTAMP(created_at) AS ts FROM ophone_ads ORDER BY id DESC LIMIT 60') or {}
    for _, r in ipairs(rows) do r.mine = r.citizenid == Player.PlayerData.citizenid; r.citizenid = nil end
    return rows
end)

OPhone.Callback('ads:post', function(src, data)
    local Player = OPhone.GetPlayer(src)
    if not Player then return { ok = false } end
    if not OPhone.Throttle(src, 'ads', 30000) then return { ok = false, error = 'Une annonce toutes les 30s' } end
    local title, content = OPhone.SanitizeText(data.title, 80), OPhone.SanitizeText(data.content, 400)
    if title == '' or content == '' then return { ok = false, error = 'Titre et texte requis' } end
    local price = tonumber(data.price)
    price = price and math.floor(OPhone.Clamp(price, 0, 100000000)) or nil
    local image = type(data.image) == 'string' and data.image:match('^https://') and data.image:sub(1, 512) or nil
    local count = MySQL.scalar.await('SELECT COUNT(*) FROM ophone_ads WHERE citizenid = ?', { Player.PlayerData.citizenid }) or 0
    if count >= 5 then return { ok = false, error = '5 annonces max' } end
    MySQL.insert.await('INSERT INTO ophone_ads (citizenid, author, number, title, content, price, image) VALUES (?, ?, ?, ?, ?, ?, ?)', {
        Player.PlayerData.citizenid, OPhone.GetName(Player), OPhone.GetNumber(Player), title, content, price, image,
    })
    return { ok = true }
end)

OPhone.Callback('ads:delete', function(src, data)
    local Player = OPhone.GetPlayer(src)
    if not Player then return { ok = false } end
    MySQL.update.await('DELETE FROM ophone_ads WHERE id = ? AND citizenid = ?', { tonumber(data.id), Player.PlayerData.citizenid })
    return { ok = true }
end)
