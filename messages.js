import { T } from './_tiles.js';
import { icon } from '../core/icons.js';
import { esc, avatar, timeAgo, hhmm, fmtNumber } from '../core/util.js';
import { store, contactName, setBadge } from '../core/store.js';
import { startCall } from '../core/calls.js';
import { topbar, form, confirmBox, toast, result, sheet } from '../core/ui.js';
import { post } from '../core/bridge.js';

const EMOJI = ['😂', '❤️', '👍', '🔥', '😎', '🙏', '😭', '🤔', '👀', '💸', '🚓', '🍕', '🎉', '😡', '😘', '👋'];

function attachmentHTML(a) {
  if (!a) return '';
  if (a.type === 'image') return `<img class="m-img" src="${esc(a.url)}" data-img="${esc(a.url)}" />`;
  if (a.type === 'gps') return `<button class="m-gps" data-gps='${esc(JSON.stringify({ x: a.x, y: a.y }))}'>${icon('pin')}<span><b>Position partagee</b><small>Toucher pour le GPS</small></span></button>`;
  if (a.type === 'contact') return `<button class="m-gps" data-card='${esc(JSON.stringify({ name: a.name, number: a.number }))}'>${icon('user')}<span><b>${esc(a.name)}</b><small>${esc(fmtNumber(a.number))}</small></span></button>`;
  return '';
}

