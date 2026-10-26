import { bus } from './bus.js';
import { post, srv, IS_GAME } from './bridge.js';
import { store, setSetting, setBadge, addBadge, refreshContacts, DEFAULT_SETTINGS } from './store.js';
import { html, esc, $, $$, on, timeAgo, setCurrency } from './util.js';
import { icon } from './icons.js';
import { wallpaperHTML } from './wallpapers.js';
import { setHost, toast, closeTopSheet } from './ui.js';
import { notifSound } from './sounds.js';

export const APPS = new Map();
export function registerApp(def) { APPS.set(def.id, def); }

const S = {
  open: false,
  peek: false,
  peekTimer: null,
  current: null,      // { app, view, stack: [], cleanups: [] }
  folded: true,
  ncOpen: false,
  islandTimer: null,
  setupShown: false,
};
export const OS = S;

// ------------------------------------------------------------- shell
const root = document.getElementById('ophone-root');
root.innerHTML = `
<div class="stage" id="stage">
  <div class="hints" id="hints">
    <div class="hint" data-key="t"><kbd>T</kbd>Deplier</div>
    <div class="hint" data-key="y"><kbd>Y</kbd>Accueil</div>
    <div class="hint" data-key="u"><kbd>U</kbd>Notifications</div>
    <div class="hint" data-key="enter"><kbd>&#8629;</kbd>Valider</div>
    <div class="hint" data-key="backspace"><kbd>&larr;</kbd>Retour</div>
    <div class="hint" data-key="escape"><kbd>ESC</kbd>Fermer</div>
  </div>
  <div class="phone" id="phone" data-frame="obsidian">
    <div class="screen-wrap" id="screen">
      <div class="wallpaper" id="wallpaper"></div>
      <div class="layer home" id="home"></div>
      <div class="layer apps" id="apps"></div>
      <div class="ncenter" id="ncenter"></div>
      <div class="statusbar" id="statusbar">
        <span id="sb-time">12:00</span>
        <span class="icons" id="sb-icons"></span>
      </div>
      <div class="island" id="island"><span class="island-timer" id="island-timer"></span><span class="cam-dot"></span><div class="note" id="island-note"></div></div>
      <div class="homebar" id="homebar"></div>
      <div class="brightness" id="brightness"></div>
    </div>
    <div class="hinge"></div>
  </div>
</div>`;

const stage = $('#stage'), phone = $('#phone'), screen = $('#screen');
const homeEl = $('#home'), appsEl = $('#apps'), island = $('#island');
setHost(screen);
export const screenEl = screen;

// ------------------------------------------------------------- scale
function rescale() {
  const w = S.folded ? 392 : 760;
  const s = Math.min(1, (window.innerHeight * 0.88) / 820, (window.innerWidth * 0.9) / (w + 200));
  document.documentElement.style.setProperty('--scale', s.toFixed(3));
}
window.addEventListener('resize', rescale);
rescale();

// ------------------------------------------------------------- horloge / statut
export function clockText() {
  const t = store.time;
  let h, m;
  if (t.game) { h = t.h; m = t.m; } else { const d = new Date(); h = d.getHours(); m = d.getMinutes(); }
  const mm = String(m).padStart(2, '0');
  if (store.settings.clock24) return { text: `${String(h).padStart(2, '0')}:${mm}`, h, m };
  const ap = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return { text: `${h12}:${mm} ${ap}`, h, m };
}

function renderStatus() {
  $('#sb-time').textContent = clockText().text;
  const st = store.settings;
  $('#sb-icons').innerHTML = (st.airplane ? `<span class="plane">${icon('plane')}</span>` : `${signal()}${icon('wifi')}`)
    + (st.dnd ? icon('moon') : '') + battery();
  $$('.clock-live').forEach((el) => { el.textContent = clockText().text; });
  const z = $('#zone'); if (z) { z.textContent = store.zone || 'Los Santos'; z.classList.toggle('hide', !st.showZone); }
}
const signal = () => `<svg viewBox="0 0 18 14" fill="currentColor"><rect x="0" y="9" width="3" height="5" rx="1"/><rect x="5" y="6" width="3" height="8" rx="1"/><rect x="10" y="3" width="3" height="11" rx="1"/><rect x="15" y="0" width="3" height="14" rx="1" opacity=".4"/></svg>`;
const battery = () => `<svg viewBox="0 0 26 13" fill="none"><rect x=".75" y=".75" width="21.5" height="11.5" rx="3.5" stroke="currentColor" stroke-opacity=".5" stroke-width="1.5"/><rect x="3" y="3" width="15" height="7" rx="1.6" fill="currentColor"/><rect x="23.5" y="4" width="2" height="5" rx="1" fill="currentColor" fill-opacity=".5"/></svg>`;

