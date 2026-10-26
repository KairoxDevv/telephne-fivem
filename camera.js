import { T } from './_tiles.js';
import { icon } from '../core/icons.js';
import { esc } from '../core/util.js';
import { store } from '../core/store.js';
import { toast, sheet } from '../core/ui.js';
import { post } from '../core/bridge.js';
import { screenEl } from '../core/os.js';

const RATIOS = { '4:5': 0.8, '1:1': 1, '9:16': 0.5625 };

export default {
  id: 'camera', name: 'Camera', icon: 'camera', bg: T.ob[0], fg: T.ob[1],
  closeOnHide: true, viewBg: 'transparent',
  mount(ctx, payload) {
    screenEl.classList.add('cam-mode');
    const st = { grid: true, ratio: '4:5', zoom: 1, filter: 'none', strength: 1, selfie: !!payload?.selfie, last: null, busy: false };
    post('camera:start', { selfie: st.selfie });
    ctx.push((el) => {
      el.style.background = 'transparent';
      const render = () => {
        const zooms = store.config.zooms || [0.5, 1, 3];
        el.innerHTML = `<div class="cam">
          <div class="cam-top">
            <button class="cam-mini" data-a="hint" title="Aide">${icon('expand')}</button>
            <div class="cam-tools">
              <button class="cam-pill ${st.grid ? 'on' : ''}" data-a="grid">${icon('grid')}</button>
              <button class="cam-pill ${st.filter !== 'none' ? 'on' : ''}" data-a="filters">${icon('filter')}</button>
              <button class="cam-ratio" data-a="ratio">${st.ratio}</button>
            </div>
          </div>
          <div class="cam-view" style="--ratio:${RATIOS[st.ratio]}">
            <div class="cam-frame">${st.grid ? '<i class="g1"></i><i class="g2"></i><i class="g3"></i><i class="g4"></i>' : ''}</div>
          </div>
          <div class="cam-bottom">
            <div class="zooms">${zooms.map((z) => `<button class="${Math.abs(z - st.zoom) < 0.01 ? 'on' : ''}" data-z="${z}">${z < 1 ? `.${String(z).split('.')[1]}` : z}${Math.abs(z - st.zoom) < 0.01 ? '×' : ''}</button>`).join('')}</div>
            <div class="cam-row">
              <button class="cam-thumb" data-a="gallery" style="${st.last ? `background-image:url('${esc(st.last)}')` : ''}">${st.last ? '' : icon('image')}</button>
              <button class="shutter ${st.busy ? 'busy' : ''}" data-a="shoot"><span></span></button>
              <button class="cam-mini" data-a="flip">${icon('flip')}</button>
            </div>
          </div>
          <div class="cam-flash"></div>
        </div>`;
      };
      const shoot = async () => {
        if (st.busy) return;
        st.busy = true; render();
        const f = el.querySelector('.cam-flash'); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go');
        const res = await post('camera:shoot');
        st.busy = false;
        if (res && res.ok) { st.last = res.url; toast('Photo enregistree'); } else toast(res?.error || 'Echec', true);
        render();
      };
      el.addEventListener('click', async (e) => {
        const z = e.target.closest('[data-z]');
        if (z) { st.zoom = +z.dataset.z; post('camera:zoom', { zoom: st.zoom }); render(); return; }
        const a = e.target.closest('[data-a]')?.dataset.a;
        if (a === 'grid') { st.grid = !st.grid; render(); }
        if (a === 'ratio') { const k = Object.keys(RATIOS); st.ratio = k[(k.indexOf(st.ratio) + 1) % k.length]; render(); }
        if (a === 'shoot') shoot();
        if (a === 'flip') { const r = await post('camera:flip'); st.selfie = r?.selfie ?? !st.selfie; }
        if (a === 'gallery') ctx.open('gallery');
        if (a === 'hint') toast('Clic droit maintenu : orienter · Molette : zoom');
        if (a === 'filters') {
          const s = sheet(`<h3>Filtres</h3><div class="filter-grid">${(store.config.filters || []).map((f) => `<button class="${f.id === st.filter ? 'on' : ''}" data-f="${f.id}">${esc(f.label)}</button>`).join('')}</div>
            <div class="field" style="margin-top:16px"><label>Intensite</label><input type="range" id="f-str" min="0" max="1" step="0.05" value="${st.strength}"></div>`);
          s.el.addEventListener('click', (ev) => {
            const b = ev.target.closest('[data-f]'); if (!b) return;
            st.filter = b.dataset.f;
            s.el.querySelectorAll('[data-f]').forEach((x) => x.classList.toggle('on', x === b));
            post('camera:filter', { id: st.filter, strength: st.strength });
            render();
          });
          s.el.querySelector('#f-str').addEventListener('input', (ev) => { st.strength = +ev.target.value; post('camera:filter', { id: st.filter, strength: st.strength }); });
        }
      });
      const offKey = ctx.on('key', (k) => { if (k === ' ' || k === 'f') shoot(); if (k === 'g') { st.grid = !st.grid; render(); } });
      const offState = ctx.on('camera:state', (d) => { if (d.zoom) { st.zoom = d.zoom; render(); } });
      render();
      return () => { offKey(); offState(); };
    });
  },
  unmount() {
    screenEl.classList.remove('cam-mode');
    post('camera:stop');
  },
};
