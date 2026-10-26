# OBSIDIAN OS · Telephone QBCore (inspire NoPixel V)

Palette : Obsidian Black `#171619` · Deep Burgundy `#762F43` · Warm Bone `#E9E0D5` · Plum Charcoal `#29242A`

## Dependances
- qb-core, oxmysql, pma-voice, screenshot-basic
- optionnel : qb-banking (releves + factures societe), qb-management

## Installation
1. Mets le dossier `obsidian_phone` dans `resources/[qb]/`.
2. Importe `sql/obsidian_phone.sql` dans ta base (tables prefixees `ophone_`, rien n'est ecrase).
3. **Retire / stoppe `qb-phone`** (meme item, meme touche).
4. `server.cfg` : `ensure obsidian_phone` APRES qb-core, oxmysql, pma-voice, screenshot-basic.
5. Dans `shared/config.lua` :
   - `Config.Upload` : mets ton token Fivemanage (ou passe `provider = 'discord'`, `url` = webhook, `field = 'files[]'`).
   - `Config.OpenKey` (defaut `M`), `Config.RequireItem` / `Config.PhoneItem` (defaut item `phone`).

## Touches (telephone ouvert)
T deplier (mode pliable) · Y accueil · U notifications · Entree valider · Retour arriere · Echap fermer · Q/E changer d'onglet
Appareil photo : clic droit maintenu = orienter, molette = zoom, Espace/F = photo, G = grille.

## Apps
Telephone (clavier, recents, contacts, 911/112/555 qui sonnent chez les metiers en service) · Appels video ·
Messages (groupes, photos, GPS, fiches contact, emojis) · Contacts (favoris, partage au joueur proche) ·
Appareil photo (arriere/selfie, .5/1x/3, grille, ratios 4:5 1:1 9:16, 11 filtres + intensite) · Galerie ·
Reglages (mode avion, ne pas deranger, silencieux, 5 sonneries generees, volume, 6 fonds + lien perso, 4 coques,
luminosite, 24h, code PIN, reinitialisation, assistant de configuration au premier demarrage) · App Store ·
Banque (solde qb, virements tel/ID compte meme hors ligne, factures, graphique 7 jours) ·
Crypto (6 coins, marche serveur persistant, achat/vente/envoi, graphiques) ·
Velvet Casino (Slots, Roulette europeenne, Blackjack 3:2, Crash, Mines, Dice + classement) ·
Garage (etat, essence, localiser) · Notes · Calculatrice · Services (message aux metiers + position) · Pulse (social) · Annonces.

## Securite / optimisation
- Tout l'argent passe par le serveur (`Player.Functions.AddMoney/RemoveMoney`), RNG casino 100% serveur, anti-spam par joueur.
- Zero boucle quand le telephone est ferme. Les threads ne tournent que telephone ouvert / camera active.
- Sonneries en WebAudio : aucun fichier son.

## Appel video : comment ca marche
FiveM ne permet pas de streamer la video d'un joueur a un autre. Le script envoie ~1 image/s (selfie cam, 240x426 jpg ~10 Ko)
via evenements latents. Reglable dans `Config.VideoCall` (FrameInterval, taille, qualite). Bouton camera pour couper.

## Exports serveur
```lua
exports.obsidian_phone:Notify(src, 'Titre', 'Texte', 'bank')
exports.obsidian_phone:NotifyNumber('5551234', 'Titre', 'Texte')
exports.obsidian_phone:CreateInvoice(targetSrc, 500, 'Reparation', 'mechanic', senderSrc)
exports.obsidian_phone:AddCrypto(citizenid, 'bolt', 2.5)
exports.obsidian_phone:GetCryptoPrice('bolt')
exports.obsidian_phone:IsInCall(src)
```
Commande : `/facture [id] [montant] [motif]` (joueur en service).

## Exports client
`exports.obsidian_phone:Open()`, `Close()`, `IsOpen()`

## Tester l'interface sans FiveM
Ouvre `html/index.html` via un petit serveur local (ex : `npx serve html`) : un faux serveur de demo se lance tout seul.
