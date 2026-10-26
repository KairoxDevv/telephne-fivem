-- =========================================================
--  MESSAGES (1-1 + groupes)
-- =========================================================
local function isMember(convId, number)
    return MySQL.scalar.await('SELECT 1 FROM ophone_conversation_members WHERE conversation_id = ? AND number = ?', { convId, number }) ~= nil
end

local function members(convId)
    local rows = MySQL.query.await('SELECT number FROM ophone_conversation_members WHERE conversation_id = ?', { convId }) or {}
    local out = {}
    for i, r in ipairs(rows) do out[i] = r.number end
    return out
end

local function findDirect(a, b)
    return MySQL.scalar.await([[
        SELECT c.id FROM ophone_conversations c
        JOIN ophone_conversation_members m1 ON m1.conversation_id = c.id AND m1.number = ?
        JOIN ophone_conversation_members m2 ON m2.conversation_id = c.id AND m2.number = ?
        WHERE c.is_group = 0 LIMIT 1
    ]], { a, b })
end

local function createConversation(numbers, name, isGroup, owner)
    local id = MySQL.insert.await('INSERT INTO ophone_conversations (name, is_group, owner) VALUES (?, ?, ?)', { name, isGroup and 1 or 0, owner })
    local params = {}
    for _, n in ipairs(numbers) do params[#params + 1] = { id, n } end
    MySQL.prepare.await('INSERT IGNORE INTO ophone_conversation_members (conversation_id, number) VALUES (?, ?)', params)
    return id
end

OPhone.Callback('messages:list', function(src)
    local Player = OPhone.GetPlayer(src)
    if not Player then return {} end
    local number = OPhone.GetNumber(Player)
    local rows = MySQL.query.await([[
        SELECT c.id, c.name, c.is_group, c.last_message, UNIX_TIMESTAMP(c.last_at) AS ts, m.unread,
            (SELECT GROUP_CONCAT(m2.number) FROM ophone_conversation_members m2 WHERE m2.conversation_id = c.id) AS members
        FROM ophone_conversations c
        JOIN ophone_conversation_members m ON m.conversation_id = c.id
        WHERE m.number = ? AND m.hidden = 0
        ORDER BY c.last_at DESC LIMIT 100
    ]], { number }) or {}
    local cid = Player.PlayerData.citizenid
    local contacts = MySQL.query.await('SELECT name, number, avatar FROM ophone_contacts WHERE citizenid = ?', { cid }) or {}
    local book = {}
    for _, c in ipairs(contacts) do book[c.number] = c end
    for _, r in ipairs(rows) do
        local list = {}
        for n in (r.members or ''):gmatch('[^,]+') do list[#list + 1] = n end
        r.members = list
        r.is_group = r.is_group == 1
        if not r.is_group then
            for _, n in ipairs(list) do
                if n ~= number then
                    r.peer = n
                    r.name = book[n] and book[n].name or n
                    r.avatar = book[n] and book[n].avatar or nil
                end
            end
        end
    end
    return rows
end)

OPhone.Callback('messages:open', function(src, data)
    local Player = OPhone.GetPlayer(src)
    if not Player then return { ok = false } end
    local number = OPhone.GetNumber(Player)
    local convId = tonumber(data.id)
    if not convId and data.number then
        local peer = OPhone.SanitizeNumber(data.number)
        if not peer or peer == number then return { ok = false, error = 'Numero invalide' } end
        convId = findDirect(number, peer) or createConversation({ number, peer }, nil, false, number)
    end
    if not convId or not isMember(convId, number) then return { ok = false } end
    MySQL.update.await('UPDATE ophone_conversation_members SET unread = 0, hidden = 0 WHERE conversation_id = ? AND number = ?', { convId, number })
    local conv = MySQL.single.await('SELECT id, name, is_group, owner FROM ophone_conversations WHERE id = ?', { convId })
    local msgs = MySQL.query.await([[
        SELECT id, sender, content, attachment, UNIX_TIMESTAMP(created_at) AS ts FROM (
            SELECT * FROM ophone_messages WHERE conversation_id = ? ORDER BY id DESC LIMIT 80
        ) t ORDER BY id ASC
    ]], { convId }) or {}
    for _, m in ipairs(msgs) do m.attachment = OPhone.Decode(m.attachment, nil) end
    local mem = members(convId)
    local cid = Player.PlayerData.citizenid
    local names = {}
    for _, n in ipairs(mem) do names[n] = n == number and 'Moi' or OPhone.ContactName(cid, n) end
    local title = conv.name
    if conv.is_group ~= 1 then
        for _, n in ipairs(mem) do if n ~= number then title = names[n]; conv.peer = n end end
    end
    return { ok = true, id = convId, title = title, isGroup = conv.is_group == 1, peer = conv.peer, members = mem, names = names, messages = msgs, owner = conv.owner }
end)

OPhone.Callback('messages:send', function(src, data)
    local Player = OPhone.GetPlayer(src)
    if not Player then return { ok = false } end
    if OPhone.Airplane[src] then return { ok = false, error = 'Mode avion actif' } end
    if not OPhone.Throttle(src, 'msg', 350) then return { ok = false, error = 'Trop rapide' } end
    local number = OPhone.GetNumber(Player)
    local convId = tonumber(data.id)
    if not convId or not isMember(convId, number) then return { ok = false } end

    local content = OPhone.SanitizeText(data.content, 1000)
    local attachment = nil
    if type(data.attachment) == 'table' then
        local a = data.attachment
        if a.type == 'image' and type(a.url) == 'string' and a.url:match('^https://') then
            attachment = { type = 'image', url = a.url:sub(1, 512) }
        elseif a.type == 'gps' then
            local c = GetEntityCoords(GetPlayerPed(src))
            attachment = { type = 'gps', x = OPhone.Round(c.x, 2), y = OPhone.Round(c.y, 2), z = OPhone.Round(c.z, 2) }
        elseif a.type == 'contact' and OPhone.SanitizeNumber(a.number) then
            attachment = { type = 'contact', name = OPhone.SanitizeText(a.name, 60), number = OPhone.SanitizeNumber(a.number) }
        end
    end
    if content == '' and not attachment then return { ok = false } end

    local preview = content ~= '' and content:sub(1, 120) or (attachment.type == 'image' and 'Photo' or attachment.type == 'gps' and 'Position GPS' or 'Contact')
    local encodedAtt = attachment and json.encode(attachment) or nil
    local id = MySQL.insert.await('INSERT INTO ophone_messages (conversation_id, sender, content, attachment) VALUES (?, ?, ?, ?)', { convId, number, content, encodedAtt })
    MySQL.update.await('UPDATE ophone_conversations SET last_message = ?, last_at = NOW() WHERE id = ?', { preview, convId })
    MySQL.update.await('UPDATE ophone_conversation_members SET unread = unread + 1, hidden = 0 WHERE conversation_id = ? AND number <> ?', { convId, number })

    local msg = { id = id, conversation = convId, sender = number, content = content, attachment = attachment, ts = os.time() }
    local conv = MySQL.single.await('SELECT name, is_group FROM ophone_conversations WHERE id = ?', { convId })
    for _, n in ipairs(members(convId)) do
        if n ~= number then
            local tsrc = OPhone.GetSourceByNumber(n)
            if tsrc and OPhone.IsReachable(tsrc) then
                local TP = OPhone.GetPlayer(tsrc)
                local fromName = OPhone.ContactName(TP.PlayerData.citizenid, number)
                TriggerClientEvent('ophone:client:message', tsrc, msg, {
                    app = 'messages',
                    title = conv.is_group == 1 and (conv.name or 'Groupe') or fromName,
                    body = conv.is_group == 1 and (fromName .. ' : ' .. preview) or preview,
                    conversation = convId,
                })
            end
        end
    end
    return { ok = true, message = msg }
end)

OPhone.Callback('messages:createGroup', function(src, data)
    local Player = OPhone.GetPlayer(src)
    if not Player then return { ok = false } end
    local number = OPhone.GetNumber(Player)
    local name = OPhone.SanitizeText(data.name, 40)
    if name == '' then name = 'Groupe' end
    local list, seen = { number }, { [number] = true }
    for _, n in ipairs(type(data.members) == 'table' and data.members or {}) do
        local clean = OPhone.SanitizeNumber(n)
        if clean and not seen[clean] and #list < 20 then list[#list + 1] = clean; seen[clean] = true end
    end
    if #list < 2 then return { ok = false, error = 'Ajoute au moins un membre' } end
    local id = createConversation(list, name, true, number)
    return { ok = true, id = id }
end)

OPhone.Callback('messages:addMember', function(src, data)
    local Player = OPhone.GetPlayer(src)
    if not Player then return { ok = false } end
    local convId, n = tonumber(data.id), OPhone.SanitizeNumber(data.number)
    if not convId or not n or not isMember(convId, OPhone.GetNumber(Player)) then return { ok = false } end
    MySQL.insert.await('INSERT IGNORE INTO ophone_conversation_members (conversation_id, number) VALUES (?, ?)', { convId, n })
    return { ok = true }
end)

OPhone.Callback('messages:leave', function(src, data)
    local Player = OPhone.GetPlayer(src)
    if not Player then return { ok = false } end
    local convId = tonumber(data.id)
    local number = OPhone.GetNumber(Player)
    local conv = MySQL.single.await('SELECT is_group FROM ophone_conversations WHERE id = ?', { convId })
    if not conv then return { ok = false } end
    if conv.is_group == 1 then
        MySQL.update.await('DELETE FROM ophone_conversation_members WHERE conversation_id = ? AND number = ?', { convId, number })
    else
        MySQL.update.await('UPDATE ophone_conversation_members SET hidden = 1, unread = 0 WHERE conversation_id = ? AND number = ?', { convId, number })
    end
    return { ok = true }
end)

OPhone.Callback('messages:read', function(src, data)
    local Player = OPhone.GetPlayer(src)
    if not Player then return { ok = false } end
    MySQL.update('UPDATE ophone_conversation_members SET unread = 0 WHERE conversation_id = ? AND number = ?', { tonumber(data.id), OPhone.GetNumber(Player) })
    return { ok = true }
end)

-- Export : envoyer un SMS systeme a un numero (ex: banque, livraison...)
exports('SendSystemMessage', function(toNumber, fromLabel, content)
    local number = OPhone.SanitizeNumber(toNumber)
    if not number then return false end
    OPhone.NotifyNumber(number, { app = 'messages', title = fromLabel or 'Systeme', body = content })
    return true
end)
