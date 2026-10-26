-- =========================================================
--  APPELS (pma-voice) + APPELS VIDEO (screenshot-basic)
-- =========================================================
OPhone.InCall = false
local Current = nil          -- { id, channel, video }
local videoOn = false

local function stopVideo()
    videoOn = false
    if OPhone.Camera.active then OPhone.Camera.Stop() end
end

local function videoLoop()
    if not Config.VideoCall.Enabled or GetResourceState('screenshot-basic') ~= 'started' then return end
    CreateThread(function()
        while videoOn and Current do
            local id = Current.id
            exports['screenshot-basic']:requestScreenshot({ encoding = 'jpg', quality = 0.5 }, function(data)
                -- la NUI reduit l'image (canvas) puis la renvoie via 'video:frame'
                if videoOn and Current and Current.id == id then
                    OPhone.Send('video:compress', { data = data, w = Config.VideoCall.FrameWidth, h = Config.VideoCall.FrameHeight, q = Config.VideoCall.FrameQuality })
                end
            end)
            Wait(Config.VideoCall.FrameInterval)
        end
    end)
end

local function startVideo()
    if videoOn then return end
    videoOn = true
    OPhone.Camera.zoom = 1.0
    OPhone.Camera.Start(true)  -- selfie : c'est ton visage que l'autre voit
    videoLoop()
end

function OPhone.HangUp()
    if Current then OPhone.Server('calls:hangup', { id = Current.id }) end
end

local function leaveVoice()
    if GetResourceState('pma-voice') == 'started' then exports['pma-voice']:removePlayerFromCall() end
end

-- -------------------------------------------- events serveur
RegisterNetEvent('ophone:client:incomingCall', function(data)
    if not OPhone.Phone.booted then return end
    OPhone.Send('call:incoming', data)
end)

RegisterNetEvent('ophone:client:callStarted', function(data)
    Current = { id = data.id, channel = data.channel, video = data.video }
    OPhone.InCall = true
    if GetResourceState('pma-voice') == 'started' then exports['pma-voice']:addPlayerToCall(data.channel) end
    CreateThread(function() OPhone.PlayAnim('call') end)
    OPhone.Send('call:active', data)
    if data.video then startVideo() end
end)

RegisterNetEvent('ophone:client:callEnded', function(id, reason)
    OPhone.Send('call:ended', { id = id, reason = reason })
    if Current and Current.id == id then
        Current = nil
        OPhone.InCall = false
        stopVideo()
        leaveVoice()
    end
    if not Current and reason ~= 'taken' then
        CreateThread(function()
            if OPhone.Phone.open then OPhone.PlayAnim('text') else OPhone.PlayAnim('out') end
        end)
    end
end)

RegisterNetEvent('ophone:client:videoFrame', function(frame)
    OPhone.Send('video:frame', frame)
end)

RegisterNetEvent('ophone:client:peerVideo', function(enabled)
    OPhone.Send('video:peer', { enabled = enabled })
end)

-- -------------------------------------------- NUI
RegisterNUICallback('call:start', function(data, cb)
    OPhone.Server('calls:start', { number = data.number, video = data.video == true }, function(res)
        if res and res.ok then
            CreateThread(function() OPhone.PlayAnim('call') end)
        end
        cb(res or { ok = false })
    end)
end)

RegisterNUICallback('call:answer', function(data, cb)
    OPhone.Server('calls:answer', { id = data.id }, function(res)
        if res and res.ok then
            Current = { id = res.id, channel = res.channel, video = res.video }
            OPhone.InCall = true
            if GetResourceState('pma-voice') == 'started' then exports['pma-voice']:addPlayerToCall(res.channel) end
            CreateThread(function() OPhone.PlayAnim('call') end)
            if res.video then startVideo() end
        end
        cb(res or { ok = false })
    end)
end)

RegisterNUICallback('call:decline', function(data, cb)
    OPhone.Server('calls:decline', { id = data.id }, function() cb('ok') end)
end)

RegisterNUICallback('call:hangup', function(data, cb)
    OPhone.Server('calls:hangup', { id = data.id }, function() cb('ok') end)
    if not Current then CreateThread(function() if OPhone.Phone.open then OPhone.PlayAnim('text') end end) end
end)

RegisterNUICallback('video:frame', function(data, cb)
    if videoOn and Current and type(data.frame) == 'string' then
        TriggerLatentServerEvent('ophone:server:videoFrame', 60000, Current.id, data.frame)
    end
    cb('ok')
end)

RegisterNUICallback('video:toggle', function(data, cb)
    if not Current or not Current.video then return cb('ok') end
    if data.enabled then startVideo() else stopVideo() end
    TriggerServerEvent('ophone:server:videoToggle', Current.id, data.enabled == true)
    cb('ok')
end)

AddEventHandler('onResourceStop', function(res)
    if res == GetCurrentResourceName() and Current then leaveVoice() end
end)
