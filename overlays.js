// Ecran verrouille + assistant de configuration + evenements globaux
import { bus } from './bus.js';
import { srv, post } from './bridge.js';
import { store, setSetting, addBadge, refreshContacts } from './store.js';
import { html, esc, $, fmtNumber } from './util.js';
import { icon } from './icons.js';
import { WALLPAPERS, wallpaperHTML } from './wallpapers.js';
import { screenEl, clockText, renderHome, OS, notify, openApp } from './os.js';
import { toast } from './ui.js';

// ------------------------------------------------------------- LOCK
let lockEl = null;
function showLock() {
  if (lockEl || !store.settings.lockEnabled || !store.settings.pin || store.unlocked) return;
  let entry = '';
  const d = new Date();
  lockEl = html(`<div class="layer lock">
    <div class="clock clock-live">${clockText().text}</div>
    <div class="lock-date">${d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
    <div class="pin-dots">${'<i></i>'.repeat(4)}</div>
    <div class="pinpad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button data-n="${n}">${n}</button>`).join('')}<span></span><button data-n="0">0</button><button class="ghost" data-n="del">Effacer</button></div>
  </div>`);
  const dots = lockEl.querySelector('.pin-dots');
  const paint = () => [...dots.children].forEach((d, i) => d.classList.toggle('on', i < entry.length));
  const press = (n) => {
    if (n === 'del') entry = entry.slice(0, -1);
    else if (entry.length < 4) entry += n;
    paint();
    if (entry.length === 4) {
      if (entry === store.settings.pin) { store.unlocked = true; lockEl.style.opacity = '0'; lockEl.style.transition = 'opacity .3s'; setTimeout(hideLock, 300); }
      else { dots.classList.add('shake'); setTimeout(() => { dots.classList.remove('shake'); entry = ''; paint(); }, 420); }
    }
  };
  lockEl.addEventListener('click', (e) => { const b = e.target.closest('[data-n]'); if (b) press(b.dataset.n); });
  lockEl._key = (k) => { if (/^\d$/.test(k)) press(k); if (k === 'backspace') press('del'); };
  screenEl.appendChild(lockEl);
}
function hideLock() { if (lockEl) { lockEl.remove(); lockEl = null; } }
bus.on('key', (k) => lockEl && lockEl._key(k));
bus.on('phone:open', () => { if (store.setupDone) showLock(); });
bus._overlayBack = () => !!lockEl; // pas de retour possible sur le lock

// ------------------------------------------------------------- SETUP
function runSetup() {
  if (OS.setupShown) return;
  OS.setupShown = true;
  const draft = { phoneName: `iFruit de ${store.me?.firstname || 'moi'}`, wallpaper: 'peaks', frame: 'obsidian', pin: '' };
  const el = html(`<div class="layer setup"></div>`);
  screenEl.appendChild(el);
  let step = 0;
  const steps = [
    () => `<div class="step"><div class="hello">Bien<br>venue<em>.</em></div>
      <p>Obsidian OS est pret. Trois reglages et ton telephone est a toi.</p>
      <div class="row" style="margin-top:26px"><div class="avatar">${icon('phone')}</div><div class="r-main"><div class="r-title">Ton numero</div><div class="r-sub">${esc(fmtNumber(store.me?.number))}</div></div></div>
      <div class="foot"><button class="btn primary" data-s="next">Commencer</button></div></div>`,
    () => `<div class="step"><div class="section-title" style="margin-top:30px">Nom de l'appareil</div>
      <input class="input" id="su-name" maxlength="30" value="${esc(draft.phoneName)}" />
      <div class="section-title">Coque</div>
      <div style="display:flex;gap:10px">${[['obsidian', '#171619'], ['burgundy', '#762F43'], ['bone', '#E9E0D5'], ['plum', '#29242A']].map(([id, c]) => `<button data-frame="${id}" style="width:52px;height:52px;border-radius:16px;background:${c};border:3px solid ${draft.frame === id ? 'var(--burg-hi)' : 'var(--plum-3)'}"></button>`).join('')}</div>
      <div class="foot"><button class="btn" data-s="prev">Retour</button><button class="btn primary" data-s="next">Suivant</button></div></div>`,
    () => `<div class="step"><div class="section-title" style="margin-top:30px">Fond d'ecran</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">${Object.entries(WALLPAPERS).map(([id, w]) => `<button data-wp="${id}" style="position:relative;height:150px;border-radius:14px;overflow:hidden;border:3px solid ${draft.wallpaper === id ? 'var(--burg-hi)' : 'transparent'}">${wallpaperHTML(id)}<span style="position:absolute;left:8px;bottom:6px;font-size:12px;font-weight:700">${w.label}</span></button>`).join('')}</div>
      <div class="foot"><button class="btn" data-s="prev">Retour</button><button class="btn primary" data-s="next">Suivant</button></div></div>`,
    () => `<div class="step"><div class="section-title" style="margin-top:30px">Code de verrouillage</div>
      <p style="margin-top:0">4 chiffres. Laisse vide pour ne pas verrouiller.</p>
      <input class="input" id="su-pin" maxlength="4" inputmode="numeric" placeholder="----" value="${esc(draft.pin)}" style="font-size:28px;letter-spacing:.6em;text-align:center;height:64px;margin-top:14px" />
      <div class="foot"><button class="btn" data-s="prev">Retour</button><button class="btn primary" data-s="next">Suivant</button></div></div>`,
    () => `<div class="step"><div class="hello">C'est<br>parti<em>.</em></div>
      <p>Astuce : <b>T</b> deplie l'ecran, <b>U</b> ouvre les notifications, <b>Y</b> revient a l'accueil.</p>
      <div class="foot"><button class="btn primary" data-s="done">Terminer</button></div></div>`,
  ];
  const render = () => {
    el.innerHTML = `<div class="progress">${steps.map((_, i) => `<i class="${i <= step ? 'on' : ''}"></i>`).join('')}</div>${steps[step]()}`;
  };
  const collect = () => {
    const n = el.querySelector('#su-name'); if (n) draft.phoneName = n.value.trim().slice(0, 30);
    const p = el.querySelector('#su-pin'); if (p) draft.pin = p.value.replace(/\D/g, '').slice(0, 4);
  };
  el.addEventListener('click', async (e) => {
    const fr = e.target.closest('button[data-frame]'); if (fr) { collect(); draft.frame = fr.dataset.frame; document.getElementById('phone').dataset.frame = draft.frame; render(); return; }
    const wp = e.target.closest('[data-wp]'); if (wp) { draft.wallpaper = wp.dataset.wp; render(); return; }
    const s = e.target.closest('[data-s]')?.dataset.s;
    if (!s) return;
    collect();
    if (s === 'next') { step++; render(); }
    if (s === 'prev') { step--; render(); }
    if (s === 'done') {
      if (draft.pin && draft.pin.length !== 4) { toast('Le code doit faire 4 chiffres', true); step = 3; render(); return; }
      Object.assign(store.settings, { phoneName: draft.phoneName, wallpaper: draft.wallpaper, frame: draft.frame, pin: draft.pin, lockEnabled: !!draft.pin });
      store.setupDone = true;
      store.unlocked = true;
      await srv('saveSettings', { settings: store.settings, setupDone: true });
      bus.emit('settings', { key: 'wallpaper' });
      el.style.transition = 'opacity .35s'; el.style.opacity = '0';
      setTimeout(() => { el.remove(); OS.setupShown = false; renderHome(); }, 350);
    }
  });
  render();
}
bus.on('phone:open', () => { if (!store.setupDone) runSetup(); });
bus.on('setup:run', () => { store.setupDone = false; runSetup(); });

// ------------------------------------------------------------- EVENEMENTS GLOBAUX
bus.on('message', ({ message, notify: n }) => {
  bus.emit('messages:new', message);
  const viewing = OS.open && OS.current && OS.current.app.id === 'messages' && OS.current.ctx._conv === message.conversation;
  if (!viewing) {
    addBadge('messages', 1);
    if (n) notify({ ...n, payload: { conversation: message.conversation } });
  }
});

bus.on('contactOffer', (c) => {
  notify({
    app: 'contacts', title: 'Carte de contact', body: `${c.name} veut partager son numero`, sticky: true,
    actions: [{ label: 'Enregistrer', run: async () => { await srv('contacts:save', { name: c.name, number: c.number }); refreshContacts(); toast('Contact ajoute'); } }],
  });
});

bus.on('cryptoTick', (m) => { store.market = m; });
