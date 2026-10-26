import { T } from './_tiles.js';
import { icon } from '../core/icons.js';
import { esc, money, timeAgo, fmtNumber } from '../core/util.js';
import { topbar, result, form, confirmBox } from '../core/ui.js';
import { startCall } from '../core/calls.js';

export default {
  id: 'ads', name: 'Annonces', icon: 'ads', bg: T.plum[0], fg: T.plum[1],
  mount(ctx) {
    ctx.push((el) => {
      let ads = [];
      const load = async () => { const r = await ctx.srv('ads:list'); ads = Array.isArray(r) ? r : []; render(); };
      const render = () => {
        el.innerHTML = `${topbar('Annonces', { back: false, big: true, actions: `<button class="icon-btn accent" data-a="new">${icon('plus')}</button>` })}
        <div class="body"><div class="list">${ads.map((a) => `<div class="ad">
          ${a.image ? `<img src="${esc(a.image)}" />` : ''}
          <div class="ad-top"><b>${esc(a.title)}</b>${a.price ? `<span class="chip burg">${money(a.price)}</span>` : ''}</div>
          <p>${esc(a.content)}</p>
          <div class="ad-foot"><span>${esc(a.author)} · ${timeAgo(a.ts)}</span>
            ${a.mine ? `<button class="icon-btn" data-del="${a.id}">${icon('trash')}</button>` : `<button class="icon-btn" data-msg="${esc(a.number)}">${icon('message')}</button><button class="icon-btn accent" data-call="${esc(a.number)}">${icon('phone')}</button>`}</div>
        </div>`).join('') || `<div class="empty">${icon('ads')}Aucune annonce</div>`}</div></div>`;
      };
      el.addEventListener('click', async (e) => {
        const c = e.target.closest('[data-call]'); if (c) return startCall(c.dataset.call);
        const m = e.target.closest('[data-msg]'); if (m) return ctx.open('messages', { number: m.dataset.msg });
        const d = e.target.closest('[data-del]');
        if (d && await confirmBox("Retirer l'annonce ?", '', { danger: true, ok: 'Retirer' })) { await ctx.srv('ads:delete', { id: +d.dataset.del }); return load(); }
        if (e.target.closest('[data-a="new"]')) {
          const f = await form('Nouvelle annonce', [
            { name: 'title', label: 'Titre', max: 80, placeholder: 'Vends Sultan RS' },
            { name: 'content', label: 'Description', type: 'textarea', max: 400 },
            { name: 'price', label: 'Prix (optionnel)', type: 'number' },
            { name: 'image', label: 'Image (lien https, optionnel)', max: 500 },
          ], { submit: 'Publier' });
          if (f && result(await ctx.srv('ads:post', { ...f, price: f.price ? +f.price : null, image: f.image || null }), 'Annonce publiee')) load();
        }
      });
      load();
    });
  },
};
