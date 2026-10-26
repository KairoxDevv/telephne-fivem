import { T } from './_tiles.js';
import { icon } from '../core/icons.js';
import { esc } from '../core/util.js';
import { store } from '../core/store.js';
import { topbar, toast, result } from '../core/ui.js';
import { APPS } from '../core/os.js';
import { bus } from '../core/bus.js';

const DESC = {
  bank: 'Comptes, releves, virements et factures.',
  crypto: 'Achete, vends et envoie des cryptos.',
  casino: 'Slots, roulette, blackjack, crash, mines, des.',
  garage: 'Tes vehicules, leur etat, et le GPS.',
  notes: 'Prends des notes, garde des secrets.',
  calculator: 'Pour compter les billets.',
  services: 'Contacte la police, les EMS, les mecanos...',
  pulse: 'Poste, like et suis la ville.',
  ads: 'Petites annonces de Los Santos.',
};

export default {
  id: 'store', name: 'App Store', icon: 'store', bg: T.boneBurg[0], fg: T.boneBurg[1],
  mount(ctx) {
    ctx.push((el) => {
      let tab = 'explore', q = '';
      const catalog = () => (store.config.catalog || []).filter((a) => APPS.has(a.id));
      const render = () => {
        const all = catalog();
        const explore = all.filter((a) => !store.apps.includes(a.id));
        const installed = all.filter((a) => store.apps.includes(a.id));
        const list = (tab === 'explore' ? explore : installed).filter((a) => !q || APPS.get(a.id).name.toLowerCase().includes(q));
        el.innerHTML = `${topbar('App Store', { back: false, big: true })}
        <div class="body">
          <div class="tagline">Installe et supprime les apps de ton telephone</div>
          <div class="search">${icon('search')}<input id="sq" placeholder="Rechercher une app" value="${esc(q)}"></div>
          <div class="seg"><button class="${tab === 'explore' ? 'on' : ''}" data-tab="explore">Explorer (${explore.length})</button><button class="${tab === 'installed' ? 'on' : ''}" data-tab="installed">Installees (${installed.length})</button></div>
          <div class="list">${list.map((a) => {
            const def = APPS.get(a.id);
            return `<div class="row store-row"><span class="store-ico" style="background:${def.bg};color:${def.fg}">${icon(def.icon)}</span>
              <div class="r-main"><div class="r-title">${esc(def.name)}</div><div class="r-sub" style="white-space:normal">${esc(DESC[a.id] || (a.core ? 'App systeme' : ''))}</div></div>
              ${a.core ? '<span class="chip">Systeme</span>' : tab === 'explore'
                ? `<button class="icon-btn" data-inst="${a.id}">${icon('download')}</button>`
                : `<button class="icon-btn" data-rm="${a.id}">${icon('trash')}</button>`}</div>`;
          }).join('') || `<div class="empty">${icon('store')}${tab === 'explore' ? 'Tout est deja installe' : 'Rien ici'}</div>`}</div>
        </div>`;
        const i = el.querySelector('#sq');
        i.addEventListener('input', () => { q = i.value.toLowerCase(); render(); const n = el.querySelector('#sq'); n.focus(); n.setSelectionRange(q.length, q.length); });
      };
      const save = async (apps, msg) => {
        const res = await ctx.srv('setApps', { apps });
        if (result(res, msg)) { store.apps = res.apps || apps; bus.emit('apps'); render(); }
      };
      el.addEventListener('click', async (e) => {
        const t = e.target.closest('[data-tab]'); if (t) { tab = t.dataset.tab; render(); return; }
        const inst = e.target.closest('[data-inst]');
        if (inst) {
          inst.innerHTML = '<span class="spin"></span>';
          setTimeout(() => save([...store.apps, inst.dataset.inst], `${APPS.get(inst.dataset.inst).name} installee`), 700);
        }
        const rm = e.target.closest('[data-rm]');
        if (rm) save(store.apps.filter((x) => x !== rm.dataset.rm), 'App supprimee');
      });
      ctx.tabs({ change: () => { tab = tab === 'explore' ? 'installed' : 'explore'; render(); } });
      render();
    });
  },
};
