-- =========================================================
--  APPS CLIENT : garage, partage contact, GPS
-- =========================================================
local QBCore = OPhone.QB

local function closestPlayer(maxDist)
    local ped = PlayerPedId()
    local coords = GetEntityCoords(ped)
    local best, bestDist = nil, maxDist or 3.0
    for _, pid in ipairs(GetActivePlayers()) do
        if pid ~= PlayerId() then
            local d = #(GetEntityCoords(GetPlayerPed(pid)) - coords)
            if d < bestDist then best, bestDist = pid, d end
        end
    end
    return best and GetPlayerServerId(best) or nil
end

RegisterNUICallback('contacts:shareNearby', function(_, cb)
    local target = closestPlayer(3.0)
    if not target then return cb({ ok = false, error = 'Personne a proximite' }) end
    OPhone.Server('contacts:share', { target = target }, function(res) cb(res or { ok = false }) end)
end)

local function findVehicleByPlate(plate)
    plate = plate:gsub('%s+', ''):upper()
    for _, veh in ipairs(GetGamePool('CVehicle')) do
        if GetVehicleNumberPlateText(veh):gsub('%s+', ''):upper() == plate then return veh end
    end
    return nil
end

RegisterNUICallback('garage:locate', function(data, cb)
    if type(data.plate) ~= 'string' then return cb({ ok = false }) end
    local veh = findVehicleByPlate(data.plate)
    if veh then
        local c = GetEntityCoords(veh)
        SetNewWaypoint(c.x, c.y)
        local blip = AddBlipForEntity(veh)
        SetBlipSprite(blip, 225)
        SetBlipColour(blip, 27)
        SetTimeout(30000, function() if DoesBlipExist(blip) then RemoveBlip(blip) end end)
        return cb({ ok = true, found = true })
    end
    cb({ ok = false, error = 'Vehicule hors de portee du GPS' })
end)

RegisterNUICallback('gps:here', function(_, cb)
    local c = GetEntityCoords(PlayerPedId())
    cb({ x = c.x, y = c.y, z = c.z })
end)
