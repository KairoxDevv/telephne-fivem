import { T } from './_tiles.js';
import { icon } from '../core/icons.js';
import { esc, money, num, timeAgo, copyText } from '../core/util.js';
import { store } from '../core/store.js';
import { topbar, toast, result, sheet } from '../core/ui.js';

function chart(history, color, w = 340, h = 150) {
  if (!history || history.length < 2) return '';
  const min = Math.min(...history), max = Math.max(...history);
  const span = max - min || 1;
  const pts = history.map((v, i) => [(i / (history.length - 1)) * w, h - 8 - ((v - min) / span) * (h - 16)]);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const id = 'cg' + Math.random().toString(36).slice(2, 7);
  return `<svg viewBox="0 0 ${w} ${h}" class="cchart" preserveAspectRatio="none">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".35"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
    <path d="${d} L${w} ${h} L0 ${h} Z" fill="url(#${id})"/>
    <path d="${d}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" class="cline"/>
    <circle cx="${pts[pts.length - 1][0]}" cy="${pts[pts.length - 1][1]}" r="4" fill="${color}" class="cdot"/>
  </svg>`;
}
const spark = (h, c) => chart(h, c, 70, 28);
const coinBadge = (c) => `<span class="coin" style="background:${c.color}">${esc(c.symbol[0])}</span>`;

