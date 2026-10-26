import { T } from './_tiles.js';
import { icon } from '../core/icons.js';
import { esc, avatar, timeAgo } from '../core/util.js';
import { topbar, result, sheet, confirmBox } from '../core/ui.js';
import { store } from '../core/store.js';

export default {
  id: 'pulse', name: 'Pulse', icon: 'pulse', bg: T.burg[0], fg: T.burg[1],
  mount(ctx) {
    ctx.push((el) => {
      let feed = [];
      const load = async () => { const r = await ctx.srv('pulse:feed'); feed = Array.isArray(r) ? r : []; render(); };
      const render = () => {
        el.innerHTML = `${topbar('Pulse', { back: false, big: true, actions: `<button class="icon-btn accent" data-a="post">${icon('edit')}</button>` })}
        <div class="body">${feed.map((p) => `<article class="post">
          ${avatar(p.author)}
          <div class="p-main"><div class="p-head"><b>${esc(p.author)}</b><span>${esc(p.handle)} · ${timeAgo(p.ts)}</span></div>
          <p>${esc(p.content)}</p>${p.image ? `<img src="${esc(p.image)}" />` : ''}
          <div class="p-acts"><button class="${p.liked ? 'liked' : ''}" data-like="${p.id}">${icon('heart')}<span>${p.likeCount || 0}</span></button>
          ${p.mine ? `<button data-del="${p.id}">${icon('trash')}</button>` : ''}</div></div></article>`).join('') || `<div class="empty">${icon('pulse')}Le fil est vide. Lance la conversation.</div>`}</div>`;
      };
      el.addEventListener('click', async (e) => {
        const l = e.target.closest('[data-like]');
        if (l) { const r = await ctx.srv('pulse:like', { id: +l.dataset.like }); if (r?.ok) { const p = feed.find((x) => x.id === +l.dataset.like); p.liked = r.liked; p.likeCount = r.count; render(); } return; }
        const d = e.target.closest('[data-del]');
        if (d && await confirmBox('Supprimer le post ?', '', { danger: true, ok: 'Supprimer' })) { await ctx.srv('pulse:delete', { id: +d.dataset.del }); load(); return; }
        if (e.target.closest('[data-a="post"]')) {
          const s = sheet(`<h3>Nouveau post</h3><textarea class="input" id="p-txt" maxlength="280" placeholder="Quoi de neuf a Los Santos ?"></textarea>
            <div class="field" style="margin-top:10px"><label>Image (lien https, optionnel)</label><input class="input" id="p-img" maxlength="500" placeholder="https://..."></div>
            <div class="sheet-actions"><button class="btn primary" data-t="go">${icon('send')}Publier</button></div>`);
          s.el.addEventListener('click', async (ev) => {
            if (!ev.target.closest('[data-t="go"]')) return;
            if (result(await ctx.srv('pulse:post', { content: s.el.querySelector('#p-txt').value, image: s.el.querySelector('#p-img').value.trim() || null }), 'Publie')) { s.close(); load(); }
          });
        }
      });
      load();
    });
  },
};
