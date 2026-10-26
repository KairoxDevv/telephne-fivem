import { T } from './_tiles.js';
import { icon } from '../core/icons.js';
import { esc, fmtNumber, avatar } from '../core/util.js';
import { store, setSetting } from '../core/store.js';
import { topbar, toast, confirmBox, form, result } from '../core/ui.js';
import { RINGTONES, NOTIF_SOUNDS, previewRing, stopRing } from '../core/sounds.js';
import { WALLPAPERS, wallpaperHTML } from '../core/wallpapers.js';
import { bus } from '../core/bus.js';
import { post } from '../core/bridge.js';

const FRAMES = [['obsidian', 'Obsidian', '#171619'], ['burgundy', 'Burgundy', '#762F43'], ['bone', 'Bone', '#E9E0D5'], ['plum', 'Plum', '#29242A']];

const tog = (key, label, ic, sub = '') => `<div class="row set" data-tog="${key}">
  <span class="set-ico">${icon(ic)}</span><div class="r-main"><div class="r-title">${label}</div>${sub ? `<div class="r-sub">${sub}</div>` : ''}</div>
  <span class="toggle ${store.settings[key] ? 'on' : ''}"></span></div>`;
const link = (page, label, ic, value = '') => `<button class="row set" data-page="${page}">
  <span class="set-ico">${icon(ic)}</span><div class="r-main"><div class="r-title">${label}</div></div>
  <span class="r-end">${esc(value)} ›</span></button>`;

function page(ctx, title, renderFn) {
  ctx.push((el) => {
    const draw = () => { el.innerHTML = `${topbar(title)}<div class="body">${renderFn()}</div>`; };
    el.addEventListener('click', (e) => el._click && el._click(e, draw));
    el.addEventListener('input', (e) => el._input && el._input(e, draw));
    draw();
    return () => stopRing();
  });
  return ctx;
}

