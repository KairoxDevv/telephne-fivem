// VELVET - casino en ligne. Toute la logique de gain est cote serveur.
import { T } from './_tiles.js';
import { icon } from '../core/icons.js';
import { esc, money, timeAgo, sleep } from '../core/util.js';
import { store } from '../core/store.js';
import { topbar, toast } from '../core/ui.js';
import { bus } from '../core/bus.js';

const SYM = { cherry: '🍒', lemon: '🍋', bell: '🔔', clover: '🍀', diamond: '💎', seven: '7' };
const SYM_IDS = Object.keys(SYM);
const symHTML = (id) => id === 'seven' ? '<b class="seven">7</b>' : `<span>${SYM[id]}</span>`;
const WHEEL = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

const GAMES = [
  { id: 'slots', name: 'Slots', tag: 'Jusqu\'a x250', art: '<div class="art-slots"><b>7</b><b>7</b><b>7</b></div>' },
  { id: 'roulette', name: 'Roulette', tag: 'Europeenne', art: '<div class="art-wheel"></div>' },
  { id: 'blackjack', name: 'Blackjack', tag: 'Paye 3:2', art: '<div class="art-cards"><i>A</i><i>K</i></div>' },
  { id: 'crash', name: 'Crash', tag: 'Encaisse avant la chute', art: '<div class="art-crash"><svg viewBox="0 0 100 60"><path d="M0 58 C 40 56, 70 40, 96 4" stroke="#E9E0D5" stroke-width="3" fill="none"/></svg></div>' },
  { id: 'mines', name: 'Mines', tag: 'Evite les bombes', art: '<div class="art-mines">' + '<i></i>'.repeat(9) + '</div>' },
  { id: 'dice', name: 'Dice', tag: 'Plus ou moins', art: '<div class="art-dice"><b>⚄</b></div>' },
];

let balance = 0;
const setBal = (b, root) => { if (typeof b === 'number') balance = b; root?.querySelectorAll('.v-bal').forEach((x) => { x.textContent = money(balance); }); };

function betBox(id, value) {
  const c = store.config.casino || { min: 10, max: 50000 };
  return `<div class="bet-box"><label>Mise</label>
    <div class="bet-ctl"><button data-bet="half">½</button><input class="input" id="${id}" type="number" min="${c.min}" max="${c.max}" value="${value}"><button data-bet="double">×2</button><button data-bet="max">Max</button></div></div>`;
}
function wireBet(el, id) {
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-bet]'); if (!b) return;
    const i = el.querySelector('#' + id); if (!i) return;
    const c = store.config.casino || { min: 10, max: 50000 };
    let v = +i.value || c.min;
    if (b.dataset.bet === 'half') v = Math.floor(v / 2);
    if (b.dataset.bet === 'double') v = v * 2;
    if (b.dataset.bet === 'max') v = Math.min(c.max, Math.floor(balance));
    i.value = Math.max(c.min, Math.min(c.max, v));
  });
}
const getBet = (el, id) => Math.floor(+el.querySelector('#' + id)?.value || 0);
const head = (title) => `<div class="v-head"><button class="icon-btn" data-nav="back">${icon('back')}</button><div class="v-title">${title}</div><div class="v-balance"><small>Solde</small><b class="v-bal">${money(balance)}</b></div></div>`;
const winBanner = (el, text, good = true) => {
  const b = el.querySelector('.v-result');
  if (!b) return;
  b.className = `v-result show ${good ? 'win' : 'lose'}`;
  b.textContent = text;
};

