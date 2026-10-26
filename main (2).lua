local QBCore = exports['qb-core']:GetCoreObject()
OPhone.QB = QBCore

local Phone = {
    open = false,
    booted = false,
    typing = false,
    prop = nil,
    animState = nil,      -- 'text' | 'call' | 'camera'
    lastZone = nil,
}
OPhone.Phone = Phone

-- =========================================================
--  NUI HELPERS
-- =========================================================
function OPhone.Send(action, data)
    SendNUIMessage({ action = action, data = data })
end

function OPhone.Server(name, data, cb)
    QBCore.Functions.TriggerCallback('ophone:' .. name, function(res) if cb then cb(res) end end, data or {})
end

function OPhone.ServerAwait(name, data)
    local p = promise.new()
    OPhone.Server(name, data, function(res) p:resolve(res) end)
    return Citizen.Await(p)
end

local function hasPhone()
    if not Config.RequireItem then return true end
    return QBCore.Functions.HasItem(Config.PhoneItem)
end
OPhone.HasPhone = hasPhone

-- =========================================================
--  PROP + ANIMATIONS
-- =========================================================
local ANIMS = {
    foot = { dict = 'cellphone@', text_in = 'cellphone_text_in', text = 'cellphone_text_read_base', call = 'cellphone_call_listen_base', out = 'cellphone_text_out', call_in = 'cellphone_text_to_call' },
    car  = { dict = 'anim@cellphone@in_car@ps', text_in = 'cellphone_text_in', text = 'cellphone_text_read_base', call = 'cellphone_call_listen_base', out = 'cellphone_text_out', call_in = 'cellphone_text_to_call' },
}

local function loadDict(dict)
    if HasAnimDictLoaded(dict) then return true end
    RequestAnimDict(dict)
    local t = GetGameTimer()
    while not HasAnimDictLoaded(dict) and GetGameTimer() - t < 2000 do Wait(10) end
    return HasAnimDictLoaded(dict)
end

local function attachProp()
    if Phone.prop and DoesEntityExist(Phone.prop) then return end
    local ped = PlayerPedId()
    RequestModel(Config.Prop)
    local t = GetGameTimer()
    while not HasModelLoaded(Config.Prop) and GetGameTimer() - t < 2000 do Wait(10) end
    local coords = GetEntityCoords(ped)
    Phone.prop = CreateObject(Config.Prop, coords.x, coords.y, coords.z + 0.2, true, true, false)
    SetEntityCollision(Phone.prop, false, false)
    AttachEntityToEntity(Phone.prop, ped, GetPedBoneIndex(ped, 28422), 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, true, true, false, true, 1, true)
    SetModelAsNoLongerNeeded(Config.Prop)
end

local function removeProp()
    if Phone.prop and DoesEntityExist(Phone.prop) then DeleteEntity(Phone.prop) end
    Phone.prop = nil
end

function OPhone.PlayAnim(state)
    local ped = PlayerPedId()
    local set = IsPedInAnyVehicle(ped, false) and ANIMS.car or ANIMS.foot
    if not loadDict(set.dict) then return end
    if state == 'text' then
        attachProp()
        if Phone.animState ~= 'call' then
            TaskPlayAnim(ped, set.dict, set.text_in, 4.0, -1, -1, 50, 0, false, false, false)
            Wait(300)
        end
        TaskPlayAnim(ped, set.dict, set.text, 3.0, 3.0, -1, 49, 0, false, false, false)
    elseif state == 'call' then
        attachProp()
        TaskPlayAnim(ped, set.dict, set.call_in, 3.0, 3.0, -1, 50, 0, false, false, false)
        Wait(250)
        TaskPlayAnim(ped, set.dict, set.call, 3.0, 3.0, -1, 49, 0, false, false, false)
    elseif state == 'out' then
        TaskPlayAnim(ped, set.dict, set.out, 3.0, 3.0, -1, 50, 0, false, false, false)
        Wait(450)
        StopAnimTask(ped, set.dict, set.out, 1.0)
        removeProp()
    end
    Phone.animState = state
end

-- =========================================================
--  OUVERTURE / FERMETURE
-- =========================================================
local function boot(cb)
    OPhone.Server('boot', {}, function(res)
        if res and res.ok then
            Phone.booted = true
            OPhone.Send('boot', res)
        end
        if cb then cb(res and res.ok) end
    end)
end

