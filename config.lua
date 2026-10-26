Config = {}

-- =========================================================
--  GENERAL
-- =========================================================
Config.Debug          = false
Config.OpenKey        = 'M'          -- touche d'ouverture (modifiable en jeu: Parametres > Raccourcis clavier FiveM)
Config.RequireItem    = true         -- il faut l'item pour utiliser le telephone
Config.PhoneItem      = 'phone'      -- nom de l'item QBCore
Config.UseGameTime    = true         -- horloge = heure du jeu (false = heure reelle)
Config.Prop           = `prop_npc_phone_02`
Config.Currency       = '$'

-- Comptes QBCore utilises
Config.MoneyAccount   = 'bank'       -- compte utilise pour Banque / Crypto / Casino / Factures

-- =========================================================
--  UPLOAD PHOTOS  (screenshot-basic)
--  provider = 'fivemanage' | 'discord' | 'custom'
-- =========================================================
Config.Upload = {
    provider = 'fivemanage',
    url      = 'https://api.fivemanage.com/api/image',
    field    = 'image',                       -- 'files[]' pour discord
    headers  = { Authorization = 'TON_TOKEN_FIVEMANAGE' },
    encoding = 'webp',
    quality  = 0.85,
}

-- =========================================================
--  APPAREIL PHOTO
-- =========================================================
Config.Camera = {
    Zooms   = { 0.5, 1.0, 3.0 },             -- .5 / 1x / 3
    BaseFov = 60.0,
    -- Filtres = timecycle modifiers GTA (modifiable)
    Filters = {
        { id = 'none',      label = 'None',      modifier = nil },
        { id = 'mono',      label = 'Mono',      modifier = 'NG_filmnoir_BW01' },
        { id = 'noir',      label = 'Noir',      modifier = 'NG_filmnoir_BW02' },
        { id = 'noirsoft',  label = 'Noir Soft', modifier = 'hud_def_desat_Neutral' },
        { id = 'cold',      label = 'Cold',      modifier = 'NG_filmic04' },
        { id = 'neutral',   label = 'Neutral',   modifier = 'NG_filmic01' },
        { id = 'crunch',    label = 'Crunch',    modifier = 'NG_filmic19' },
        { id = 'film1',     label = 'Film 1',    modifier = 'NG_filmic06' },
        { id = 'film2',     label = 'Film 2',    modifier = 'NG_filmic10' },
        { id = 'film3',     label = 'Film 3',    modifier = 'NG_filmic13' },
        { id = 'film4',     label = 'Film 4',    modifier = 'NG_filmic22' },
    },
}

-- =========================================================
--  APPELS / APPELS VIDEO  (pma-voice)
-- =========================================================
Config.Calls = {
    RingTimeout     = 30,       -- secondes avant appel manque
    CallChannelBase = 1000,     -- canal pma-voice = base + id
}

Config.VideoCall = {
    Enabled       = true,
    FrameInterval = 900,        -- ms entre deux images envoyees (plus haut = plus leger)
    FrameWidth    = 240,
    FrameHeight   = 426,
    FrameQuality  = 0.55,
}

-- Numeros speciaux : sonnent chez tous les joueurs en service du metier
Config.EmergencyNumbers = {
    ['911'] = { label = 'Urgences',  jobs = { 'police', 'ambulance' }, blip = true },
    ['112'] = { label = 'Urgences',  jobs = { 'police', 'ambulance' }, blip = true },
    ['555'] = { label = 'Depannage', jobs = { 'mechanic' },            blip = true },
}

-- App "Services" : metiers joignables
Config.Services = {
    { job = 'police',    label = 'LSPD',          icon = 'shield',  color = '#3b5b8c' },
    { job = 'ambulance', label = 'EMS',           icon = 'cross',   color = '#8c3b45' },
    { job = 'mechanic',  label = 'Mecano',        icon = 'wrench',  color = '#8c6a3b' },
    { job = 'taxi',      label = 'Taxi',          icon = 'car',     color = '#a38a2e' },
    { job = 'realestate',label = 'Immobilier',    icon = 'home',    color = '#3b8c6b' },
}

-- =========================================================
--  BANQUE  (qb-banking)
-- =========================================================
Config.Bank = {
    MaxTransfer     = 1000000,
    TransferFee     = 0.0,      -- 0.01 = 1%
    UseQBStatements = true,     -- ecrit aussi dans les releves qb-banking si dispo
}

-- =========================================================
--  CRYPTO
-- =========================================================
Config.Crypto = {
    TickInterval = 60,          -- secondes entre chaque variation de prix
    HistorySize  = 48,
    BuyFee       = 0.01,
    SellFee      = 0.01,
    Coins = {
        { id = 'bolt',  name = 'Boltcoin', symbol = 'BOLT', color = '#8B5CF6', price = 23.56,  volatility = 0.045, min = 2,   max = 400 },
        { id = 'ncho',  name = 'Nacho',    symbol = 'NCHO', color = '#F59E0B', price = 18.44,  volatility = 0.060, min = 1,   max = 300 },
        { id = 'ktl',   name = 'Kettle',   symbol = 'KTL',  color = '#22C55E', price = 41.63,  volatility = 0.030, min = 5,   max = 500 },
        { id = 'pstn',  name = 'Piston',   symbol = 'PSTN', color = '#0EA5E9', price = 69.74,  volatility = 0.035, min = 8,   max = 800 },
        { id = 'tide',  name = 'Tide',     symbol = 'TIDE', color = '#F43F5E', price = 34.88,  volatility = 0.050, min = 3,   max = 450 },
        { id = 'pxl',   name = 'Pixel',    symbol = 'PXL',  color = '#E879F9', price = 7.03,   volatility = 0.080, min = 0.2, max = 120 },
    },
}

-- =========================================================
--  CASINO EN LIGNE  (tout est calcule cote serveur)
-- =========================================================
Config.Casino = {
    MinBet   = 10,
    MaxBet   = 50000,
    Cooldown = 600,             -- ms anti-spam
    Slots = {
        -- symbol, poids, gain x mise pour 3 identiques
        Symbols = {
            { id = 'cherry',  weight = 34, pay3 = 4   },
            { id = 'lemon',   weight = 28, pay3 = 8   },
            { id = 'bell',    weight = 18, pay3 = 15  },
            { id = 'clover',  weight = 11, pay3 = 30  },
            { id = 'diamond', weight = 6,  pay3 = 75  },
            { id = 'seven',   weight = 3,  pay3 = 250 },
        },
        TwoCherries = 2,        -- 2 cerises = x2
    },
    Crash = { HouseEdge = 0.04, Growth = 0.075, MaxMultiplier = 100.0 },
    Mines = { HouseEdge = 0.03, Size = 25 },
    Dice  = { HouseEdge = 0.02 },
}

-- =========================================================
--  APPS
--  core = non supprimable | default = installee au premier demarrage
-- =========================================================
Config.Apps = {
    { id = 'phone',      core = true },
    { id = 'messages',   core = true },
    { id = 'contacts',   core = true },
    { id = 'camera',     core = true },
    { id = 'gallery',    core = true },
    { id = 'settings',   core = true },
    { id = 'store',      core = true },
    { id = 'bank',       default = true },
    { id = 'crypto',     default = true },
    { id = 'casino',     default = true },
    { id = 'garage',     default = true },
    { id = 'notes',      default = true },
    { id = 'calculator', default = true },
    { id = 'services',   default = true },
    { id = 'pulse',      default = false },
    { id = 'ads',        default = false },
}