// ---------------------------------------------------------- SLOTS
function slots(ctx) {
  ctx.push((el) => {
    let spinning = false;
    const strip = (final) => {
      const items = [];
      for (let i = 0; i < 18; i++) items.push(SYM_IDS[Math.floor(Math.random() * SYM_IDS.length)]);
      items.push(...final);
      return items.map((s) => `<div class="sym">${symHTML(s)}</div>`).join('');
    };
    el.innerHTML = `${head('Slots')}
      <div class="v-body">
        <div class="slot-machine"><div class="payline"></div>
          ${[0, 1, 2].map((i) => `<div class="reel"><div class="strip" id="r${i}">${['cherry', 'seven', 'bell'].map((s) => `<div class="sym">${symHTML(s)}</div>`).join('')}</div></div>`).join('')}
        </div>
        <div class="v-result"></div>
        <div class="paytable">${[['seven', 250], ['diamond', 75], ['clover', 30], ['bell', 15], ['lemon', 8], ['cherry', 4]].map(([s, x]) => `<div>${symHTML(s)}${symHTML(s)}${symHTML(s)}<b>x${x}</b></div>`).join('')}<div>${symHTML('cherry')}${symHTML('cherry')}<b>x2</b></div></div>
        ${betBox('s-bet', 100)}
        <button class="btn v-play block" data-a="spin">Lancer</button>
      </div>`;
    wireBet(el, 's-bet');
    el.addEventListener('click', async (e) => {
      if (!e.target.closest('[data-a="spin"]') || spinning) return;
      spinning = true;
      el.querySelector('.v-result').className = 'v-result';
      const res = await ctx.srv('casino:slots', { bet: getBet(el, 's-bet') });
      if (!res || !res.ok) { spinning = false; return toast(res?.error || 'Erreur', true); }
      setBal(balance - getBet(el, 's-bet'), el);
      res.reels.forEach((r, i) => {
        const s = el.querySelector('#r' + i);
        s.style.transition = 'none';
        s.innerHTML = strip(r);
        s.style.transform = 'translateY(0)';
        void s.offsetWidth;
        s.style.transition = `transform ${1.2 + i * 0.45}s cubic-bezier(.2,.75,.25,1.04)`;
        s.style.transform = `translateY(calc(-18 * var(--sym)))`;
      });
      await sleep(1200 + 2 * 450 + 150);
      setBal(res.balance, el);
      if (res.payout > 0) { winBanner(el, `+${money(res.payout)}`); el.querySelector('.slot-machine').classList.add('jackpot'); setTimeout(() => el.querySelector('.slot-machine')?.classList.remove('jackpot'), 1600); }
      else winBanner(el, 'Perdu', false);
      spinning = false;
    });
  }, { bg: 'var(--v-bg)' });
}