local function zoneLabel()
    local c = GetEntityCoords(PlayerPedId())
    local zone = GetNameOfZone(c.x, c.y, c.z)
    local label = GetLabelText(zone)
    if label == 'NULL' or label == '' then
        local s = GetStreetNameAtCoord(c.x, c.y, c.z)
        label = GetStreetNameFromHashKey(s)
    end
    return label
end

local function clockData()
    if Config.UseGameTime then
        return { h = GetClockHours(), m = GetClockMinutes(), game = true }
    end
    return { game = false }
end

local function statusLoop()
    CreateThread(function()
        while Phone.open do
            OPhone.Send('status', { time = clockData(), zone = zoneLabel() })
            Wait(2000)
        end
    end)
end

local function controlLoop()
    CreateThread(function()
        while Phone.open do
            if Phone.typing then
                DisableAllControlActions(0)
                EnableControlAction(0, 249, true) -- push to talk
            else
                DisableControlAction(0, 1, true)   -- look LR
                DisableControlAction(0, 2, true)   -- look UD
                DisableControlAction(0, 24, true)  -- attack
                DisableControlAction(0, 25, true)  -- aim
                DisableControlAction(0, 37, true)  -- weapon wheel
                DisableControlAction(0, 140, true)
                DisableControlAction(0, 141, true)
                DisableControlAction(0, 142, true)
                DisableControlAction(0, 257, true)
                DisableControlAction(0, 263, true)
                DisableControlAction(0, 199, true) -- pause
                DisableControlAction(0, 200, true) -- pause alt
                DisableControlAction(0, 245, true) -- chat
                DisableControlAction(0, 44, true)  -- cover
                DisableControlAction(0, 45, true)  -- reload
                DisableControlAction(0, 0, true)   -- change view
                DisableControlAction(0, 26, true)  -- look behind
                DisableControlAction(0, 73, true)  -- X
                DisableControlAction(0, 289, true)
                DisableControlAction(0, 170, true)
                DisableControlAction(0, 167, true)
                DisableControlAction(0, 288, true)
                DisableControlAction(0, 311, true)
                DisableControlAction(0, 244, true)
                -- touches gerees par le telephone (T, Y, U, E, Q)
                DisableControlAction(0, 47, true)
                DisableControlAction(0, 246, true)
                DisableControlAction(0, 303, true)
                DisableControlAction(0, 38, true)
                DisableControlAction(0, 44, true)
            end
            Wait(0)
        end
    end)
end

function OPhone.Open(opts)
    if Phone.open then return end
    if IsPauseMenuActive() or IsPlayerDead(PlayerId()) or IsEntityDead(PlayerPedId()) then return end
    if not hasPhone() then
        QBCore.Functions.Notify("Tu n'as pas de telephone", 'error')
        return
    end
    local function doOpen()
        Phone.open = true
        Phone.typing = false
        SetNuiFocus(true, true)
        SetNuiFocusKeepInput(true)
        OPhone.Send('open', { time = clockData(), zone = zoneLabel(), app = opts and opts.app, payload = opts and opts.payload })
        if not OPhone.InCall then CreateThread(function() OPhone.PlayAnim('text') end) end
        statusLoop()
        controlLoop()
    end
    if not Phone.booted then boot(function(ok) if ok then doOpen() end end) else doOpen() end
end

function OPhone.Close()
    if not Phone.open then return end
    Phone.open = false
    Phone.typing = false
    SetNuiFocus(false, false)
    SetNuiFocusKeepInput(false)
    OPhone.Send('close')
    if OPhone.Camera and OPhone.Camera.active then OPhone.Camera.Stop() end
    if not OPhone.InCall then CreateThread(function() OPhone.PlayAnim('out') end) end
end

function OPhone.Toggle()
    if Phone.open then
        if Phone.typing then return end -- on tape un message : la touche ne ferme pas
        OPhone.Close()
    else
        OPhone.Open()
    end
end

RegisterCommand('+ophone', function() OPhone.Toggle() end, false)
RegisterCommand('-ophone', function() end, false)
RegisterKeyMapping('+ophone', 'Ouvrir le telephone', 'keyboard', Config.OpenKey)
RegisterNetEvent('ophone:client:toggle', OPhone.Toggle)

-- =========================================================
--  NUI CALLBACKS GENERIQUES
-- =========================================================
RegisterNUICallback('close', function(_, cb) OPhone.Close() cb('ok') end)

