-- =========================================================
--  APPAREIL PHOTO : camera scriptee (arriere / selfie / zoom / filtres)
-- =========================================================
local Cam = {
    active = false,
    handle = nil,
    selfie = false,
    zoom = 1.0,
    filter = nil,
    strength = 1.0,
    pitch = 0.0,
    yaw = 0.0,       -- selfie : angle autour du visage
}
OPhone.Camera = Cam

local SELFIE_DICT = 'cellphone@self'

local function fovFor(zoom)
    return OPhone.Clamp(Config.Camera.BaseFov / zoom, 12.0, 100.0)
end

local function applyFilter()
    ClearTimecycleModifier()
    if Cam.filter then
        SetTimecycleModifier(Cam.filter)
        SetTimecycleModifierStrength(Cam.strength)
    end
end

local function updateCam()
    local ped = PlayerPedId()
    if Cam.selfie then
        local yaw = math.rad(Cam.yaw)
        local off = vector3(math.sin(yaw) * 0.75, 0.75 * math.cos(yaw) + 0.05, 0.62 + Cam.pitch * 0.004)
        local pos = GetOffsetFromEntityInWorldCoords(ped, off.x, off.y, off.z)
        SetCamCoord(Cam.handle, pos.x, pos.y, pos.z)
        local head = GetPedBoneCoords(ped, 31086, 0.0, 0.0, 0.0)
        PointCamAtCoord(Cam.handle, head.x, head.y, head.z + 0.02)
    else
        local head = GetPedBoneCoords(ped, 31086, 0.0, 0.0, 0.0)
        local heading = GetEntityHeading(ped)
        local rad = math.rad(heading)
        local fwd = vector3(-math.sin(rad), math.cos(rad), 0.0)
        local pos = head + fwd * 0.28 + vector3(0.0, 0.0, 0.05)
        StopCamPointing(Cam.handle)
        SetCamCoord(Cam.handle, pos.x, pos.y, pos.z)
        SetCamRot(Cam.handle, Cam.pitch, 0.0, heading, 2)
    end
    SetCamFov(Cam.handle, fovFor(Cam.zoom))
end

local function camLoop()
    CreateThread(function()
        while Cam.active do
            local ped = PlayerPedId()
            -- clic droit maintenu = orienter la camera
            if IsDisabledControlPressed(0, 25) then
                local dx = GetDisabledControlNormal(0, 1) * 6.0
                local dy = GetDisabledControlNormal(0, 2) * 6.0
                if Cam.selfie then
                    Cam.yaw = OPhone.Clamp(Cam.yaw - dx * 4.0, -55.0, 55.0)
                    Cam.pitch = OPhone.Clamp(Cam.pitch - dy * 4.0, -40.0, 40.0)
                else
                    Cam.pitch = OPhone.Clamp(Cam.pitch - dy * 2.0, -70.0, 60.0)
                    if not IsPedInAnyVehicle(ped, false) then
                        SetEntityHeading(ped, GetEntityHeading(ped) - dx * 2.0)
                    end
                end
            end
            -- molette = zoom
            if IsDisabledControlJustPressed(0, 241) then OPhone.Camera.StepZoom(1) end
            if IsDisabledControlJustPressed(0, 242) then OPhone.Camera.StepZoom(-1) end
            HideHudComponentThisFrame(14) -- reticule
            DisableControlAction(0, 25, true)
            DisableControlAction(0, 24, true)
            DisableControlAction(0, 241, true)
            DisableControlAction(0, 242, true)
            updateCam()
            Wait(0)
        end
    end)
end

function Cam.Start(selfie)
    local ped = PlayerPedId()
    Cam.selfie = selfie == true
    Cam.pitch, Cam.yaw = 0.0, 0.0
    if not Cam.handle then
        Cam.handle = CreateCam('DEFAULT_SCRIPTED_CAMERA', true)
    end
    SetCamActive(Cam.handle, true)
    RenderScriptCams(true, true, 250, true, false)
    Cam.active = true
    if Cam.selfie then
        RequestAnimDict(SELFIE_DICT)
        local t = GetGameTimer()
        while not HasAnimDictLoaded(SELFIE_DICT) and GetGameTimer() - t < 1500 do Wait(10) end
        TaskPlayAnim(ped, SELFIE_DICT, 'selfie', 3.0, 3.0, -1, 49, 0, false, false, false)
    end
    applyFilter()
    camLoop()
end