// ------------------------------------------------------------- apparence
function applyLook() {
  const st = store.settings;
  phone.dataset.frame = st.frame || 'obsidian';
  $('#wallpaper').innerHTML = wallpaperHTML(st.wallpaper, st.customWallpaper);
  $('#brightness').style.opacity = String(Math.max(0, Math.min(0.7, 1 - (st.brightness ?? 1))));
  $('#hints').classList.toggle('hide', !st.hints);
  renderStatus();
}

// ------------------------------------------------------------- accueil
function orderedApps() {
  const installed = store.apps.filter((id) => APPS.has(id));
  const order = (store.settings.order && store.settings.order.length) ? store.settings.order : DEFAULT_ORDER;
  return installed.sort((a, b) => {
    const ia = order.indexOf(a), ib = order.indexOf(b);
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
  });
}
const DEFAULT_ORDER = ['settings', 'garage', 'calculator', 'gallery', 'bank', 'crypto', 'casino', 'notes', 'services', 'pulse', 'ads'];
const DOCK = ['phone', 'messages', 'contacts', 'store', 'camera'];

export function renderHome() {
  const c = clockText().text;
  const list = orderedApps().filter((id) => !DOCK.includes(id));
  homeEl.innerHTML = `
    <div class="home-inner">
      <div class="clock-wrap">
        <div class="clock-ghost clock-live">${c}</div>
        <div class="clock clock-live">${c}</div>
        <div class="zone ${store.settings.showZone ? '' : 'hide'}" id="zone">${esc(store.zone || 'Los Santos')}</div>
      </div>
      <div class="grid">
        ${list.map((id, i) => {
          const a = APPS.get(id);
          const b = store.badges[id];
          return `<button class="app-ico" data-app="${id}" style="animation-delay:${i * 22}ms">
            <span class="tile" style="background:${a.bg};color:${a.fg}">${icon(a.icon)}</span>
            <span class="label">${esc(a.name)}</span>
            ${b ? `<span class="badge">${b > 99 ? '99+' : b}</span>` : ''}
          </button>`;
        }).join('')}
      </div>
    </div>
    <div class="dock">
      ${DOCK.filter((id) => store.apps.includes(id) && APPS.has(id)).map((id) => {
        const b = store.badges[id];
        return `<button data-app="${id}" title="${esc(APPS.get(id).name)}">${icon(APPS.get(id).icon)}${b ? `<span class="badge">${b}</span>` : ''}</button>`;
      }).join('')}
    </div>`;
}
on(homeEl, 'click', '[data-app]', (e, t) => openApp(t.dataset.app));

// ------------------------------------------------------------- navigation apps
function makeCtx(app, view) {
  const cur = { app, view, stack: [], cleanups: [], tabs: null };
  const ctx = {
    app, root: view, store,
    push(render, opts = {}) {
      const scr = html(`<div class="screen ${cur.stack.length && !opts.noAnim ? 'push-in' : ''}"></div>`);
      scr.style.background = opts.bg || '';
      const prev = cur.stack[cur.stack.length - 1];
      if (prev) prev.el.style.display = 'none';
      view.appendChild(scr);
      const entry = { el: scr, cleanup: null, onShow: null };
      cur.stack.push(entry);
      entry.cleanup = render(scr, ctx, entry) || null;
      return entry;
    },
    back() {
      if (cur.stack.length <= 1) return goHome();
      const top = cur.stack.pop();
      top.cleanup && top.cleanup();
      top.el.classList.add('pop-out');
      setTimeout(() => top.el.remove(), 260);
      const prev = cur.stack[cur.stack.length - 1];
      prev.el.style.display = '';
      prev.onShow && prev.onShow();
    },
    replace(render) {
      const top = cur.stack.pop();
      if (top) { top.cleanup && top.cleanup(); top.el.remove(); }
      return ctx.push(render, { noAnim: true });
    },
    home: () => goHome(),
    open: (id, payload) => openApp(id, payload),
    on(evt, fn) { const off = bus.on(evt, fn); cur.cleanups.push(off); return off; },
    tabs(def) { cur.tabs = def; },
    srv, post, toast,
  };
  cur.ctx = ctx;
  return cur;
}

export function openApp(id, payload) {
  const app = APPS.get(id);
  if (!app) return;
  if (!store.apps.includes(id) && !app.hidden) { toast('Application non installee', true); return; }
  closeNC();
  if (S.current && S.current.app.id === id && payload === undefined) return;
  closeCurrent(true);
  const view = html(`<div class="app-view" data-app="${id}"></div>`);
  if (app.viewBg) view.style.background = app.viewBg;
  appsEl.appendChild(view);
  const cur = makeCtx(app, view);
  S.current = cur;
  homeEl.classList.add('behind');
  app.mount(cur.ctx, payload);
  updateChrome();
}

