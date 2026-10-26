OPhone = OPhone or {}

function OPhone.Round(n, d)
    local m = 10 ^ (d or 0)
    return math.floor(n * m + 0.5) / m
end

function OPhone.Clamp(v, a, b)
    if v < a then return a elseif v > b then return b end
    return v
end

function OPhone.Debug(...)
    if Config.Debug then print('^5[obsidian_phone]^7', ...) end
end

function OPhone.SanitizeText(str, maxLen)
    if type(str) ~= 'string' then return '' end
    str = str:gsub('[%c]', ' ')
    if #str > (maxLen or 500) then str = str:sub(1, maxLen or 500) end
    return str
end

function OPhone.SanitizeNumber(str)
    if type(str) ~= 'string' and type(str) ~= 'number' then return nil end
    str = tostring(str):gsub('[^%d]', '')
    if #str < 3 or #str > 15 then return nil end
    return str
end
