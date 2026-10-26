fx_version 'cerulean'
game 'gta5'
lua54 'yes'

name 'obsidian_phone'
author 'Obsidian Labs'
description 'Obsidian OS - Telephone complet QBCore (NoPixel V inspired)'
version '1.0.0'

shared_scripts {
    'shared/config.lua',
    'shared/utils.lua',
}

client_scripts {
    'client/main.lua',
    'client/camera.lua',
    'client/calls.lua',
    'client/apps.lua',
}

server_scripts {
    '@oxmysql/lib/MySQL.lua',
    'server/main.lua',
    'server/calls.lua',
    'server/messages.lua',
    'server/bank.lua',
    'server/crypto.lua',
    'server/casino.lua',
    'server/social.lua',
    'server/garage.lua',
}

ui_page 'html/index.html'

files {
    'html/index.html',
    'html/css/*.css',
    'html/js/*.js',
    'html/js/core/*.js',
    'html/js/apps/*.js',
}

dependencies {
    'qb-core',
    'oxmysql',
    'pma-voice',
    'screenshot-basic',
}