// ---------------------------------------------------------- ROULETTE
function roulette(ctx) {
  ctx.push((el) => {
    let chip = 50, bets = [], spinning = false, rot = 0;
    const seg = 360 / 37;
    const wheelSVG = () => `<svg viewBox="-100 -100 200 200" class="wheel" id="wheel">${WHEEL.map((n, i) => {
      const a0 = (i * seg - 90 - seg / 2) * Math.PI / 180, a1 = ((i + 1) * seg - 90 - seg / 2) * Math.PI / 180;
      const col = n === 0 ? '#3f7a4c' : RED.has(n) ? '#762F43' : '#171619';
      const tx = Math.cos((a0 + a1) / 2) * 80, ty = Math.sin((a0 + a1) / 2) * 80;
      return `<path d="M0 0 L${Math.cos(a0) * 96} ${Math.sin(a0) * 96} A96 96 0 0 1 ${Math.cos(a1) * 96} ${Math.sin(a1) * 96} Z" fill="${col}" stroke="#29242A" stroke-width=".6"/>
        <text x="${tx}" y="${ty}" fill="#E9E0D5" font-size="8" font-weight="700" text-anchor="middle" dominant-baseline="middle" transform="rotate(${i * seg} ${tx} ${ty})">${n}</text>`;
    }).join('')}<circle r="58" fill="#29242A"/><circle r="56" fill="none" stroke="#E9E0D5" stroke-opacity=".12"/><circle r="10" fill="#E9E0D5"/></svg>`;
    const total = () => bets.reduce((s, b) => s + b.amount, 0);
    const chipOn = (type, value) => { const b = bets.find((x) => x.type === type && String(x.value ?? '') === String(value ?? '')); return b ? `<em class="pchip">${b.amount >= 1000 ? Math.round(b.amount / 100) / 10 + 'k' : b.amount}</em>` : ''; };
    const board = () => `<div class="rboard">
      <button class="rcell green zero" data-t="number" data-v="0">0${chipOn('number', 0)}</button>
      <div class="rnums">${[...Array(36)].map((_, i) => { const n = i + 1; return `<button class="rcell ${RED.has(n) ? 'red' : 'black'}" data-t="number" data-v="${n}">${n}${chipOn('number', n)}</button>`; }).join('')}</div>
      </div>
      <div class="routs">
        ${[['dozen', 1, '1-12'], ['dozen', 2, '13-24'], ['dozen', 3, '25-36']].map(([t, v, l]) => `<button data-t="${t}" data-v="${v}">${l}${chipOn(t, v)}</button>`).join('')}
        ${[['low', '', '1-18'], ['even', '', 'Pair'], ['red', '', '◆'], ['black', '', '◆'], ['odd', '', 'Impair'], ['high', '', '19-36']].map(([t, v, l]) => `<button data-t="${t}" data-v="${v}" class="${t === 'red' ? 'red' : t === 'black' ? 'black' : ''}">${l}${chipOn(t, v)}</button>`).join('')}
      </div>`;
    const render = () => {
      el.querySelector('#rb').innerHTML = board();
      el.querySelector('#rtotal').textContent = money(total());
    };
    el.innerHTML = `${head('Roulette')}
      <div class="v-body">
        <div class="wheel-wrap"><div class="ball-mark"></div>${wheelSVG()}<div class="wheel-num" id="wnum">?</div></div>
        <div class="v-result"></div>
        <div id="rb"></div>
        <div class="chips">${[10, 50, 100, 500, 1000, 5000].map((v) => `<button class="vchip ${v === chip ? 'on' : ''}" data-chip="${v}">${v >= 1000 ? v / 1000 + 'k' : v}</button>`).join('')}</div>
        <div class="r-foot"><button class="btn" data-a="clear">Effacer</button><div class="r-total"><small>Mise totale</small><b id="rtotal">$0</b></div><button class="btn v-play" data-a="spin">Tourner</button></div>
      </div>`;
    el.addEventListener('click', async (e) => {
      const c = e.target.closest('[data-chip]');
      if (c) { chip = +c.dataset.chip; el.querySelectorAll('[data-chip]').forEach((x) => x.classList.toggle('on', x === c)); return; }
      const cell = e.target.closest('[data-t]');
      if (cell && !spinning) {
        const type = cell.dataset.t, value = cell.dataset.v === '' ? null : +cell.dataset.v;
        const b = bets.find((x) => x.type === type && x.value === value);
        if (b) b.amount += chip; else bets.push({ type, value, amount: chip });
        return render();
      }
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (a === 'clear' && !spinning) { bets = []; render(); }
      if (a === 'spin' && !spinning) {
        if (!bets.length) return toast('Place des jetons', true);
        spinning = true;
        el.querySelector('.v-result').className = 'v-result';
        const res = await ctx.srv('casino:roulette', { bets });
        if (!res || !res.ok) { spinning = false; return toast(res?.error || 'Erreur', true); }
        setBal(balance - total(), el);
        const idx = WHEEL.indexOf(res.number);
        rot += 360 * 5 + (360 - ((rot % 360) + idx * seg) % 360);
        const w = el.querySelector('#wheel');
        w.style.transform = `rotate(${rot}deg)`;
        el.querySelector('#wnum').textContent = '';
        await sleep(4200);
        const wn = el.querySelector('#wnum');
        wn.textContent = res.number; wn.className = `wheel-num ${res.color}`;
        setBal(res.balance, el);
        winBanner(el, res.payout > 0 ? `${res.number} · +${money(res.payout)}` : `${res.number} · Perdu`, res.payout > 0);
        spinning = false;
      }
    });
    render();
  }, { bg: 'var(--v-bg)' });
}

// ---------------------------------------------------------- BLACKJACK
const cardHTML = (c, i = 0) => c.r === '?' ? `<div class="card back" style="animation-delay:${i * 90}ms"></div>`
  : `<div class="card ${c.s === 'H' || c.s === 'D' ? 'red' : ''}" style="animation-delay:${i * 90}ms"><b>${c.r}</b><span>${{ S: '♠', H: '♥', D: '♦', C: '♣' }[c.s]}</span><b class="rev">${c.r}</b></div>`;