function Cam.Stop()
    if not Cam.active then return end
    Cam.active = false
    RenderScriptCams(false, true, 250, true, false)
    if Cam.handle then
        SetCamActive(Cam.handle, false)
        DestroyCam(Cam.handle, false)
        Cam.handle = nil
    end
    ClearTimecycleModifier()
    StopAnimTask(PlayerPedId(), SELFIE_DICT, 'selfie', 1.0)
    if OPhone.Phone.open and not OPhone.InCall then CreateThread(function() OPhone.PlayAnim('text') end) end
    OPhone.Send('camera:state', { active = false })
end

function Cam.Flip()
    local wasActive = Cam.active
    local selfie = not Cam.selfie
    if wasActive then
        Cam.selfie = selfie
        Cam.pitch, Cam.yaw = 0.0, 0.0
        local ped = PlayerPedId()
        if selfie then
            RequestAnimDict(SELFIE_DICT)
            local t = GetGameTimer()
            while not HasAnimDictLoaded(SELFIE_DICT) and GetGameTimer() - t < 1500 do Wait(10) end
            TaskPlayAnim(ped, SELFIE_DICT, 'selfie', 3.0, 3.0, -1, 49, 0, false, false, false)
        else
            StopAnimTask(ped, SELFIE_DICT, 'selfie', 1.0)
            CreateThread(function() OPhone.PlayAnim('text') end)
        end
    end
    return selfie
end

function Cam.StepZoom(dir)
    local zooms = Config.Camera.Zooms
    local idx = 1
    for i, z in ipairs(zooms) do if math.abs(z - Cam.zoom) < 0.01 then idx = i end end
    idx = OPhone.Clamp(idx + dir, 1, #zooms)
    Cam.zoom = zooms[idx]
    OPhone.Send('camera:state', { active = true, zoom = Cam.zoom })
end

-- Upload d'une capture d'ecran (le HUD du telephone n'est pas capture)
local function parseUploadUrl(provider, raw)
    local ok, res = pcall(json.decode, raw)
    if not ok or type(res) ~= 'table' then return nil end
    if provider == 'discord' then
        local a = res.attachments and res.attachments[1]
        return a and (a.url or a.proxy_url) or nil
    end
    return res.url or (res.data and res.data.url) or res.link or (res.files and res.files[1] and res.files[1].url) or nil
end

function Cam.TakePhoto(cb)
    local conf = OPhone.ServerAwait('camera:uploadConfig', {})
    if not conf or not conf.ok then return cb({ ok = false, error = conf and conf.error or 'Upload indisponible' }) end
    if GetResourceState('screenshot-basic') ~= 'started' then return cb({ ok = false, error = 'screenshot-basic manquant' }) end
    exports['screenshot-basic']:requestScreenshotUpload(conf.url, conf.field, {
        headers = conf.headers, encoding = conf.encoding or 'webp', quality = conf.quality or 0.85,
    }, function(raw)
        local url = parseUploadUrl(conf.provider, raw)
        if not url then return cb({ ok = false, error = 'Echec de l\'upload' }) end
        local res = OPhone.ServerAwait('gallery:add', { url = url })
        cb({ ok = res and res.ok, url = url, id = res and res.id })
    end)
end

-- =========================================================
--  NUI CALLBACKS
-- =========================================================
RegisterNUICallback('camera:start', function(data, cb)
    Cam.zoom = 1.0
    Cam.filter = nil
    Cam.Start(data and data.selfie)
    cb({ ok = true, zoom = Cam.zoom })
end)

RegisterNUICallback('camera:stop', function(_, cb) Cam.Stop() cb('ok') end)

RegisterNUICallback('camera:flip', function(_, cb)
    cb({ selfie = Cam.Flip() })
end)

RegisterNUICallback('camera:zoom', function(data, cb)
    local z = tonumber(data.zoom)
    if z then Cam.zoom = OPhone.Clamp(z, 0.5, 5.0) end
    cb({ zoom = Cam.zoom })
end)

RegisterNUICallback('camera:filter', function(data, cb)
    Cam.filter = nil
    for _, f in ipairs(Config.Camera.Filters) do
        if f.id == data.id then Cam.filter = f.modifier end
    end
    Cam.strength = OPhone.Clamp(tonumber(data.strength) or 1.0, 0.0, 1.0)
    applyFilter()
    cb('ok')
end)

RegisterNUICallback('camera:shoot', function(_, cb)
    PlaySoundFrontend(-1, 'Camera_Shoot', 'Phone_Soundset_Franklin', true)
    Cam.TakePhoto(cb)
end)