function thread(ctx, convRef) {
  ctx.push((el, _c, entry) => {
    let conv = null;
    const me = store.me?.number;
    const bubbles = (msgs) => msgs.map((m, i) => {
      const mine = m.sender === me;
      const prev = msgs[i - 1];
      const showName = conv.isGroup && !mine && (!prev || prev.sender !== m.sender);
      return `<div class="msg ${mine ? 'me' : ''}">
        ${showName ? `<div class="m-name">${esc(conv.names[m.sender] || fmtNumber(m.sender))}</div>` : ''}
        <div class="bubble">${attachmentHTML(m.attachment)}${m.content ? `<span>${esc(m.content)}</span>` : ''}</div>
        <div class="m-time">${hhmm(m.ts)}</div></div>`;
    }).join('');
    const load = async () => {
      const res = await ctx.srv('messages:open', convRef);
      if (!res || !res.ok) { toast(res?.error || 'Conversation introuvable', true); ctx.back(); return; }
      conv = res;
      ctx._conv = conv.id;
      setBadge('messages', Math.max(0, (store.badges.messages || 0) - 0));
      el.innerHTML = `<div class="top chat-top">
          <button class="icon-btn" data-nav="back">${icon('back')}</button>
          ${conv.isGroup ? `<div class="avatar sm" style="background:var(--plum-3)">${icon('users')}</div>` : avatar(conv.title, null, 'sm')}
          <div class="grow"><h2>${esc(conv.title || 'Groupe')}</h2><div class="sub">${conv.isGroup ? `${conv.members.length} membres` : esc(fmtNumber(conv.peer))}</div></div>
          ${conv.isGroup ? '' : `<button class="icon-btn" data-a="call">${icon('phone')}</button><button class="icon-btn" data-a="video">${icon('video')}</button>`}
          <button class="icon-btn" data-a="more">${icon('more')}</button>
        </div>
        <div class="chat" id="chat">${conv.messages.length ? bubbles(conv.messages) : `<div class="empty">${icon('message')}Dis bonjour 👋</div>`}</div>
        <div class="composer">
          <button class="icon-btn" data-a="attach">${icon('paperclip')}</button>
          <div class="c-input"><input id="m-input" maxlength="1000" placeholder="Ecrire un message..." /><button data-a="emoji">${icon('smile')}</button></div>
          <button class="icon-btn accent" data-a="send">${icon('send')}</button>
        </div>`;
      scroll();
      if (convRef.pickFor) { const att = convRef.pickFor; delete convRef.pickFor; send('', att); }
    };
    const scroll = () => { const c = el.querySelector('#chat'); if (c) c.scrollTop = c.scrollHeight; };
    const send = async (text, attachment) => {
      if (!conv) return;
      text = (text || '').trim();
      if (!text && !attachment) return;
      const res = await ctx.srv('messages:send', { id: conv.id, content: text, attachment });
      if (!result(res)) return;
      conv.messages.push(res.message);
      el.querySelector('#chat').innerHTML = bubbles(conv.messages);
      scroll();
    };
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.id === 'm-input') { e.preventDefault(); e.stopPropagation(); const v = e.target.value; e.target.value = ''; send(v); }
    });
    el.addEventListener('click', async (e) => {
      const g = e.target.closest('[data-gps]'); if (g) { post('waypoint', JSON.parse(g.dataset.gps)); return; }
      const card = e.target.closest('[data-card]'); if (card) { ctx.open('contacts', { add: true, ...JSON.parse(card.dataset.card) }); return; }
      const img = e.target.closest('[data-img]'); if (img) { sheet(`<img src="${esc(img.dataset.img)}" style="width:100%;border-radius:16px" />`); return; }
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (!a) return;
      const input = el.querySelector('#m-input');
      if (a === 'send') { const v = input.value; input.value = ''; send(v); }
      if (a === 'call') startCall(conv.peer);
      if (a === 'video') startCall(conv.peer, true);
      if (a === 'emoji') {
        const s = sheet(`<h3>Emojis</h3><div class="emoji-grid">${EMOJI.map((x) => `<button>${x}</button>`).join('')}</div>`);
        s.el.addEventListener('click', (ev) => { const b = ev.target.closest('.emoji-grid button'); if (b) { input.value += b.textContent; s.close(); input.focus(); } });
      }
      if (a === 'attach') {
        const s = sheet(`<h3>Joindre</h3><div class="list">
          <button class="row" data-t="photo">${icon('image', 'style="width:20px"')}<div class="r-main"><div class="r-title">Photo de la galerie</div></div></button>
          <button class="row" data-t="gps">${icon('pin', 'style="width:20px"')}<div class="r-main"><div class="r-title">Ma position</div></div></button>
          <button class="row" data-t="me">${icon('user', 'style="width:20px"')}<div class="r-main"><div class="r-title">Ma fiche contact</div></div></button></div>`);
        s.el.addEventListener('click', async (ev) => {
          const t = ev.target.closest('[data-t]')?.dataset.t; if (!t) return;
          s.close();
          if (t === 'gps') send('', { type: 'gps' });
          if (t === 'me') send('', { type: 'contact', name: store.me.name, number: store.me.number });
          if (t === 'photo') {
            const photos = await ctx.srv('gallery:list');
            if (!Array.isArray(photos) || !photos.length) return toast('Galerie vide', true);
            const p = sheet(`<h3>Choisir une photo</h3><div class="pick-grid">${photos.map((ph) => `<button data-u="${esc(ph.url)}" style="background-image:url('${esc(ph.url)}')"></button>`).join('')}</div>`);
            p.el.addEventListener('click', (ev2) => { const b = ev2.target.closest('[data-u]'); if (b) { p.close(); send('', { type: 'image', url: b.dataset.u }); } });
          }
        });
      }
      if (a === 'more') {
        const s = sheet(`<h3>${esc(conv.title || 'Conversation')}</h3><div class="list">
          ${conv.isGroup ? `<div class="section-title" style="margin-top:0">Membres</div>${conv.members.map((n) => `<div class="row">${avatar(conv.names[n] || n, null, 'sm')}<div class="r-main"><div class="r-title">${esc(conv.names[n] || fmtNumber(n))}</div></div></div>`).join('')}
          <button class="row" data-t="add">${icon('plus', 'style="width:20px"')}<div class="r-main"><div class="r-title">Ajouter un membre</div></div></button>` : `
          <button class="row" data-t="save">${icon('user', 'style="width:20px"')}<div class="r-main"><div class="r-title">${contactName(conv.peer) ? 'Voir le contact' : 'Ajouter aux contacts'}</div></div></button>`}
          <button class="row" data-t="leave" style="color:var(--bad)">${icon('trash', 'style="width:20px"')}<div class="r-main"><div class="r-title">${conv.isGroup ? 'Quitter le groupe' : 'Supprimer la conversation'}</div></div></button></div>`);
        s.el.addEventListener('click', async (ev) => {
          const t = ev.target.closest('[data-t]')?.dataset.t; if (!t) return;
          s.close();
          if (t === 'save') ctx.open('contacts', { add: !contactName(conv.peer), number: conv.peer });
          if (t === 'add') {
            const d = await form('Ajouter un membre', [{ name: 'number', label: 'Numero', type: 'tel', max: 15 }]);
            if (d && d.number && result(await ctx.srv('messages:addMember', { id: conv.id, number: d.number }), 'Membre ajoute')) load();
          }
          if (t === 'leave' && await confirmBox(conv.isGroup ? 'Quitter le groupe ?' : 'Supprimer la conversation ?', '', { danger: true, ok: 'Oui' })) {
            await ctx.srv('messages:leave', { id: conv.id }); ctx.back();
          }
        });
      }
    });
    const off = ctx.on('messages:new', (m) => {
      if (!conv || m.conversation !== conv.id) return;
      conv.messages.push(m);
      el.querySelector('#chat').innerHTML = bubbles(conv.messages);
      scroll();
      ctx.srv('messages:read', { id: conv.id });
    });
    load();
    return () => { ctx._conv = null; off(); };
  });
}