function blackjack(ctx) {
  ctx.push((el) => {
    let g = null, busy = false;
    const RESULT = { win: 'Gagne', lose: 'Perdu', push: 'Egalite', bust: 'Depasse', blackjack: 'Blackjack !' };
    const render = () => {
      el.querySelector('#bj').innerHTML = g ? `
        <div class="hand"><div class="hand-lbl">Croupier <b>${g.dealerValue}</b></div><div class="cards">${g.dealer.map(cardHTML).join('')}</div></div>
        <div class="hand"><div class="hand-lbl">Toi <b>${g.playerValue}</b></div><div class="cards">${g.player.map(cardHTML).join('')}</div></div>`
        : `<div class="bj-empty"><div class="art-cards big"><i>A</i><i>J</i></div><p>Le croupier tire jusqu'a 17. Blackjack paye 3:2.</p></div>`;
      el.querySelector('#bj-ctl').innerHTML = g && !g.done ? `
        <div class="bj-acts"><button class="btn" data-a="hit">Carte</button><button class="btn" data-a="stand">Rester</button><button class="btn" data-a="double" ${g.canDouble ? '' : 'disabled'}>Doubler</button></div>`
        : `${betBox('bj-bet', g?.bet ? (g.result === 'blackjack' || g.result === 'win' ? g.bet : g.bet) : 100)}<button class="btn v-play block" data-a="deal">Distribuer</button>`;
      wireBetOnce();
    };
    let wired = false;
    const wireBetOnce = () => { if (!wired) { wireBet(el, 'bj-bet'); wired = true; } };
    el.innerHTML = `${head('Blackjack')}<div class="v-body"><div class="felt" id="bj"></div><div class="v-result"></div><div id="bj-ctl"></div></div>`;
    el.addEventListener('click', async (e) => {
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (!a || busy) return;
      busy = true;
      const payload = { action: a };
      if (a === 'deal') { payload.bet = getBet(el, 'bj-bet'); el.querySelector('.v-result').className = 'v-result'; }
      const res = await ctx.srv('casino:bj', payload);
      busy = false;
      if (!res || !res.ok) return toast(res?.error || 'Erreur', true);
      if (a === 'deal') setBal(balance - payload.bet, el);
      if (a === 'double') setBal(balance - res.bet / 2, el);
      g = res;
      render();
      if (g.done) {
        setBal(g.balance, el);
        winBanner(el, `${RESULT[g.result]}${g.payout > 0 ? ` · +${money(g.payout)}` : ''}`, ['win', 'blackjack', 'push'].includes(g.result));
      }
    });
    render();
  }, { bg: 'var(--v-bg)' });
}

