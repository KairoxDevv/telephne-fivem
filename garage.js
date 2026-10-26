import { T } from './_tiles.js';
import { icon } from '../core/icons.js';
import { esc } from '../core/util.js';
import { topbar, result } from '../core/ui.js';
import { post } from '../core/bridge.js';

const STATE = { 0: ['Sorti', 'warn'], 1: ['Au garage', 'good'], 2: ['Fourriere', 'bad'] };
const bar = (label, v, ic) => `<div class="vbar"><span>${icon(ic)}${label}</span><div><i style="width:${Math.max(0, Math.min(100, v))}%;background:${v > 60 ? 'var(--good)' : v > 30 ? 'var(--warn)' : 'var(--bad)'}"></i></div><b>${v}%</b></div>`;

export default {
  id: 'garage', name: 'Garage', icon: 'garage', bg: T.plum[0], fg: T.plum[1],
  mount(ctx) {
    ctx.push((el) => {
      let list = [], filter = 'all';
      const render = () => {
        const shown = list.filter((v) => filter === 'all' || String(v.state) === filter);
        el.innerHTML = `${topbar('Garage', { back: false, big: true, sub: `${list.length} vehicule${list.length > 1 ? 's' : ''}` })}
        <div class="body">
          <div class="seg three"><button class="${filter === 'all' ? 'on' : ''}" data-f="all">Tous</button><button class="${filter === '1' ? 'on' : ''}" data-f="1">Garage</button><button class="${filter === '0' ? 'on' : ''}" data-f="0">Sortis</button></div>
          <div class="list">${shown.map((v) => {
            const [label, cls] = STATE[v.state] || STATE[1];
            return `<div class="veh">
              <div class="veh-top"><span class="veh-ico">${icon('car')}</span><div class="r-main"><div class="r-title">${esc(v.label)}</div><div class="r-sub"><span class="plate">${esc(v.plate)}</span> ${esc(v.garage || '')}</div></div><span class="chip ${cls}">${label}</span></div>
              ${bar('Moteur', v.engine, 'wrench')}${bar('Carrosserie', v.body, 'shield')}${bar('Essence', v.fuel, 'fuel')}
              ${v.state === 0 ? `<button class="btn primary block" style="margin-top:10px;height:40px" data-loc="${esc(v.plate)}">${icon('pin')}Localiser</button>` : ''}
            </div>`;
          }).join('') || `<div class="empty">${icon('car')}Aucun vehicule</div>`}</div>
        </div>`;
      };
      el.addEventListener('click', async (e) => {
        const f = e.target.closest('[data-f]'); if (f) { filter = f.dataset.f; render(); }
        const l = e.target.closest('[data-loc]'); if (l) result(await post('garage:locate', { plate: l.dataset.loc }), 'Position ajoutee au GPS');
      });
      el.innerHTML = '<div class="empty" style="margin-top:140px">Chargement...</div>';
      ctx.srv('garage:list').then((r) => { list = Array.isArray(r) ? r : []; render(); });
    });
  },
};