function closeCurrent(instant = false) {
  const cur = S.current;
  if (!cur) return;
  cur.stack.forEach((s) => s.cleanup && s.cleanup());
  cur.cleanups.forEach((off) => off());
  cur.app.unmount && cur.app.unmount(cur.ctx);
  S.current = null;
  screen.classList.remove('cam-mode');
  if (instant) cur.view.remove();
  else { cur.view.classList.add('leaving'); setTimeout(() => cur.view.remove(), 300); }
}

export function goHome() {
  closeNC();
  closeTopSheet();
  if (S.current) closeCurrent();
  homeEl.classList.remove('behind');
  renderHome();
  updateChrome();
}

export function goBack() {
  if (closeTopSheet()) return;
  if (S.ncOpen) return closeNC();
  if (bus._overlayBack && bus._overlayBack()) return;
  if (S.current) S.current.ctx.back();
}

// la barre de statut / home bar passent en sombre sur les apps claires
export function updateChrome() {
  const light = S.current && S.current.app.light;
  $('#statusbar').classList.toggle('dark', !!light);
  $('#homebar').classList.toggle('dark', !!light);
}
$('#homebar').addEventListener('click', () => goHome());

// ------------------------------------------------------------- pliage
export function toggleFold() {
  S.folded = !S.folded;
  phone.classList.toggle('unfold', !S.folded);
  rescale();
}

// ------------------------------------------------------------- notifications
const APP_ICON = (app) => {
  const a = APPS.get(app);
  return a ? { ic: a.icon, bg: a.bg, fg: a.fg } : { ic: 'bell', bg: 'var(--burg)', fg: 'var(--bone)' };
};

export function showIsland(n, ms = 4200) {
  const { ic, bg, fg } = APP_ICON(n.app);
  $('#island-note').innerHTML = `<span class="n-ico" style="background:${bg};color:${fg}">${icon(ic)}</span>
    <span class="n-txt"><div class="n-title">${esc(n.title || '')}</div><div class="n-body">${esc(store.settings.previews ? (n.body || '') : 'Nouveau contenu')}</div></span>`;
  island.classList.add('expanded');
  island.onclick = () => { island.classList.remove('expanded'); if (n.onClick) n.onClick(); else if (n.app && APPS.has(n.app)) openApp(n.app, n.payload); };
  clearTimeout(S.islandTimer);
  if (ms) S.islandTimer = setTimeout(() => island.classList.remove('expanded'), ms);
  if (!S.open) peek(ms || 5000);
}
export function hideIsland() { island.classList.remove('expanded'); }

export function peek(ms) {
  if (S.open) return;
  stage.classList.add('peek');
  clearTimeout(S.peekTimer);
  if (ms) S.peekTimer = setTimeout(() => stage.classList.remove('peek'), ms);
}
export function unpeek() { clearTimeout(S.peekTimer); stage.classList.remove('peek'); }

export function notify(n) {
  if (!n) return;
  if (store.settings.airplane) return;
  const entry = { id: Date.now() + Math.random(), ts: Date.now() / 1000, ...n };
  store.notifications.unshift(entry);
  store.notifications = store.notifications.slice(0, 60);
  if (n.badge) addBadge(n.app, n.badge);
  bus.emit('notifications');
  const inApp = S.open && S.current && S.current.app.id === n.app && !n.sticky;
  if (store.settings.dnd && !n.sticky) return;
  if (!n.silent || !inApp) {
    if (!inApp) showIsland(n);
    if (!n.silent) notifSound();
  }
}