// ---------------------------------------------------------- CRASH
function crash(ctx) {
  ctx.push((el) => {
    let state = 'idle', start = 0, growth = 0.075, raf = 0, history = [];
    el.innerHTML = `${head('Crash')}
      <div class="v-body">
        <div class="crash-box"><svg viewBox="0 0 300 170" preserveAspectRatio="none" id="cr-svg"><path id="cr-path" d="" fill="none" stroke="#E9E0D5" stroke-width="3" stroke-linecap="round"/><path id="cr-fill" d="" fill="url(#crg)"/><defs><linearGradient id="crg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9A4560" stop-opacity=".5"/><stop offset="1" stop-color="#9A4560" stop-opacity="0"/></linearGradient></defs></svg>
          <div class="cr-mult" id="cr-m">1.00×</div><div class="cr-hist" id="cr-h"></div></div>
        <div class="v-result"></div>
        ${betBox('cr-bet', 100)}
        <div class="field"><label>Encaissement auto (optionnel)</label><input class="input" id="cr-auto" type="number" step="0.1" min="1.01" placeholder="ex : 2.00"></div>
        <button class="btn v-play block" data-a="go" id="cr-btn">Miser</button>
      </div>`;
    wireBet(el, 'cr-bet');
    const draw = (m, t) => {
      el.querySelector('#cr-m').textContent = m.toFixed(2) + '×';
      const W = 300, H = 170, tMax = Math.max(8, t + 1), mMax = Math.max(2, m * 1.15);
      let d = '';
      for (let i = 0; i <= 40; i++) {
        const tt = (t * i) / 40, mm = Math.exp(growth * tt);
        const x = (tt / tMax) * W, y = H - ((mm - 1) / (mMax - 1)) * (H - 10);
        d += `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
      }
      el.querySelector('#cr-path').setAttribute('d', d);
      el.querySelector('#cr-fill').setAttribute('d', d + ` L${((t / tMax) * W).toFixed(1)} ${H} L0 ${H} Z`);
    };
    const loop = () => {
      if (state !== 'running') return;
      const t = (performance.now() - start) / 1000;
      draw(Math.exp(growth * t), t);
      raf = requestAnimationFrame(loop);
    };
    const end = (point, good, text) => {
      state = 'idle';
      cancelAnimationFrame(raf);
      const box = el.querySelector('.crash-box');
      box?.classList.toggle('crashed', !good);
      history.unshift(point);
      history = history.slice(0, 8);
      const h = el.querySelector('#cr-h');
      if (h) h.innerHTML = history.map((p) => `<span class="${p >= 2 ? 'hi' : ''}">${(+p).toFixed(2)}×</span>`).join('');
      const btn = el.querySelector('#cr-btn'); if (btn) { btn.textContent = 'Miser'; btn.classList.remove('cash'); }
      winBanner(el, text, good);
    };
    el.addEventListener('click', async (e) => {
      if (!e.target.closest('[data-a="go"]')) return;
      if (state === 'idle') {
        const bet = getBet(el, 'cr-bet');
        const auto = +el.querySelector('#cr-auto').value || null;
        const res = await ctx.srv('casino:crashStart', { bet, auto });
        if (!res || !res.ok) return toast(res?.error || 'Erreur', true);
        growth = res.growth || growth;
        setBal(res.balance, el);
        el.querySelector('.crash-box').classList.remove('crashed');
        el.querySelector('.v-result').className = 'v-result';
        state = 'running'; start = performance.now();
        const btn = el.querySelector('#cr-btn'); btn.textContent = 'Encaisser'; btn.classList.add('cash');
        loop();
      } else if (state === 'running') {
        const res = await ctx.srv('casino:crashCashout');
        if (res && res.ok) {
          state = 'cashed';
          setBal(res.balance, el);
          const btn = el.querySelector('#cr-btn'); btn.textContent = 'En attente du crash...'; btn.classList.remove('cash');
          winBanner(el, `Encaisse a ${res.multiplier.toFixed(2)}× · +${money(res.payout)}`);
        } else toast(res?.error || 'Trop tard', true);
      }
    });
    const off = bus.on('casinoCrash', (d) => {
      if (d.cashed) { state = 'cashed'; setBal(d.balance, el); winBanner(el, `Auto ${d.multiplier.toFixed(2)}× · +${money(d.payout)}`); const btn = el.querySelector('#cr-btn'); if (btn) { btn.textContent = 'En attente du crash...'; btn.classList.remove('cash'); } return; }
      if (d.crashed) { draw(d.point, Math.log(d.point) / growth); setBal(d.balance, el); end(d.point, false, `Crash a ${d.point.toFixed(2)}×`); }
      if (d.reveal && state === 'cashed') { draw(d.point, Math.log(d.point) / growth); end(d.point, true, el.querySelector('.v-result')?.textContent || 'Gagne'); }
    });
    return () => { off(); cancelAnimationFrame(raf); };
  }, { bg: 'var(--v-bg)' });
}

// ---------------------------------------------------------- MINES
function mines(ctx) {
  ctx.push((el) => {
    let game = null, count = 3;
    const render = () => {
      el.querySelector('#mg').innerHTML = [...Array(25)].map((_, i) => {
        const idx = i + 1;
        const st = game?.cells?.[idx];
        return `<button class="mcell ${st || ''}" data-i="${idx}" ${!game?.live || st ? 'disabled' : ''}>${st === 'gem' ? '◆' : st === 'bomb' || st === 'bombx' ? '✹' : ''}</button>`;
      }).join('');
      el.querySelector('#m-ctl').innerHTML = game?.live
        ? `<div class="m-info"><div><small>Multiplicateur</small><b>${game.mult.toFixed(2)}×</b></div><div><small>Prochain</small><b>${(game.next || 0).toFixed(2)}×</b></div><div><small>Gain</small><b>${money(Math.floor(game.bet * game.mult))}</b></div></div>
           <button class="btn v-play block cash" data-a="cash" ${game.picks ? '' : 'disabled'}>Encaisser</button>`
        : `<div class="field"><label>Mines : <b id="m-cnt">${count}</b></label><input type="range" min="1" max="24" value="${count}" id="m-range"></div>
           ${betBox('m-bet', game?.bet || 100)}<button class="btn v-play block" data-a="start">Jouer</button>`;
      const r = el.querySelector('#m-range');
      if (r) r.addEventListener('input', () => { count = +r.value; el.querySelector('#m-cnt').textContent = count; });
    };
    el.innerHTML = `${head('Mines')}<div class="v-body"><div class="mgrid" id="mg"></div><div class="v-result"></div><div id="m-ctl"></div></div>`;
    wireBet(el, 'm-bet');
    const reveal = (list, hit) => { list.forEach((i) => { if (!game.cells[i]) game.cells[i] = 'bomb'; }); if (hit) game.cells[hit] = 'bombx'; };
    el.addEventListener('click', async (e) => {
      const c = e.target.closest('[data-i]');
      if (c && game?.live) {
        const res = await ctx.srv('casino:mines', { action: 'reveal', index: +c.dataset.i });
        if (!res || !res.ok) return;
        if (res.boom) { game.live = false; reveal(res.mines, res.index); setBal(res.balance, el); winBanner(el, 'Boom ! Perdu', false); }
        else {
          game.cells[res.index] = 'gem'; game.mult = res.multiplier; game.next = res.next; game.picks++;
          if (res.cleared) { game.live = false; reveal(res.mines); setBal(res.balance, el); winBanner(el, `Grille nettoyee · +${money(res.payout)}`); }
        }
        return render();
      }
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (a === 'start') {
        const bet = getBet(el, 'm-bet');
        const res = await ctx.srv('casino:mines', { action: 'start', bet, mines: count });
        if (!res || !res.ok) return toast(res?.error || 'Erreur', true);
        el.querySelector('.v-result').className = 'v-result';
        game = { live: true, bet, mult: 1, next: res.next, picks: 0, cells: {} };
        setBal(res.balance, el);
        render();
      }
      if (a === 'cash') {
        const res = await ctx.srv('casino:mines', { action: 'cashout' });
        if (!res || !res.ok) return toast(res?.error || 'Erreur', true);
        game.live = false; reveal(res.mines); setBal(res.balance, el);
        winBanner(el, `${res.multiplier.toFixed(2)}× · +${money(res.payout)}`);
        render();
      }
    });
    render();
  }, { bg: 'var(--v-bg)' });
}

// ---------------------------------------------------------- DICE
function dice(ctx) {
  ctx.push((el) => {
    let target = 50, over = true, rolling = false;
    const edge = 0.02;
    const info = () => {
      const chance = over ? 100 - target : target;
      el.querySelector('#d-chance').textContent = chance + '%';
      el.querySelector('#d-mult').textContent = ((1 - edge) / (chance / 100)).toFixed(2) + '×';
      el.querySelector('#d-track').style.setProperty('--t', target + '%');
      el.querySelector('#d-track').classList.toggle('under', !over);
      el.querySelector('#d-lbl').textContent = over ? `Plus de ${target}` : `Moins de ${target}`;
    };
    el.innerHTML = `${head('Dice')}
      <div class="v-body">
        <div class="dice-roll" id="d-roll">50.00</div>
        <div class="d-track" id="d-track"><div class="d-fill"></div><div class="d-marker" id="d-marker"></div></div>
        <input type="range" min="2" max="98" value="50" id="d-range" class="d-range">
        <div class="m-info"><div><small>Condition</small><b id="d-lbl"></b></div><div><small>Chance</small><b id="d-chance"></b></div><div><small>Gain</small><b id="d-mult"></b></div></div>
        <div class="seg"><button class="on" data-o="1">Plus</button><button data-o="0">Moins</button></div>
        <div class="v-result"></div>
        ${betBox('d-bet', 100)}
        <button class="btn v-play block" data-a="roll">Lancer</button>
      </div>`;
    wireBet(el, 'd-bet');
    el.querySelector('#d-range').addEventListener('input', (e) => { target = +e.target.value; info(); });
    el.addEventListener('click', async (e) => {
      const o = e.target.closest('[data-o]');
      if (o) { over = o.dataset.o === '1'; el.querySelectorAll('[data-o]').forEach((x) => x.classList.toggle('on', x === o)); info(); return; }
      if (!e.target.closest('[data-a="roll"]') || rolling) return;
      rolling = true;
      el.querySelector('.v-result').className = 'v-result';
      const res = await ctx.srv('casino:dice', { bet: getBet(el, 'd-bet'), target, over });
      if (!res || !res.ok) { rolling = false; return toast(res?.error || 'Erreur', true); }
      const r = el.querySelector('#d-roll');
      const t0 = performance.now();
      await new Promise((done) => {
        const step = () => {
          const p = (performance.now() - t0) / 700;
          if (p >= 1) { r.textContent = res.roll.toFixed(2); return done(); }
          r.textContent = (Math.random() * 100).toFixed(2);
          requestAnimationFrame(step);
        };
        step();
      });
      r.className = `dice-roll ${res.win ? 'up' : 'down'}`;
      el.querySelector('#d-marker').style.left = res.roll + '%';
      el.querySelector('#d-marker').classList.add('show');
      setBal(res.balance, el);
      winBanner(el, res.win ? `+${money(res.payout)}` : 'Perdu', res.win);
      rolling = false;
    });
    info();
  }, { bg: 'var(--v-bg)' });
}

const OPEN = { slots, roulette, blackjack, crash, mines, dice };

export default {
  id: 'casino', name: 'Velvet', icon: 'casino', bg: T.velvet[0], fg: T.velvet[1],
  viewBg: 'var(--v-bg)',
  mount(ctx) {
    ctx.push((el, _c, entry) => {
      let lobby = null;
      const load = async () => {
        lobby = await ctx.srv('casino:lobby');
        if (lobby && lobby.ok) setBal(lobby.balance);
        render();
      };
      const render = () => {
        const net = lobby?.stats?.net || 0;
        el.innerHTML = `<div class="v-lobby">
          <div class="v-hero">
            <div class="v-curtain"></div>
            <div class="v-logo">Velvet</div>
            <div class="v-sub">Casino en ligne · Los Santos</div>
            <div class="v-wallet"><div><small>Solde bancaire</small><b class="v-bal">${money(balance)}</b></div><div><small>Ton bilan</small><b class="${net >= 0 ? 'up' : 'down'}">${net >= 0 ? '+' : ''}${money(net)}</b></div></div>
          </div>
          <div class="v-games">${GAMES.map((g, i) => `<button class="v-game" data-g="${g.id}" style="animation-delay:${i * 50}ms">${g.art}<div class="vg-txt"><b>${g.name}</b><small>${g.tag}</small></div></button>`).join('')}</div>
          <div class="section-title">Gros gains de la semaine</div>
          <div class="list">${(lobby?.top || []).map((t, i) => `<div class="row v-row"><span class="v-rank">${i + 1}</span><div class="r-main"><div class="r-title">${esc(t.name || 'Anonyme')}</div><div class="r-sub">${esc(t.game)} · ${timeAgo(t.ts)}</div></div><div class="r-end"><b class="up">+${money(t.payout - t.bet)}</b></div></div>`).join('') || '<div class="empty">Personne n\'a encore gagne gros. A toi.</div>'}</div>
          <div class="section-title">Tes dernieres parties</div>
          <div class="list">${(lobby?.history || []).slice(0, 8).map((h) => `<div class="row v-row"><div class="r-main"><div class="r-title">${esc(h.game)}</div><div class="r-sub">Mise ${money(h.bet)} · ${timeAgo(h.ts)}</div></div><div class="r-end"><b class="${h.payout > h.bet ? 'up' : h.payout === h.bet ? '' : 'down'}">${h.payout - h.bet >= 0 ? '+' : ''}${money(h.payout - h.bet)}</b></div></div>`).join('') || '<div class="empty">Aucune partie</div>'}</div>
          <p class="v-legal">Jeu responsable. Les gains et pertes sont preleves sur ton compte bancaire.</p>
        </div>`;
      };
      el.addEventListener('click', (e) => {
        const g = e.target.closest('[data-g]');
        if (g) OPEN[g.dataset.g](ctx);
      });
      entry.onShow = load;
      render();
      load();
    }, { bg: 'var(--v-bg)' });
  },
};
