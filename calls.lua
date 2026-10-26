-- =========================================================
--  APPELS + APPELS VIDEO
-- =========================================================
local Calls, PlayerCall, nextId = {}, {}, 0

local function logCall(call, status)
    local duration = call.startedAt and (os.time() - call.startedAt) or 0
    MySQL.insert('INSERT INTO ophone_calls (caller, receiver, status, video, duration) VALUES (?, ?, ?, ?, ?)', {
        call.callerNumber, call.receiverNumber, status, call.video and 1 or 0, duration,
    })
end

local function endCall(id, reason)
    local call = Calls[id]
    if not call then return end
    Calls[id] = nil
    local everyone = { call.caller }
    if call.receiver then everyone[#everyone + 1] = call.receiver else
        for _, t in ipairs(call.targets) do everyone[#everyone + 1] = t end
    end
    for _, s in ipairs(everyone) do
        if PlayerCall[s] == id then PlayerCall[s] = nil end
        TriggerClientEvent('ophone:client:callEnded', s, id, reason)
    end
    if call.state == 'active' then
        logCall(call, 'answered')
    elseif reason == 'declined' then
        logCall(call, 'declined')
    else
        logCall(call, 'missed')
        if not call.emergency and call.targets[1] then
            OPhone.Notify(call.targets[1], { app = 'phone', title = 'Appel manque', body = call.callerNumber, badge = 1 })
        end
    end
end

local function onDutyFor(jobs)
    local list = {}
    for _, P in pairs(OPhone.QB.Functions.GetQBPlayers()) do
        local j = P.PlayerData.job
        for _, name in ipairs(jobs) do
            if j.name == name and j.onduty and OPhone.IsReachable(P.PlayerData.source) and not PlayerCall[P.PlayerData.source] then
                list[#list + 1] = P.PlayerData.source
            end
        end
    end
    return list
end

OPhone.Callback('calls:start', function(src, data)
    local Player = OPhone.GetPlayer(src)
    if not Player then return { ok = false } end
    if OPhone.Airplane[src] then return { ok = false, error = 'Mode avion actif' } end
    if PlayerCall[src] then return { ok = false, error = 'Deja en appel' } end
    if not OPhone.Throttle(src, 'call', 1500) then return { ok = false, error = 'Patiente' } end

    local number = OPhone.SanitizeNumber(data.number)
    if not number then return { ok = false, error = 'Numero invalide' } end
    local myNumber = OPhone.GetNumber(Player)
    if number == myNumber then return { ok = false, error = 'Tu ne peux pas t\'appeler' } end

    local emergency = Config.EmergencyNumbers[number]
    local targets
    if emergency then
        targets = onDutyFor(emergency.jobs)
        if #targets == 0 then return { ok = false, error = 'Aucun agent disponible' } end
    else
        local tsrc = OPhone.GetSourceByNumber(number)
        if not tsrc or not OPhone.IsReachable(tsrc) then
            MySQL.insert('INSERT INTO ophone_calls (caller, receiver, status, video) VALUES (?, ?, ?, ?)', { myNumber, number, 'missed', data.video and 1 or 0 })
            return { ok = false, error = 'Le correspondant est injoignable' }
        end
        if PlayerCall[tsrc] then return { ok = false, error = 'Ligne occupee' } end
        targets = { tsrc }
    end

    nextId = nextId + 1
    local id = nextId
    local call = {
        id = id, caller = src, callerNumber = myNumber, receiverNumber = number, targets = targets,
        video = data.video == true and Config.VideoCall.Enabled and not emergency, state = 'ringing',
        emergency = emergency and emergency.label or nil,
    }
    Calls[id] = call
    PlayerCall[src] = id

    local coords = GetEntityCoords(GetPlayerPed(src))
    for _, t in ipairs(targets) do
        PlayerCall[t] = id
        local TP = OPhone.GetPlayer(t)
        TriggerClientEvent('ophone:client:incomingCall', t, {
            id = id, number = myNumber, video = call.video, emergency = call.emergency,
            name = TP and OPhone.ContactName(TP.PlayerData.citizenid, myNumber) or myNumber,
        })
        if emergency and emergency.blip then
            TriggerClientEvent('ophone:client:serviceAlert', t, {
                from = OPhone.GetName(Player), number = myNumber, message = 'Appel ' .. emergency.label,
                coords = { x = coords.x, y = coords.y, z = coords.z },
            })
        end
    end

    SetTimeout(Config.Calls.RingTimeout * 1000, function()
        if Calls[id] and Calls[id].state == 'ringing' then endCall(id, 'timeout') end
    end)

    local name = emergency and emergency.label or OPhone.ContactName(Player.PlayerData.citizenid, number)
    return { ok = true, id = id, number = number, name = name, video = call.video }
end)

OPhone.Callback('calls:answer', function(src, data)
    local call = Calls[tonumber(data.id)]
    if not call or call.state ~= 'ringing' then return { ok = false, error = 'Appel termine' } end
    local allowed = false
    for _, t in ipairs(call.targets) do if t == src then allowed = true end end
    if not allowed then return { ok = false } end

    call.state, call.receiver, call.startedAt = 'active', src, os.time()
    local Receiver = OPhone.GetPlayer(src)
    call.receiverNumber = call.emergency and call.receiverNumber or OPhone.GetNumber(Receiver)

    -- les autres agents arretent de sonner
    for _, t in ipairs(call.targets) do
        if t ~= src then
            PlayerCall[t] = nil
            TriggerClientEvent('ophone:client:callEnded', t, call.id, 'taken')
        end
    end

    local channel = Config.Calls.CallChannelBase + call.id
    local Caller = OPhone.GetPlayer(call.caller)
    TriggerClientEvent('ophone:client:callStarted', call.caller, {
        id = call.id, channel = channel, video = call.video, number = call.receiverNumber,
        name = call.emergency or OPhone.ContactName(Caller.PlayerData.citizenid, OPhone.GetNumber(Receiver)),
    })
    return {
        ok = true, id = call.id, channel = channel, video = call.video, number = call.callerNumber,
        name = OPhone.ContactName(Receiver.PlayerData.citizenid, call.callerNumber),
    }
end)

OPhone.Callback('calls:decline', function(src, data)
    local id = tonumber(data.id)
    local call = Calls[id]
    if not call then return { ok = true } end
    if call.state == 'ringing' and #call.targets > 1 and src ~= call.caller then
        -- un agent refuse : on le retire simplement
        for i, t in ipairs(call.targets) do if t == src then table.remove(call.targets, i) break end end
        PlayerCall[src] = nil
        TriggerClientEvent('ophone:client:callEnded', src, id, 'declined')
        if #call.targets == 0 then endCall(id, 'declined') end
        return { ok = true }
    end
    endCall(id, call.state == 'ringing' and src ~= call.caller and 'declined' or 'hangup')
    return { ok = true }
end)

OPhone.Callback('calls:hangup', function(src, data)
    local id = tonumber(data.id) or PlayerCall[src]
    if id and Calls[id] then endCall(id, 'hangup') end
    return { ok = true }
end)

OPhone.Callback('calls:recent', function(src)
    local Player = OPhone.GetPlayer(src)
    if not Player then return {} end
    local n = OPhone.GetNumber(Player)
    local rows = MySQL.query.await([[
        SELECT id, caller, receiver, status, video, duration, UNIX_TIMESTAMP(created_at) AS ts
        FROM ophone_calls WHERE caller = ? OR receiver = ? ORDER BY id DESC LIMIT 60
    ]], { n, n }) or {}
    local cid = Player.PlayerData.citizenid
    local cache = {}
    for _, r in ipairs(rows) do
        r.outgoing = r.caller == n
        local other = r.outgoing and r.receiver or r.caller
        r.number = other
        if not cache[other] then
            cache[other] = Config.EmergencyNumbers[other] and Config.EmergencyNumbers[other].label or OPhone.ContactName(cid, other)
        end
        r.name = cache[other]
        r.video = r.video == 1
    end
    return rows
end)

OPhone.Callback('calls:clearRecent', function(src)
    local Player = OPhone.GetPlayer(src)
    if not Player then return { ok = false } end
    local n = OPhone.GetNumber(Player)
    MySQL.update.await('DELETE FROM ophone_calls WHERE caller = ? OR receiver = ?', { n, n })
    return { ok = true }
end)

-- Relais des images d'appel video (latent = ne bloque pas le reseau)
RegisterNetEvent('ophone:server:videoFrame', function(id, frame)
    local src = source
    local call = Calls[tonumber(id)]
    if not call or call.state ~= 'active' or not call.video then return end
    if type(frame) ~= 'string' or #frame > 90000 or frame:sub(1, 11) ~= 'data:image/' then return end
    local peer = (src == call.caller) and call.receiver or (src == call.receiver and call.caller or nil)
    if peer then TriggerLatentClientEvent('ophone:client:videoFrame', peer, 60000, frame) end
end)

RegisterNetEvent('ophone:server:videoToggle', function(id, enabled)
    local src = source
    local call = Calls[tonumber(id)]
    if not call or call.state ~= 'active' then return end
    local peer = (src == call.caller) and call.receiver or (src == call.receiver and call.caller or nil)
    if peer then TriggerClientEvent('ophone:client:peerVideo', peer, enabled == true) end
end)

AddEventHandler('ophone:server:dropped', function(src)
    local id = PlayerCall[src]
    if id and Calls[id] then endCall(id, 'hangup') end
    PlayerCall[src] = nil
end)

exports('IsInCall', function(src) return PlayerCall[src] ~= nil end)