export default {
  id: 'messages', name: 'Messages', icon: 'message', bg: T.burg[0], fg: T.burg[1],
  mount(ctx, payload) {
    ctx.push((el, _c, entry) => {
      let convs = [], q = '';
      const load = async () => {
        const res = await ctx.srv('messages:list');
        convs = Array.isArray(res) ? res : [];
        setBadge('messages', convs.reduce((s, c) => s + (c.unread || 0), 0));
        render();
      };
      const render = () => {
        const list = convs.filter((c) => !q || (c.name || '').toLowerCase().includes(q) || (c.peer || '').includes(q));
        el.innerHTML = `${topbar('Messages', { back: false, big: true, actions: `<button class="icon-btn" data-a="group" title="Nouveau groupe">${icon('users')}</button><button class="icon-btn accent" data-a="new">${icon('edit')}</button>` })}
        <div class="body">
          ${payload?.pickFor ? `<div class="tagline">Choisis la conversation a qui envoyer</div>` : ''}
          <div class="search">${icon('search')}<input id="mq" placeholder="Rechercher" value="${esc(q)}"></div>
          <div class="list">${list.map((c) => `
            <button class="row conv" data-id="${c.id}">
              ${c.is_group ? `<div class="avatar" style="background:var(--plum-3)">${icon('users')}</div>` : avatar(c.name, c.avatar)}
              <div class="r-main"><div class="r-title">${esc(c.name || 'Groupe')}</div><div class="r-sub">${esc(c.last_message || 'Nouvelle conversation')}</div></div>
              <div class="r-end">${timeAgo(c.ts)}${c.unread ? `<b><span class="unread">${c.unread}</span></b>` : ''}</div>
            </button>`).join('')}</div>
          ${!list.length ? `<div class="empty">${icon('message')}Aucune conversation</div>` : ''}
        </div>`;
        const i = el.querySelector('#mq');
        i.addEventListener('input', () => { q = i.value.toLowerCase(); render(); const n = el.querySelector('#mq'); n.focus(); n.setSelectionRange(q.length, q.length); });
      };
      const openConv = (ref) => {
        if (payload?.pickFor) { ref.pickFor = payload.pickFor; payload.pickFor = null; }
        thread(ctx, ref);
      };
      el.addEventListener('click', async (e) => {
        const id = e.target.closest('[data-id]')?.dataset.id;
        if (id) return openConv({ id: +id });
        const a = e.target.closest('[data-a]')?.dataset.a;
        if (a === 'new') {
          const s = sheet(`<h3>Nouveau message</h3>
            <div class="field"><label>Numero</label><div style="display:flex;gap:8px"><input class="input" id="nm-num" type="tel" maxlength="15" placeholder="5551234567"><button class="btn primary" data-t="go">OK</button></div></div>
            <div class="section-title">Contacts</div><div class="list">${store.contacts.map((c) => `<button class="row" data-n="${esc(c.number)}">${avatar(c.name, c.avatar, 'sm')}<div class="r-main"><div class="r-title">${esc(c.name)}</div><div class="r-sub">${esc(fmtNumber(c.number))}</div></div></button>`).join('') || '<div class="empty">Aucun contact</div>'}</div>`);
          s.el.addEventListener('click', (ev) => {
            const n = ev.target.closest('[data-n]')?.dataset.n || (ev.target.closest('[data-t="go"]') && s.el.querySelector('#nm-num').value.replace(/\D/g, ''));
            if (n) { s.close(); openConv({ number: n }); }
          });
        }
        if (a === 'group') {
          const s = sheet(`<h3>Nouveau groupe</h3><div class="field"><label>Nom du groupe</label><input class="input" id="g-name" maxlength="40" placeholder="Fun Zone"></div>
            <div class="section-title">Membres</div><div class="list">${store.contacts.map((c) => `<label class="row click"><input type="checkbox" value="${esc(c.number)}" style="accent-color:#762F43;width:18px;height:18px">${avatar(c.name, c.avatar, 'sm')}<div class="r-main"><div class="r-title">${esc(c.name)}</div></div></label>`).join('') || '<div class="empty">Ajoute des contacts d\'abord</div>'}</div>
            <div class="sheet-actions" style="margin-top:14px"><button class="btn primary" data-t="create">Creer le groupe</button></div>`);
          s.el.addEventListener('click', async (ev) => {
            if (!ev.target.closest('[data-t="create"]')) return;
            const members = [...s.el.querySelectorAll('input[type=checkbox]:checked')].map((x) => x.value);
            const res = await ctx.srv('messages:createGroup', { name: s.el.querySelector('#g-name').value, members });
            if (result(res, 'Groupe cree')) { s.close(); openConv({ id: res.id }); }
          });
        }
      });
      entry.onShow = load;
      ctx.on('messages:new', () => { if (!ctx._conv) load(); });
      load();
      if (payload?.number) openConv({ number: payload.number });
      else if (payload?.conversation) openConv({ id: payload.conversation });
    });
  },
};