const PAGES = {
  sounds(ctx) {
    page(ctx, 'Sons', () => `
      ${tog('silent', 'Mode silencieux', 'bellOff')}
      <div class="section-title">Volume</div>
      <div class="row"><span class="set-ico">${icon('volume')}</span><input type="range" min="0" max="1" step="0.05" value="${store.settings.volume}" data-range="volume"></div>
      <div class="section-title">Sonnerie</div>
      <div class="list">${Object.entries(RINGTONES).map(([id, r]) => `<button class="row" data-ring="${id}"><div class="r-main"><div class="r-title">${r.label}</div></div>${store.settings.ringtone === id ? `<span class="chip burg">${icon('check', 'style="width:14px"')}</span>` : ''}</button>`).join('')}</div>
      <div class="section-title">Notifications</div>
      <div class="list">${Object.entries(NOTIF_SOUNDS).map(([id, r]) => `<button class="row" data-ns="${id}"><div class="r-main"><div class="r-title">${r.label}</div></div>${store.settings.notifSound === id ? `<span class="chip burg">${icon('check', 'style="width:14px"')}</span>` : ''}</button>`).join('')}</div>`);
    const el = ctx.root.lastElementChild;
    el._click = (e, draw) => {
      const r = e.target.closest('[data-ring]'); if (r) { setSetting('ringtone', r.dataset.ring); previewRing(r.dataset.ring); draw(); }
      const n = e.target.closest('[data-ns]'); if (n) { setSetting('notifSound', n.dataset.ns); NOTIF_SOUNDS[n.dataset.ns].play(); draw(); }
      const t = e.target.closest('[data-tog]'); if (t) { setSetting(t.dataset.tog, !store.settings[t.dataset.tog]); draw(); }
    };
    el._input = (e) => { const k = e.target.dataset.range; if (k) setSetting(k, +e.target.value); };
  },
  wallpaper(ctx) {
    page(ctx, "Fond d'ecran", () => `
      <div class="wp-grid">${Object.entries(WALLPAPERS).map(([id, w]) => `<button class="wp ${store.settings.wallpaper === id ? 'on' : ''}" data-wp="${id}">${wallpaperHTML(id)}<span>${w.label}</span></button>`).join('')}
      ${store.settings.customWallpaper ? `<button class="wp ${store.settings.wallpaper === 'custom' ? 'on' : ''}" data-wp="custom">${wallpaperHTML('custom', store.settings.customWallpaper)}<span>Perso</span></button>` : ''}</div>
      <button class="btn block" style="margin-top:14px" data-a="url">${icon('image')}Lien d'image personnalise</button>`);
    const el = ctx.root.lastElementChild;
    el._click = async (e, draw) => {
      const w = e.target.closest('[data-wp]'); if (w) { setSetting('wallpaper', w.dataset.wp); draw(); }
      if (e.target.closest('[data-a="url"]')) {
        const d = await form("Fond d'ecran", [{ name: 'url', label: 'Lien https (png/jpg/webp)', value: store.settings.customWallpaper, max: 400 }]);
        if (d && /^https:\/\//.test(d.url)) { setSetting('customWallpaper', d.url); setSetting('wallpaper', 'custom'); draw(); } else if (d) toast('Lien https requis', true);
      }
    };
  },
  display(ctx) {
    page(ctx, 'Affichage', () => `
      <div class="section-title">Luminosite</div>
      <div class="row"><span class="set-ico">${icon('sun')}</span><input type="range" min="0.35" max="1" step="0.05" value="${store.settings.brightness}" data-range="brightness"></div>
      <div class="section-title">Coque</div>
      <div class="frame-pick">${FRAMES.map(([id, l, c]) => `<button data-frame="${id}" class="${store.settings.frame === id ? 'on' : ''}"><i style="background:${c}"></i>${l}</button>`).join('')}</div>
      <div class="section-title">Ecran d'accueil</div>
      ${tog('clock24', 'Format 24 heures', 'clock')}
      ${tog('showZone', 'Afficher le quartier', 'pin', 'Sous l\'horloge')}
      ${tog('hints', 'Raccourcis clavier visibles', 'keyboard', 'T · Y · U · Entree · Retour · Echap')}
      ${tog('previews', 'Apercu des notifications', 'bell')}`);
    const el = ctx.root.lastElementChild;
    el._click = (e, draw) => {
      const f = e.target.closest('button[data-frame]'); if (f) { setSetting('frame', f.dataset.frame); draw(); }
      const t = e.target.closest('[data-tog]'); if (t) { setSetting(t.dataset.tog, !store.settings[t.dataset.tog]); draw(); }
    };
    el._input = (e) => { const k = e.target.dataset.range; if (k) setSetting(k, +e.target.value); };
  },
  security(ctx) {
    page(ctx, 'Code & securite', () => `
      ${tog('lockEnabled', 'Verrouiller avec un code', 'lock', store.settings.pin ? 'Code defini' : 'Aucun code')}
      <button class="btn block" style="margin-top:12px" data-a="pin">${icon('edit')}${store.settings.pin ? 'Changer le code' : 'Definir un code'}</button>`);
    const el = ctx.root.lastElementChild;
    el._click = async (e, draw) => {
      const t = e.target.closest('[data-tog]');
      if (t) { if (!store.settings.pin) { toast("Definis d'abord un code", true); return; } setSetting('lockEnabled', !store.settings.lockEnabled); draw(); }
      if (e.target.closest('[data-a="pin"]')) {
        const d = await form('Code a 4 chiffres', [{ name: 'pin', label: 'Nouveau code', type: 'password', max: 4 }]);
        if (d && /^\d{4}$/.test(d.pin)) { setSetting('pin', d.pin); setSetting('lockEnabled', true); toast('Code enregistre'); draw(); } else if (d) toast('4 chiffres requis', true);
      }
    };
  },
  about(ctx) {
    const me = store.me || {};
    page(ctx, 'A propos', () => `<div class="list">
      <div class="row"><div class="r-main"><div class="r-sub">Nom de l'appareil</div><div class="r-title">${esc(store.settings.phoneName || 'Obsidian')}</div></div><button class="icon-btn" data-a="rename">${icon('edit')}</button></div>
      <div class="row"><div class="r-main"><div class="r-sub">Numero</div><div class="r-title">${esc(fmtNumber(me.number))}</div></div></div>
      <div class="row"><div class="r-main"><div class="r-sub">Proprietaire</div><div class="r-title">${esc(me.name)}</div></div></div>
      <div class="row"><div class="r-main"><div class="r-sub">Metier</div><div class="r-title">${esc(me.job?.label || '-')} ${me.job?.grade ? `· ${esc(me.job.grade)}` : ''}</div></div></div>
      <div class="row"><div class="r-main"><div class="r-sub">Systeme</div><div class="r-title">Obsidian OS 1.0</div></div></div>
      <div class="row"><div class="r-main"><div class="r-sub">Apps installees</div><div class="r-title">${store.apps.length}</div></div></div></div>`);
    const el = ctx.root.lastElementChild;
    el._click = async (e, draw) => {
      if (e.target.closest('[data-a="rename"]')) {
        const d = await form("Nom de l'appareil", [{ name: 'n', label: 'Nom', value: store.settings.phoneName, max: 30 }]);
        if (d && d.n) { setSetting('phoneName', d.n); draw(); }
      }
    };
  },
};

export default {
  id: 'settings', name: 'Reglages', icon: 'settings', bg: T.bone[0], fg: T.bone[1],
  mount(ctx) {
    ctx.push((el, _c, entry) => {
      const render = () => {
        const me = store.me || {};
        const s = store.settings;
        el.innerHTML = `${topbar('Reglages', { back: false, big: true })}
        <div class="body">
          <button class="row profile" data-page="about">${avatar(me.name, null, '')}<div class="r-main"><div class="r-title">${esc(me.name || '')}</div><div class="r-sub">${esc(s.phoneName || 'Obsidian')} · ${esc(fmtNumber(me.number))}</div></div><span class="r-end">›</span></button>
          <div class="section-title">Connexion</div>
          <div class="list">
            ${tog('airplane', 'Mode avion', 'plane', s.airplane ? 'Appels, messages et notifications coupes' : '')}
            ${tog('dnd', 'Ne pas deranger', 'moon', 'Notifications silencieuses')}
          </div>
          <div class="section-title">Personnalisation</div>
          <div class="list">
            ${link('sounds', 'Sons & sonneries', 'volume', RINGTONES[s.ringtone]?.label)}
            ${link('wallpaper', "Fond d'ecran", 'palette', WALLPAPERS[s.wallpaper]?.label || 'Perso')}
            ${link('display', 'Affichage & coque', 'sun')}
          </div>
          <div class="section-title">Systeme</div>
          <div class="list">
            ${link('security', 'Code & securite', 'lock', s.lockEnabled ? 'Actif' : 'Off')}
            ${link('about', 'A propos', 'info')}
            <button class="row set" data-a="setup"><span class="set-ico">${icon('settings')}</span><div class="r-main"><div class="r-title">Relancer la configuration</div></div></button>
            <button class="row set" data-a="reset" style="color:var(--bad)"><span class="set-ico">${icon('reset')}</span><div class="r-main"><div class="r-title">Reinitialiser le telephone</div></div></button>
          </div>
        </div>`;
      };
      el.addEventListener('click', async (e) => {
        if (e.target.closest('[data-nav]')) return;
        const p = e.target.closest('[data-page]'); if (p) return PAGES[p.dataset.page](ctx);
        const t = e.target.closest('[data-tog]'); if (t) { setSetting(t.dataset.tog, !store.settings[t.dataset.tog]); render(); return; }
        const a = e.target.closest('[data-a]')?.dataset.a;
        if (a === 'setup') { ctx.home(); bus.emit('setup:run'); }
        if (a === 'reset' && await confirmBox('Reinitialiser ?', 'Reglages, fond d\'ecran, code et apps reviennent a zero. Contacts, messages et photos sont conserves.', { danger: true, ok: 'Reinitialiser' })) {
          if (result(await ctx.srv('factoryReset'))) { await post('reboot'); ctx.home(); bus.emit('setup:run'); }
        }
      });
      entry.onShow = render;
      render();
    });
  },
};