export default {
  id: 'crypto', name: 'Crypto', icon: 'crypto', bg: T.plum[0], fg: T.plum[1],
  mount(ctx) {
    let data = null;
    const load = async () => { data = await ctx.srv('crypto:data'); return data && data.ok; };
    const portfolio = () => data.market.reduce((s, c) => s + (data.wallet[c.id] || 0) * c.price, 0);

    const trade = (mode, coin, after) => {
      const c = coin || data.market[0];
      const s = sheet(`<h3>${{ buy: 'Acheter', sell: 'Vendre', send: 'Envoyer' }[mode]}</h3>
        <div class="field"><label>Crypto</label><div class="coin-pick">${data.market.map((m) => `<button data-c="${m.id}" class="${m.id === c.id ? 'on' : ''}">${coinBadge(m)}${m.symbol}</button>`).join('')}</div></div>
        <div class="field"><label id="tr-lbl"></label><input class="input amount" id="tr-amt" type="number" min="0" step="any" placeholder="0"></div>
        ${mode === 'send' ? `<div class="field"><label>Portefeuille ou numero du destinataire</label><input class="input" id="tr-to" maxlength="30" placeholder="OBX-ABC12345 ou 5551234567"></div>` : ''}
        <div class="tr-info" id="tr-info"></div>
        <div class="sheet-actions"><button class="btn" data-x="max">Max</button><button class="btn primary" data-x="go">Valider</button></div>`);
      let cur = c;
      const info = () => {
        const v = +s.el.querySelector('#tr-amt').value || 0;
        s.el.querySelector('#tr-lbl').textContent = mode === 'buy' ? `Montant en ${store.config.currency || '$'}` : `Quantite de ${cur.symbol}`;
        const held = data.wallet[cur.id] || 0;
        s.el.querySelector('#tr-info').innerHTML = mode === 'buy'
          ? `≈ <b>${num((v * (1 - data.fees.buy)) / cur.price, 6)} ${cur.symbol}</b> · frais ${data.fees.buy * 100}% · banque ${money(data.bank)}`
          : `≈ <b>${money(v * cur.price * (mode === 'sell' ? 1 - data.fees.sell : 1), 2)}</b> · tu as ${num(held, 6)} ${cur.symbol}`;
      };
      s.el.addEventListener('input', info);
      s.el.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-c]');
        if (b) { cur = data.market.find((m) => m.id === b.dataset.c); s.el.querySelectorAll('[data-c]').forEach((x) => x.classList.toggle('on', x === b)); info(); return; }
        const x = e.target.closest('[data-x]')?.dataset.x;
        const input = s.el.querySelector('#tr-amt');
        if (x === 'max') { input.value = mode === 'buy' ? Math.floor(data.bank) : (data.wallet[cur.id] || 0); info(); }
        if (x === 'go') {
          const v = +input.value;
          if (!v || v <= 0) return toast('Montant invalide', true);
          let res;
          if (mode === 'buy') res = await ctx.srv('crypto:buy', { coin: cur.id, dollars: Math.floor(v) });
          if (mode === 'sell') res = await ctx.srv('crypto:sell', { coin: cur.id, qty: v });
          if (mode === 'send') res = await ctx.srv('crypto:transfer', { coin: cur.id, qty: v, to: s.el.querySelector('#tr-to').value.trim() });
          if (result(res, mode === 'buy' ? `+${num(res?.qty, 6)} ${cur.symbol}` : mode === 'sell' ? `+${money(res?.dollars)}` : 'Envoye')) {
            s.close(); await load(); after && after();
          }
        }
      });
      info();
    };

    const detail = (coin) => ctx.push((el) => {
      const render = () => {
        const c = data.market.find((m) => m.id === coin.id);
        const held = data.wallet[c.id] || 0;
        el.innerHTML = `${topbar(c.name, { sub: c.symbol })}
        <div class="body">
          <div class="c-price">${money(c.price, 2)} <span class="${c.change >= 0 ? 'up' : 'down'}">${c.change >= 0 ? '+' : ''}${c.change}%</span></div>
          <div class="chart-box">${chart(c.history, c.color)}</div>
          <div class="c-hold"><div><small>Tu possedes</small><b>${num(held, 6)} ${c.symbol}</b></div><div><small>Valeur</small><b>${money(held * c.price, 2)}</b></div></div>
          <div class="crypto-actions">
            <button class="ca on" data-m="buy">${icon('plus')}Acheter</button>
            <button class="ca" data-m="sell">${icon('arrowUp')}Vendre</button>
            <button class="ca" data-m="send">${icon('send')}Envoyer</button>
          </div>
        </div>`;
      };
      el.addEventListener('click', (e) => { const m = e.target.closest('[data-m]'); if (m) trade(m.dataset.m, coin, render); });
      const off = ctx.on('cryptoTick', (m) => { data.market = m; render(); });
      render();
      return off;
    });

    ctx.push((el, _c, entry) => {
      let tab = 'market', q = '';
      const render = () => {
        if (!data || !data.ok) { el.innerHTML = '<div class="empty" style="margin-top:120px">Marche indisponible</div>'; return; }
        const list = data.market.filter((c) => !q || c.name.toLowerCase().includes(q) || c.symbol.toLowerCase().includes(q));
        const last = data.transactions[0];
        el.innerHTML = `<div class="top crypto-top"><span class="crypto-logo">${icon('crypto')}</span><div class="grow"><h2>Crypto</h2><div class="sub">${last ? `${{ buy: 'Achete', sell: 'Vendu', send: 'Envoye', receive: 'Recu' }[last.type]} ${num(last.amount, 5)} ${last.coin.toUpperCase()}` : 'Portefeuille ' + esc(data.walletId)}</div></div></div>
        <div class="body">
          ${tab === 'market' ? `
          <div class="search">${icon('search')}<input id="cq" placeholder="Rechercher" value="${esc(q)}"></div>
          <div class="crypto-actions">
            <button class="ca on" data-m="buy">${icon('plus')}Acheter</button>
            <button class="ca" data-m="sell">${icon('arrowUp')}Vendre</button>
            <button class="ca" data-m="send">${icon('send')}Envoyer</button>
          </div>
          <div class="section-title">Tendances</div>
          <div class="list">${list.map((c) => `<button class="row" data-coin="${c.id}">${coinBadge(c)}<div class="r-main"><div class="r-title">${esc(c.name)}</div><div class="r-sub">${c.symbol}</div></div>
            <div class="spark">${spark(c.history.slice(-16), c.color)}</div>
            <div class="r-end"><b>${money(c.price, 2)}</b><span class="${c.change >= 0 ? 'up' : 'down'}">${c.change >= 0 ? '+' : ''}${c.change}%</span></div></button>`).join('')}</div>`
          : `
          <div class="wallet-card"><small>Valeur du portefeuille</small><b>${money(portfolio(), 2)}</b><button class="chip" data-a="wid">${esc(data.walletId)} ${icon('copy', 'style="width:13px"')}</button></div>
          <div class="section-title">Mes actifs</div>
          <div class="list">${data.market.filter((c) => data.wallet[c.id] > 0).map((c) => `<button class="row" data-coin="${c.id}">${coinBadge(c)}<div class="r-main"><div class="r-title">${num(data.wallet[c.id], 6)} ${c.symbol}</div><div class="r-sub">${esc(c.name)}</div></div><div class="r-end"><b>${money(data.wallet[c.id] * c.price, 2)}</b></div></button>`).join('') || `<div class="empty">${icon('wallet')}Portefeuille vide</div>`}</div>
          <div class="section-title">Historique</div>
          <div class="list">${data.transactions.map((t) => `<div class="row"><div class="r-main"><div class="r-title">${{ buy: 'Achat', sell: 'Vente', send: 'Envoi', receive: 'Reception' }[t.type]} ${t.coin.toUpperCase()}</div><div class="r-sub">${timeAgo(t.ts)} · ${money(t.price, 2)}</div></div><div class="r-end"><b>${t.type === 'buy' || t.type === 'receive' ? '+' : '-'}${num(t.amount, 5)}</b></div></div>`).join('') || '<div class="empty">Aucune transaction</div>'}</div>`}
        </div>
        <div class="tabbar"><span class="keycap" data-k="q">Q</span><div class="tabs">
          <button class="tab ${tab === 'market' ? 'on' : ''}" data-tab="market">${icon('home')}</button>
          <button class="tab ${tab === 'wallet' ? 'on' : ''}" data-tab="wallet">${icon('wallet')}</button>
        </div><span class="keycap" data-k="e">E</span></div>`;
        const cq = el.querySelector('#cq');
        if (cq) cq.addEventListener('input', () => { q = cq.value.toLowerCase(); render(); const n = el.querySelector('#cq'); n.focus(); n.setSelectionRange(q.length, q.length); });
      };
      const change = () => { tab = tab === 'market' ? 'wallet' : 'market'; render(); };
      ctx.tabs({ change });
      el.addEventListener('click', (e) => {
        const t = e.target.closest('[data-tab]'); if (t) { tab = t.dataset.tab; render(); return; }
        if (e.target.closest('[data-k]')) return change();
        const c = e.target.closest('[data-coin]'); if (c) return detail(data.market.find((m) => m.id === c.dataset.coin));
        const m = e.target.closest('[data-m]'); if (m) return trade(m.dataset.m, null, render);
        if (e.target.closest('[data-a="wid"]')) { copyText(data.walletId); toast('Adresse copiee'); }
      });
      ctx.on('cryptoTick', (m) => { if (data) { data.market = m; if (el.style.display !== 'none') render(); } });
      entry.onShow = render;
      el.innerHTML = '<div class="empty" style="margin-top:140px">Chargement du marche...</div>';
      load().then(render);
    }, { bg: 'linear-gradient(180deg,#1d1a20,#171619 40%)' });
  },
};