function renderNC() {
  const nc = $('#ncenter');
  const list = store.notifications;
  nc.innerHTML = `<div class="nc-head"><h1>Notifications</h1><button class="btn" style="height:34px;font-size:13px" data-nc="clear">Tout effacer</button></div>
  <div class="nc-list">${list.length ? list.map((n, i) => {
    const { ic, bg, fg } = APP_ICON(n.app);
    return `<div class="ncard" data-i="${i}" style="animation-delay:${i * 25}ms">
      <span class="n-ico" style="background:${bg};color:${fg}">${icon(ic)}</span>
      <div style="flex:1;min-width:0"><div style="display:flex;gap:8px"><div class="n-title">${esc(n.title || '')}</div><div class="n-time">${timeAgo(n.ts)}</div></div>
      <div class="n-body">${esc(n.body || '')}</div>
      ${n.gps || n.number || n.actions ? `<div class="n-actions">
        ${n.gps ? `<button class="btn primary" data-nc="gps" data-i="${i}">${icon('pin')}GPS</button>` : ''}
        ${n.number ? `<button class="btn" data-nc="call" data-i="${i}">${icon('phone')}Rappeler</button>` : ''}
        ${(n.actions || []).map((a, k) => `<button class="btn ${k === 0 ? 'primary' : ''}" data-nc="act" data-i="${i}" data-k="${k}">${esc(a.label)}</button>`).join('')}
      </div>` : ''}</div></div>`;
  }).join('') : `<div class="empty">${icon('bell')}Rien de neuf</div>`}</div>`;
}
on($('#ncenter'), 'click', '[data-nc]', (e, t) => {
  e.stopPropagation();
  const n = store.notifications[+t.dataset.i];
  const a = t.dataset.nc;
  if (a === 'clear') { store.notifications = []; renderNC(); return; }
  if (!n) return;
  if (a === 'gps') post('waypoint', n.gps);
  if (a === 'call') bus.emit('ui:call', { number: n.number });
  if (a === 'act') { n.actions[+t.dataset.k].run(); store.notifications.splice(+t.dataset.i, 1); renderNC(); }
});
on($('#ncenter'), 'click', '.ncard', (e, t) => {
  if (e.target.closest('[data-nc]')) return;
  const n = store.notifications[+t.dataset.i];
  if (n && n.app && APPS.has(n.app)) { closeNC(); openApp(n.app, n.payload); }
});

export function toggleNC() { S.ncOpen ? closeNC() : openNC(); }
function openNC() { renderNC(); S.ncOpen = true; $('#ncenter').classList.add('open'); }
function closeNC() { S.ncOpen = false; $('#ncenter').classList.remove('open'); }
bus.on('notifications', () => { if (S.ncOpen) renderNC(); });

// ------------------------------------------------------------- open / close
export function openPhone(data = {}) {
  S.open = true;
  unpeek();
  stage.classList.add('open');
  if (data.time) store.time = data.time;
  if (data.zone) store.zone = data.zone;
  renderStatus();
  hideIsland();
  bus.emit('phone:open', data);
  if (!S.current) renderHome();
  if (data.app) openApp(data.app, data.payload);
}

export function closePhone() {
  S.open = false;
  stage.classList.remove('open', 'peek');
  document.activeElement && document.activeElement.blur && document.activeElement.blur();
  closeNC();
  closeTopSheet();
  store.unlocked = false;
  if (S.current && S.current.app.closeOnHide) goHome();
  bus.emit('phone:close');
}

export function requestClose() {
  if (IS_GAME) post('close'); else closePhone();
}

// ------------------------------------------------------------- clavier
const isTyping = () => document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
function handleKey(k, e) {
  if (k === 'escape') { e && e.preventDefault(); if (isTyping()) { document.activeElement.blur(); return; } requestClose(); return; }
  if (isTyping()) return;
  switch (k) {
    case 't': toggleFold(); break;
    case 'y': goHome(); break;
    case 'u': toggleNC(); break;
    case 'backspace': e && e.preventDefault(); goBack(); break;
    case 'q': case 'e': {
      const tabs = S.current && S.current.tabs;
      if (tabs) tabs.change(k === 'q' ? -1 : 1);
      break;
    }
    case 'enter': {
      const f = document.activeElement;
      if (f && f !== document.body && f.click) { e && e.preventDefault(); f.click(); }
      break;
    }
    default: bus.emit('key', k);
  }
}
window.addEventListener('keydown', (e) => {
  if (!S.open) return;
  handleKey(e.key.toLowerCase(), e);
});
on($('#hints'), 'click', '[data-key]', (e, t) => handleKey(t.dataset.key));

// ------------------------------------------------------------- events Lua
bus.on('boot', (data) => {
  store.me = data.me;
  store.settings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
  store.apps = data.apps || [];
  store.badges = data.badges || {};
  store.config = { ...store.config, ...(data.config || {}) };
  store.setupDone = !!data.setupDone;
  setCurrency(store.config.currency);
  applyLook();
  renderHome();
  refreshContacts();
  bus.emit('booted', data);
});
bus.on('open', openPhone);
bus.on('close', closePhone);
bus.on('reset', () => { goHome(); store.notifications = []; });
bus.on('status', (d) => {
  if (d.time) store.time = d.time;
  if (d.zone) store.zone = d.zone;
  renderStatus();
});
bus.on('notify', (n) => notify(n));
bus.on('settings', ({ key }) => {
  applyLook();
  if (['clock24', 'showZone', 'order'].includes(key) && !S.current) renderHome();
});
bus.on('badges', () => { if (!S.current) renderHome(); });
bus.on('apps', () => { if (!S.current) renderHome(); });

// horloge temps reel si pas d'heure de jeu
setInterval(() => { if (S.open && !store.time.game) renderStatus(); }, 15000);

export { setSetting, setBadge, addBadge };
