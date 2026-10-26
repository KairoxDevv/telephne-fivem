import { T } from './_tiles.js';
import { icon } from '../core/icons.js';
import { esc, timeAgo, copyText } from '../core/util.js';
import { setSetting } from '../core/store.js';
import { topbar, toast, confirmBox, sheet } from '../core/ui.js';

export default {
  id: 'gallery', name: 'Galerie', icon: 'gallery', bg: T.boneBurg[0], fg: T.boneBurg[1],
  mount(ctx) {
    ctx.push((el, _c, entry) => {
      let photos = [];
      const load = async () => {
        const r = await ctx.srv('gallery:list');
        photos = Array.isArray(r) ? r : [];
        render();
      };
      const render = () => {
        el.innerHTML = `${topbar('Galerie', { back: false, big: true, sub: `${photos.length} photo${photos.length > 1 ? 's' : ''}`, actions: `<button class="icon-btn accent" data-a="cam">${icon('camera')}</button>` })}
        <div class="body flush">${photos.length ? `<div class="photo-grid">${photos.map((p, i) => `<button data-i="${i}" style="background-image:url('${esc(p.url)}');animation-delay:${Math.min(i, 20) * 20}ms"></button>`).join('')}</div>`
          : `<div class="empty">${icon('image')}Aucune photo pour l'instant</div>`}</div>`;
      };
      el.addEventListener('click', (e) => {
        if (e.target.closest('[data-a="cam"]')) return ctx.open('camera');
        const i = e.target.closest('[data-i]')?.dataset.i;
        if (i === undefined) return;
        const p = photos[+i];
        const s = sheet(`<img src="${esc(p.url)}" style="width:100%;border-radius:16px;max-height:420px;object-fit:cover" />
          <div style="font-size:13px;color:var(--bone-3);margin:8px 2px 12px">${timeAgo(p.ts)}</div>
          <div class="list">
            <button class="row" data-t="send">${icon('send', 'style="width:20px"')}<div class="r-main"><div class="r-title">Envoyer par message</div></div></button>
            <button class="row" data-t="wall">${icon('palette', 'style="width:20px"')}<div class="r-main"><div class="r-title">Definir comme fond d'ecran</div></div></button>
            <button class="row" data-t="copy">${icon('copy', 'style="width:20px"')}<div class="r-main"><div class="r-title">Copier le lien</div></div></button>
            <button class="row" data-t="del" style="color:var(--bad)">${icon('trash', 'style="width:20px"')}<div class="r-main"><div class="r-title">Supprimer</div></div></button>
          </div>`);
        s.el.addEventListener('click', async (ev) => {
          const t = ev.target.closest('[data-t]')?.dataset.t; if (!t) return;
          if (t === 'send') { s.close(); ctx.open('messages', { pickFor: { type: 'image', url: p.url } }); }
          if (t === 'wall') { setSetting('customWallpaper', p.url); setSetting('wallpaper', 'custom'); toast("Fond d'ecran mis a jour"); s.close(); }
          if (t === 'copy') { copyText(p.url); toast('Lien copie'); }
          if (t === 'del') { s.close(); if (await confirmBox('Supprimer la photo ?', '', { danger: true, ok: 'Supprimer' })) { await ctx.srv('gallery:delete', { id: p.id }); load(); } }
        });
      });
      entry.onShow = load;
      load();
    });
  },
};
