import { T } from './_tiles.js';
import { icon } from '../core/icons.js';
import { esc, avatar, fmtNumber, copyText } from '../core/util.js';
import { store, refreshContacts } from '../core/store.js';
import { startCall } from '../core/calls.js';
import { topbar, form, confirmBox, toast, result } from '../core/ui.js';
import { post } from '../core/bridge.js';

async function editContact(ctx, c = {}) {
  const data = await form(c.id ? 'Modifier le contact' : 'Nouveau contact', [
    { name: 'name', label: 'Nom', value: c.name || '', max: 60, placeholder: 'Jean Dupont' },
    { name: 'number', label: 'Numero', value: c.number || '', type: 'tel', max: 15, placeholder: '5551234567' },
    { name: 'avatar', label: 'Photo (lien https, optionnel)', value: c.avatar || '', max: 255, placeholder: 'https://...' },
  ]);
  if (!data) return false;
  const res = await ctx.srv('contacts:save', { ...c, ...data });
  if (result(res, c.id ? 'Contact modifie' : 'Contact ajoute')) { await refreshContacts(); return true; }
  return false;
}

function detail(ctx, c) {
  ctx.push((el) => {
    const render = () => {
      el.innerHTML = `${topbar('', { actions: `<button class="icon-btn" data-a="edit">${icon('edit')}</button>` })}
      <div class="body" style="text-align:center">
        <div style="display:flex;justify-content:center;margin-top:6px">${avatar(c.name, c.avatar, 'lg')}</div>
        <div style="font-family:var(--f-cond);font-style:italic;font-weight:800;font-size:34px;text-transform:uppercase;margin-top:14px">${esc(c.name)}</div>
        <div style="color:var(--bone-2);font-size:16px;margin-top:2px">${esc(fmtNumber(c.number))}</div>
        <div class="ct-actions">
          <button data-a="msg"><span>${icon('message')}</span>Message</button>
          <button data-a="call"><span>${icon('phone')}</span>Appel</button>
          <button data-a="video"><span>${icon('video')}</span>Video</button>
          <button data-a="fav"><span style="${c.favorite ? 'background:var(--burg)' : ''}">${icon('star')}</span>Favori</button>
        </div>
        <div class="list" style="text-align:left;margin-top:18px">
          <button class="row" data-a="copy">${icon('copy', 'style="width:18px"')}<div class="r-main"><div class="r-title">Copier le numero</div></div></button>
          <button class="row" data-a="sendcard">${icon('share', 'style="width:18px"')}<div class="r-main"><div class="r-title">Envoyer la fiche par message</div></div></button>
          <button class="row" data-a="del" style="color:var(--bad)">${icon('trash', 'style="width:18px"')}<div class="r-main"><div class="r-title">Supprimer</div></div></button>
        </div>
      </div>`;
    };
    el.addEventListener('click', async (e) => {
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (a === 'call') startCall(c.number);
      if (a === 'video') startCall(c.number, true);
      if (a === 'msg') ctx.open('messages', { number: c.number });
      if (a === 'copy') { copyText(c.number); toast('Numero copie'); }
      if (a === 'fav') { c.favorite = c.favorite ? 0 : 1; await ctx.srv('contacts:save', c); await refreshContacts(); render(); }
      if (a === 'edit') { if (await editContact(ctx, c)) { Object.assign(c, store.contacts.find((x) => x.id === c.id) || {}); render(); } }
      if (a === 'sendcard') ctx.open('messages', { pickFor: { type: 'contact', name: c.name, number: c.number } });
      if (a === 'del' && await confirmBox(`Supprimer ${c.name} ?`, '', { danger: true, ok: 'Supprimer' })) {
        await ctx.srv('contacts:delete', { id: c.id }); await refreshContacts(); ctx.back();
      }
    });
    render();
  });
}

export default {
  id: 'contacts', name: 'Contacts', icon: 'contacts', bg: T.plum[0], fg: T.plum[1],
  mount(ctx, payload) {
    ctx.push((el) => {
      let q = '';
      const render = () => {
        const me = store.me || {};
        const list = store.contacts.filter((c) => !q || c.name.toLowerCase().includes(q) || String(c.number).includes(q));
        const favs = store.contacts.filter((c) => c.favorite);
        const groups = {};
        list.forEach((c) => { const l = (c.name[0] || '#').toUpperCase(); (groups[l] ||= []).push(c); });
        el.innerHTML = `${topbar('Contacts', { back: false, big: true, actions: `<button class="icon-btn accent" data-a="add">${icon('plus')}</button>` })}
        <div class="body">
          <div class="search">${icon('search')}<input id="ct-q" placeholder="Rechercher" value="${esc(q)}"></div>
          <div class="row me-card">${avatar(me.name)}<div class="r-main"><div class="r-title">${esc(me.name || 'Moi')}</div><div class="r-sub">Ma carte · ${esc(fmtNumber(me.number))}</div></div>
            <button class="btn" style="height:36px;font-size:13px" data-a="share">${icon('share')}Partager</button></div>
          ${favs.length && !q ? `<div class="section-title">Favoris</div><div class="favs">${favs.map((c) => `<button data-id="${c.id}">${avatar(c.name, c.avatar)}<span>${esc(c.name.split(' ')[0])}</span></button>`).join('')}</div>` : ''}
          ${Object.keys(groups).sort().map((l) => `<div class="section-title">${esc(l)}</div><div class="list">${groups[l].map((c) => `
            <button class="row" data-id="${c.id}">${avatar(c.name, c.avatar)}<div class="r-main"><div class="r-title">${esc(c.name)}</div><div class="r-sub">${esc(fmtNumber(c.number))}</div></div></button>`).join('')}</div>`).join('')}
          ${!list.length ? `<div class="empty">${icon('contacts')}${q ? 'Aucun resultat' : 'Ajoute ton premier contact'}</div>` : ''}
        </div>`;
        const input = el.querySelector('#ct-q');
        input.addEventListener('input', () => { q = input.value.toLowerCase(); const pos = input.selectionStart; render(); const n = el.querySelector('#ct-q'); n.focus(); n.setSelectionRange(pos, pos); });
      };
      el.addEventListener('click', async (e) => {
        const id = e.target.closest('[data-id]')?.dataset.id;
        if (id) { const c = store.contacts.find((x) => String(x.id) === id); if (c) detail(ctx, { ...c }); return; }
        const a = e.target.closest('[data-a]')?.dataset.a;
        if (a === 'add') { if (await editContact(ctx)) render(); }
        if (a === 'share') { const r = await post('contacts:shareNearby'); result(r, 'Carte envoyee'); }
      });
      ctx.on('contacts', render);
      render();
      if (payload?.add) setTimeout(async () => { if (await editContact(ctx, { number: payload.number || '' })) render(); }, 200);
    });
  },
};
