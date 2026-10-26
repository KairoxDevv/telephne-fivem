-- =========================================================
--  GARAGE (player_vehicles QBCore)
-- =========================================================
OPhone.Callback('garage:list', function(src)
    local Player = OPhone.GetPlayer(src)
    if not Player then return {} end
    local rows = MySQL.query.await('SELECT vehicle, plate, garage, state, fuel, engine, body FROM player_vehicles WHERE citizenid = ?', { Player.PlayerData.citizenid }) or {}
    local shared = OPhone.QB.Shared.Vehicles or {}
    for _, r in ipairs(rows) do
        local v = shared[r.vehicle]
        r.label = v and ((v.brand and (v.brand .. ' ') or '') .. (v.name or r.vehicle)) or r.vehicle
        r.category = v and v.category or ''
        r.engine = math.floor((tonumber(r.engine) or 1000) / 10)
        r.body = math.floor((tonumber(r.body) or 1000) / 10)
        r.fuel = math.floor(tonumber(r.fuel) or 100)
        r.state = tonumber(r.state) or 1
    end
    return rows
end)
