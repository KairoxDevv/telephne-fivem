-- =========================================================
--  BANQUE (relie a l'argent QBCore + qb-banking)
-- =========================================================
local QBCore = OPhone.QB

function OPhone.BankLog(src, cid, label, amount, kind)
    MySQL.insert('INSERT INTO ophone_bank_transactions (citizenid, label, amount, type) VALUES (?, ?, ?, ?)', { cid, label:sub(1, 120), math.floor(amount), kind })
    if Config.Bank.UseQBStatements and src and GetResourceState('qb-banking') == 'started' then
        pcall(function()
            exports['qb-banking']:CreateBankStatement(src, 'checking', math.floor(amount), label, kind == 'in' and 'deposit' or 'withdraw', 'player')
        end)
    end
end

-- Retire de l'argent au joueur (renvoie true/false)
function OPhone.Charge(Player, amount, reason)
    amount = math.floor(tonumber(amount) or 0)
    if amount <= 0 then return false end
    if (Player.PlayerData.money[Config.MoneyAccount] or 0) < amount then return false end
    if not Player.Functions.RemoveMoney(Config.MoneyAccount, amount, reason) then return false end
    OPhone.BankLog(Player.PlayerData.source, Player.PlayerData.citizenid, reason, amount, 'out')
    return true
end

function OPhone.Pay(Player, amount, reason)
    amount = math.floor(tonumber(amount) or 0)
    if amount <= 0 then return false end
    Player.Functions.AddMoney(Config.MoneyAccount, amount, reason)
    OPhone.BankLog(Player.PlayerData.source, Player.PlayerData.citizenid, reason, amount, 'in')
    return true
end

local function societyDeposit(society, amount, reason)
    if not society or society == '' then return end
    if GetResourceState('qb-banking') == 'started' then
        local ok = pcall(function() exports['qb-banking']:AddMoney(society, amount, reason) end)
        if ok then return end
    end
    if GetResourceState('qb-management') == 'started' then
        pcall(function() exports['qb-management']:AddMoney(society, amount) end)
    end
end

OPhone.Callback('bank:data', function(src)
    local Player = OPhone.GetPlayer(src)
    if not Player then return { ok = false } end
    local cid = Player.PlayerData.citizenid
    local tx = MySQL.query.await('SELECT id, label, amount, type, UNIX_TIMESTAMP(created_at) AS ts FROM ophone_bank_transactions WHERE citizenid = ? ORDER BY id DESC LIMIT 50', { cid }) or {}
    local inv = MySQL.query.await('SELECT id, label, amount, society, sender_name, UNIX_TIMESTAMP(created_at) AS ts FROM ophone_invoices WHERE citizenid = ? ORDER BY id DESC', { cid }) or {}
    return {
        ok = true,
        balance = Player.PlayerData.money.bank or 0,
        cash = Player.PlayerData.money.cash or 0,
        accountId = cid,
        iban = 'LS-' .. tostring(cid):upper(),
        name = OPhone.GetName(Player),
        job = Player.PlayerData.job.label,
        transactions = tx,
        invoices = inv,
    }
end)

OPhone.Callback('bank:transfer', function(src, data)
    local Player = OPhone.GetPlayer(src)
    if not Player then return { ok = false } end
    if not OPhone.Throttle(src, 'transfer', 2000) then return { ok = false, error = 'Patiente un instant' } end
    local amount = math.floor(tonumber(data.amount) or 0)
    if amount <= 0 or amount > Config.Bank.MaxTransfer then return { ok = false, error = 'Montant invalide' } end
    local note = OPhone.SanitizeText(data.note, 60)
    local target = tostring(data.target or ''):gsub('%s', '')
    target = target:gsub('^LS%-', ''):gsub('^ls%-', '')
    if target == '' then return { ok = false, error = 'Destinataire manquant' } end

    local Target
    if target:match('^%d+$') then Target = QBCore.Functions.GetPlayerByPhone(target) end
    if not Target then Target = QBCore.Functions.GetPlayerByCitizenId(target) or QBCore.Functions.GetPlayerByCitizenId(target:upper()) end

    local fee = math.floor(amount * Config.Bank.TransferFee)
    local total = amount + fee
    local myName = OPhone.GetName(Player)

    if Target then
        if Target.PlayerData.citizenid == Player.PlayerData.citizenid then return { ok = false, error = 'Impossible vers toi-meme' } end
        if not OPhone.Charge(Player, total, 'Virement a ' .. OPhone.GetName(Target) .. (note ~= '' and (' - ' .. note) or '')) then
            return { ok = false, error = 'Solde insuffisant' }
        end
        OPhone.Pay(Target, amount, 'Virement de ' .. myName .. (note ~= '' and (' - ' .. note) or ''))
        OPhone.Notify(Target.PlayerData.source, { app = 'bank', title = 'Virement recu', body = ('%s%s de %s'):format(Config.Currency, amount, myName) })
        return { ok = true, balance = Player.PlayerData.money.bank }
    end

    -- joueur hors-ligne : par citizenid
    local row = MySQL.single.await('SELECT citizenid, charinfo FROM players WHERE citizenid = ? LIMIT 1', { target:upper() })
    if not row then return { ok = false, error = 'Compte introuvable' } end
    if not OPhone.Charge(Player, total, 'Virement a ' .. row.citizenid) then return { ok = false, error = 'Solde insuffisant' } end
    MySQL.update.await("UPDATE players SET money = JSON_SET(money, '$.bank', CAST(JSON_EXTRACT(money, '$.bank') AS SIGNED) + ?) WHERE citizenid = ?", { amount, row.citizenid })
    OPhone.BankLog(nil, row.citizenid, 'Virement de ' .. myName, amount, 'in')
    return { ok = true, balance = Player.PlayerData.money.bank }
end)

OPhone.Callback('bank:payInvoice', function(src, data)
    local Player = OPhone.GetPlayer(src)
    if not Player then return { ok = false } end
    local inv = MySQL.single.await('SELECT * FROM ophone_invoices WHERE id = ? AND citizenid = ?', { tonumber(data.id), Player.PlayerData.citizenid })
    if not inv then return { ok = false, error = 'Facture introuvable' } end
    if not OPhone.Charge(Player, inv.amount, 'Facture : ' .. inv.label) then return { ok = false, error = 'Solde insuffisant' } end
    MySQL.update.await('DELETE FROM ophone_invoices WHERE id = ?', { inv.id })
    societyDeposit(inv.society, inv.amount, 'Facture payee : ' .. inv.label)
    if inv.sender_cid then
        local Sender = QBCore.Functions.GetPlayerByCitizenId(inv.sender_cid)
        if Sender then OPhone.Notify(Sender.PlayerData.source, { app = 'bank', title = 'Facture payee', body = ('%s a paye %s%s'):format(OPhone.GetName(Player), Config.Currency, inv.amount) }) end
    end
    return { ok = true, balance = Player.PlayerData.money.bank }
end)

-- =========================================================
--  FACTURES : export + commande
-- =========================================================
function OPhone.CreateInvoice(targetSrc, amount, label, society, senderSrc)
    local Target = OPhone.GetPlayer(targetSrc)
    amount = math.floor(tonumber(amount) or 0)
    if not Target or amount <= 0 then return false end
    local Sender = senderSrc and OPhone.GetPlayer(senderSrc) or nil
    MySQL.insert.await('INSERT INTO ophone_invoices (citizenid, label, amount, society, sender_name, sender_cid) VALUES (?, ?, ?, ?, ?, ?)', {
        Target.PlayerData.citizenid, OPhone.SanitizeText(label, 120), amount, society,
        Sender and OPhone.GetName(Sender) or society, Sender and Sender.PlayerData.citizenid or nil,
    })
    OPhone.Notify(targetSrc, { app = 'bank', title = 'Nouvelle facture', body = ('%s%s - %s'):format(Config.Currency, amount, label) })
    return true
end
exports('CreateInvoice', OPhone.CreateInvoice)

QBCore.Commands.Add('facture', 'Envoyer une facture (metier)', {
    { name = 'id', help = 'ID joueur' }, { name = 'montant', help = 'Montant' }, { name = 'motif', help = 'Motif' },
}, true, function(source, args)
    local Player = OPhone.GetPlayer(source)
    if not Player or Player.PlayerData.job.name == 'unemployed' or not Player.PlayerData.job.onduty then
        return TriggerClientEvent('QBCore:Notify', source, 'Tu dois etre en service', 'error')
    end
    local target, amount = tonumber(args[1]), tonumber(args[2])
    local label = table.concat(args, ' ', 3)
    if label == '' then label = Player.PlayerData.job.label end
    if not target or not amount or not OPhone.GetPlayer(target) then
        return TriggerClientEvent('QBCore:Notify', source, 'Parametres invalides', 'error')
    end
    if OPhone.CreateInvoice(target, amount, label, Player.PlayerData.job.name, source) then
        TriggerClientEvent('QBCore:Notify', source, 'Facture envoyee', 'success')
    end
end)
