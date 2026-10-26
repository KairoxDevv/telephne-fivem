import { T } from './_tiles.js';
import { icon } from '../core/icons.js';

const KEYS = [['C', 'fn'], ['±', 'fn'], ['%', 'fn'], ['÷', 'op'], ['7'], ['8'], ['9'], ['×', 'op'], ['4'], ['5'], ['6'], ['−', 'op'], ['1'], ['2'], ['3'], ['+', 'op'], ['0', 'zero'], ['.'], ['=', 'eq']];

export default {
  id: 'calculator', name: 'Calculatrice', icon: 'calculator', bg: T.ob[0], fg: T.ob[1],
  mount(ctx) {
    ctx.push((el) => {
      let cur = '0', prev = null, op = null, fresh = false, expr = '';
      const fmt = (v) => {
        const n = Number(v);
        if (!isFinite(n)) return 'Erreur';
        if (String(v).endsWith('.')) return v;
        return Math.abs(n) >= 1e12 ? n.toExponential(4) : n.toLocaleString('en-US', { maximumFractionDigits: 8 });
      };
      const calc = (a, b, o) => ({ '+': a + b, '−': a - b, '×': a * b, '÷': b === 0 ? NaN : a / b }[o]);
      const render = () => {
        el.querySelector('#c-expr').textContent = expr;
        const d = el.querySelector('#c-out');
        d.textContent = fmt(cur);
        d.style.fontSize = d.textContent.length > 9 ? '44px' : '72px';
        el.querySelectorAll('[data-op]').forEach((b) => b.classList.toggle('on', b.dataset.k === op && fresh));
      };
      const press = (k) => {
        if (/^[0-9]$/.test(k)) { cur = fresh || cur === '0' ? k : (cur.length < 14 ? cur + k : cur); fresh = false; }
        else if (k === '.') { if (fresh) { cur = '0.'; fresh = false; } else if (!cur.includes('.')) cur += '.'; }
        else if (k === 'C') { cur = '0'; prev = null; op = null; expr = ''; }
        else if (k === '±') cur = String(-Number(cur));
        else if (k === '%') cur = String(Number(cur) / 100);
        else if (['+', '−', '×', '÷'].includes(k)) {
          if (op && !fresh) { cur = String(calc(prev, Number(cur), op)); }
          prev = Number(cur); op = k; fresh = true; expr = `${fmt(prev)} ${k}`;
        } else if (k === '=') {
          if (op !== null) { expr = `${fmt(prev)} ${op} ${fmt(cur)} =`; cur = String(calc(prev, Number(cur), op)); op = null; prev = null; fresh = true; }
        }
        render();
      };
      el.innerHTML = `<div class="calc"><div class="c-screen"><div id="c-expr"></div><div id="c-out">0</div></div>
        <div class="c-keys">${KEYS.map(([k, cls]) => `<button class="${cls || ''}" data-k="${k}" ${cls === 'op' ? 'data-op' : ''}>${k}</button>`).join('')}</div></div>`;
      el.addEventListener('click', (e) => { const b = e.target.closest('[data-k]'); if (b) press(b.dataset.k); });
      const map = { '*': '×', '/': '÷', '-': '−', '+': '+', '=': '=', 'c': 'C', '%': '%', '.': '.', ',': '.' };
      ctx.on('key', (k) => { if (/^[0-9]$/.test(k)) press(k); else if (map[k]) press(map[k]); else if (k === 'delete') { cur = cur.length > 1 ? cur.slice(0, -1) : '0'; render(); } });
      render();
    }, { bg: '#121114' });
  },
};
