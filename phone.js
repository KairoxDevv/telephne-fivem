import { T } from './_tiles.js';
import { icon } from '../core/icons.js';
import { esc, avatar, timeAgo, fmtNumber, duration, on } from '../core/util.js';
import { store, contactName, setBadge, refreshContacts } from '../core/store.js';
import { startCall } from '../core/calls.js';
import { topbar, confirmBox, toast } from '../core/ui.js';
import { bus } from '../core/bus.js';

const TABS = ['recents', 'contacts', 'keypad'];

export default {
  id: 'phone', name: 'Telephone', icon: 'phone', bg: T.burg[0], fg: T.burg[1],
  mount(ctx, payload) {
    let tab = payload?.tab || 'keypad';
    let typed = payload?.number || '';
    ctx.push((el) => {
      const render = async () => {
        el.innerHTML = `<div class="body-wrap" style="flex:1;display:flex;flex-direction:column;min-height:0" id="pbody"></div>
          <div class="tabbar"><span class="keycap" data-k="q">Q</span><div class="tabs">
            ${TABS.map((t) => `<button class="tab ${t === tab ? 'on' : ''}" data-tab="${t}">${icon({ recents: 'clock', contacts: 'contacts', keypad: 'keypad' }[t])}</button>`).join('')}
          </div><span class="keycap" data-k="e">E</span></div>`;
        const body = el.querySelector('#pbody');
        if (tab === 'keypad') keypad(body);
        if (tab === 'recents') await recents(body);
        if (tab === 'contacts') contacts(body);
      };
      const keypad = (body) => {
        const em = store.config.emergency || {};
        const label = () => em[typed] ? `<span style="color:var(--bad)">${esc(em[typed])}</span>` : esc(contactName(typed) || '');
        body.innerHTML = `${topbar('Clavier', { back: false, actions: `<button class="icon-btn" data-nav="home">${icon('close')}</button>` })}
          <div style="text-align:center;margin-top:8px;height:70px">
            <div id="kp-num" style="font-size:38px;font-weight:600;letter-spacing:.04em;min-height:46px">${esc(fmtNumber(typed))}</div>
            <div id="kp-label" style="font-size:14px;font-weight:700;margin-top:2px">${label()}</div>
          </div>
          <div class="keypad">${[['1', ''], ['2', 'ABC'], ['3', 'DEF'], ['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO'], ['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ'], ['*', ''], ['0', '+'], ['#', '']]
            .map(([n, l]) => `<button data-d="${n}">${n}<small>${l}</small></button>`).join('')}</div>
          <div class="kp-actions">
            <button class="kp-video" data-a="video" title="Appel video">${icon('video')}</button>
            <button class="kp-call" data-a="call">${icon('phone')}</button>
            <button class="kp-del" data-a="del">${icon('backspace')}</button>
          </div>`;
        const refresh = () => { body.querySelector('#kp-num').textContent = fmtNumber(typed); body.querySelector('#kp-label').innerHTML = label(); };
        body.onclick = (e) => {
          const d = e.target.closest('[data-d]');
          if (d && typed.length < 12) { typed += d.dataset.d; refresh(); return; }
          const a = e.target.closest('[data-a]')?.dataset.a;
          if (a === 'del') { typed = typed.slice(0, -1); refresh(); }
          if (a === 'call' && typed) startCall(typed.replace(/\D/g, ''));
          if (a === 'video' && typed) startCall(typed.replace(/\D/g, ''), true);
          if (e.target.closest('[data-nav="home"]')) ctx.home();
        };
        body._key = (k) => {
          if (/^[0-9*#]$/.test(k) && typed.length < 12) { typed += k; refresh(); }
          if (k === 'delete') { typed = typed.slice(0, -1); refresh(); }
        };
      };
      const recents = async (body) => {
        body.innerHTML = `${topbar('Recents', { back: false, actions: `<button class="icon-btn" data-a="clear" title="Effacer">${icon('trash')}</button>` })}<div class="body"><div class="empty">Chargement...</div></div>`;
        setBadge('phone', 0);
        const list = await ctx.srv('calls:recent');
        const box = body.querySelector('.body');
        if (!Array.isArray(list) || !list.length) { box.innerHTML = `<div class="empty">${icon('clock')}Aucun appel</div>`; return; }
        box.innerHTML = `<div class="list">${list.map((c) => {
          const missed = c.status === 'missed' && !c.outgoing;
          return `<div class="row">
            ${avatar(c.name)}
            <div class="r-main"><div class="r-title" style="${missed ? 'color:var(--bad)' : ''}">${esc(c.name || fmtNumber(c.number))}</div>
            <div class="r-sub">${icon(c.outgoing ? 'outgoing' : 'incoming', 'style="width:13px;height:13px;vertical-align:-2px"')} ${c.video ? 'Video · ' : ''}${missed ? 'Manque' : c.status === 'declined' ? 'Refuse' : duration(c.duration)} · ${timeAgo(c.ts)}</div></div>
            <button class="icon-btn" data-call="${esc(c.number)}">${icon('phone')}</button>
          </div>`;
        }).join('')}</div>`;
        body.onclick = async (e) => {
          const n = e.target.closest('[data-call]'); if (n) startCall(n.dataset.call);
          if (e.target.closest('[data-a="clear"]') && await confirmBox('Effacer les appels recents ?', '', { danger: true, ok: 'Effacer' })) { await ctx.srv('calls:clearRecent'); recents(body); }
        };
      };
      const contacts = (body) => {
        const list = [...store.contacts].sort((a, b) => (b.favorite - a.favorite) || a.name.localeCompare(b.name));
        body.innerHTML = `${topbar('Contacts', { back: false, actions: `<button class="icon-btn" data-a="add">${icon('plus')}</button>` })}
          <div class="body">${list.length ? `<div class="list">${list.map((c) => `<div class="row">${avatar(c.name, c.avatar)}<div class="r-main"><div class="r-title">${c.favorite ? '★ ' : ''}${esc(c.name)}</div><div class="r-sub">${esc(fmtNumber(c.number))}</div></div>
            <button class="icon-btn" data-msg="${esc(c.number)}">${icon('message')}</button><button class="icon-btn" data-vid="${esc(c.number)}">${icon('video')}</button><button class="icon-btn accent" data-call="${esc(c.number)}">${icon('phone')}</button></div>`).join('')}</div>`
          : `<div class="empty">${icon('contacts')}Aucun contact</div>`}</div>`;
        body.onclick = (e) => {
          const c = e.target.closest('[data-call]'); if (c) startCall(c.dataset.call);
          const v = e.target.closest('[data-vid]'); if (v) startCall(v.dataset.vid, true);
          const m = e.target.closest('[data-msg]'); if (m) ctx.open('messages', { number: m.dataset.msg });
          if (e.target.closest('[data-a="add"]')) ctx.open('contacts', { add: true });
        };
      };
      el.addEventListener('click', (e) => {
        const t = e.target.closest('[data-tab]'); if (t) { tab = t.dataset.tab; render(); }
        const k = e.target.closest('[data-k]'); if (k) change(k.dataset.k === 'q' ? -1 : 1);
      });
      const change = (d) => { tab = TABS[(TABS.indexOf(tab) + d + TABS.length) % TABS.length]; render(); };
      ctx.tabs({ change });
      const offKey = bus.on('key', (k) => { const b = el.querySelector('#pbody'); b && b._key && b._key(k); });
      const offC = bus.on('contacts', () => { if (tab === 'contacts') render(); });
      render();
      return () => { offKey(); offC(); };
    });
  },
};