RegisterNUICallback('typing', function(data, cb)
    Phone.typing = data.state == true
    cb('ok')
end)

-- Pont generique NUI -> serveur (les callbacks serveur valident tout)
RegisterNUICallback('srv', function(data, cb)
    if type(data) ~= 'table' or type(data.name) ~= 'string' or not data.name:match('^[%w:]+$') then return cb({ ok = false }) end
    OPhone.Server(data.name, data.data or {}, function(res) cb(res or { ok = false }) end)
end)

RegisterNUICallback('reboot', function(_, cb)
    Phone.booted = false
    boot(function() cb('ok') end)
end)

RegisterNUICallback('waypoint', function(data, cb)
    local x, y = tonumber(data.x), tonumber(data.y)
    if x and y then
        SetNewWaypoint(x, y)
        QBCore.Functions.Notify('Position ajoutee au GPS', 'success')
    end
    cb('ok')
end)

RegisterNUICallback('copy', function(data, cb)
    -- le presse-papier est gere en NUI ; on notifie juste
    cb('ok')
end)

-- =========================================================
--  EVENTS SERVEUR -> NUI
-- =========================================================
RegisterNetEvent('ophone:client:notify', function(data)
    if not Phone.booted then return end
    OPhone.Send('notify', data)
end)

RegisterNetEvent('ophone:client:message', function(msg, notif)
    if not Phone.booted then return end
    OPhone.Send('message', { message = msg, notify = notif })
end)

RegisterNetEvent('ophone:client:pulse', function(notif)
    if Phone.booted then OPhone.Send('notify', notif) end
end)

RegisterNetEvent('ophone:client:contactOffer', function(data)
    if Phone.booted then OPhone.Send('contactOffer', data) end
end)

RegisterNetEvent('ophone:client:cryptoTick', function(market)
    if Phone.booted then OPhone.Send('cryptoTick', market) end
end)

RegisterNetEvent('ophone:client:casinoCrash', function(data)
    OPhone.Send('casinoCrash', data)
end)

-- Alertes metier (911, services) : blip temporaire + notif
RegisterNetEvent('ophone:client:serviceAlert', function(data)
    if not data or not data.coords then return end
    local blip = AddBlipForCoord(data.coords.x, data.coords.y, data.coords.z)
    SetBlipSprite(blip, 817)
    SetBlipColour(blip, 1)
    SetBlipScale(blip, 1.0)
    SetBlipFlashes(blip, true)
    BeginTextCommandSetBlipName('STRING')
    AddTextComponentSubstringPlayerName(data.message or 'Appel')
    EndTextCommandSetBlipName(blip)
    SetTimeout(90000, function() if DoesBlipExist(blip) then RemoveBlip(blip) end end)
    if Phone.booted then
        OPhone.Send('notify', {
            app = 'services', title = data.anonymous and 'Appel anonyme' or (data.from or 'Alerte'),
            body = data.message, sticky = true, gps = data.coords, number = (not data.anonymous) and data.number or nil,
        })
    end
end)

-- =========================================================
--  CYCLE DE VIE QBCORE
-- =========================================================
RegisterNetEvent('QBCore:Client:OnPlayerLoaded', function()
    Phone.booted = false
    Wait(1500)
    boot()
end)

RegisterNetEvent('QBCore:Client:OnPlayerUnload', function()
    OPhone.Close()
    Phone.booted = false
    OPhone.Send('reset')
end)

RegisterNetEvent('QBCore:Client:OnJobUpdate', function()
    if Phone.booted then boot() end
end)

-- l'item disparait (fouille, mort...) -> on ferme et raccroche
RegisterNetEvent('QBCore:Player:SetPlayerData', function()
    if not Config.RequireItem then return end
    SetTimeout(250, function()
        if not hasPhone() then
            if Phone.open then OPhone.Close() end
            if OPhone.InCall and OPhone.HangUp then OPhone.HangUp() end
        end
    end)
end)

AddEventHandler('onResourceStop', function(res)
    if res ~= GetCurrentResourceName() then return end
    SetNuiFocus(false, false)
    removeProp()
    ClearTimecycleModifier()
end)

AddEventHandler('onResourceStart', function(res)
    if res ~= GetCurrentResourceName() then return end
    if LocalPlayer.state.isLoggedIn then Wait(1000) boot() end
end)

exports('IsOpen', function() return Phone.open end)
exports('Open', OPhone.Open)
exports('Close', OPhone.Close)
