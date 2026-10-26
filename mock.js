// Serveur factice : permet de tester l'interface dans un navigateur (hors FiveM)
import { bus } from './core/bus.js';

const now = () => Math.floor(Date.now() / 1000);
let bank = 52470, idSeq = 100;
const me = { citizenid: 'ABC12345', number: '5550142', name: 'Bablu Plays', firstname: 'Bablu', job: { name: 'police', label: 'LSPD', grade: 'Sergent' } };
const contacts = [
  { id: 1, name: 'Lena Moreau', number: '5550199', favorite: 1 },
  { id: 2, name: 'Marcus Vale', number: '5550123', favorite: 1 },
  { id: 3, name: 'Dr. Ines Hart', number: '5550877', favorite: 0 },
  { id: 4, name: 'Tony Benedetti', number: '5550331', favorite: 0 },
  { id: 5, name: 'Yara Okafor', number: '5550612', favorite: 0 },
];
const coins = [['bolt', 'Boltcoin', 'BOLT', '#8B5CF6', 23.56], ['ncho', 'Nacho', 'NCHO', '#F59E0B', 18.44], ['ktl', 'Kettle', 'KTL', '#22C55E', 41.63], ['pstn', 'Piston', 'PSTN', '#0EA5E9', 69.74], ['tide', 'Tide', 'TIDE', '#F43F5E', 34.88], ['pxl', 'Pixel', 'PXL', '#E879F9', 7.03]];
const market = coins.map(([id, name, symbol, color, price]) => {
  const h = []; let p = price * 0.92;
  for (let i = 0; i < 48; i++) { p *= 1 + (Math.random() - 0.48) * 0.04; h.push(+p.toFixed(2)); }
  h[47] = price;
  return { id, name, symbol, color, price, change: +(((price - h[0]) / h[0]) * 100).toFixed(2), history: h };
});
const wallet = { bolt: 4.24455, ktl: 1.2 };
const convs = [
  { id: 1, name: 'Fun Zone', is_group: true, last_message: 'Ce soir 22h au Vanilla ?', ts: now() - 300, unread: 2, members: ['5550142', '5550199', '5550123'] },
  { id: 2, name: 'Lena Moreau', peer: '5550199', is_group: false, last_message: 'Tu me dois toujours 200 balles', ts: now() - 3600, unread: 0, members: ['5550142', '5550199'] },
  { id: 3, name: 'Marcus Vale', peer: '5550123', is_group: false, last_message: 'Position partagee', ts: now() - 86400, unread: 0, members: ['5550142', '5550123'] },
];
const msgs = {
  1: [{ id: 1, sender: '5550199', content: 'Qui est chaud ce soir ?', ts: now() - 900 }, { id: 2, sender: '5550123', content: 'Moi. Je ramene la Sultan', ts: now() - 600 }, { id: 3, sender: '5550142', content: 'Je finis mon service et j\'arrive', ts: now() - 500 }, { id: 4, sender: '5550199', content: 'Ce soir 22h au Vanilla ?', ts: now() - 300 }],
  2: [{ id: 5, sender: '5550199', content: 'Tu me dois toujours 200 balles', ts: now() - 3600 }],
  3: [{ id: 6, sender: '5550123', content: '', attachment: { type: 'gps', x: 120, y: -800 }, ts: now() - 86400 }],
};
let lockBj = null;

const H = {
  boot: () => ({
    ok: true, me, settings: {}, apps: ['phone', 'messages', 'contacts', 'camera', 'gallery', 'settings', 'store', 'bank', 'crypto', 'casino', 'garage', 'notes', 'calculator', 'services'],
    setupDone: !location.hash.includes('setup'), badges: { messages: 2, phone: 1 },
    config: {
      currency: '$', zooms: [0.5, 1, 3], coins, video: true,
      filters: ['None', 'Mono', 'Noir', 'Noir Soft', 'Cold', 'Neutral', 'Crunch', 'Film 1', 'Film 2', 'Film 3', 'Film 4'].map((l) => ({ id: l.toLowerCase().replace(/\s/g, ''), label: l })).map((f, i) => (i === 0 ? { ...f, id: 'none' } : f)),
      catalog: ['phone', 'messages', 'contacts', 'camera', 'gallery', 'settings', 'store', 'bank', 'crypto', 'casino', 'garage', 'notes', 'calculator', 'services', 'pulse', 'ads'].map((id) => ({ id, core: ['phone', 'messages', 'contacts', 'camera', 'gallery', 'settings', 'store'].includes(id) })),
      casino: { min: 10, max: 50000 }, emergency: { 911: 'Urgences', 112: 'Urgences', 555: 'Depannage' },
    },
  }),
  saveSettings: () => ({ ok: true }), setAirplane: () => ({ ok: true }), factoryReset: () => ({ ok: true }),
  setApps: (d) => ({ ok: true, apps: d.apps }),
  'contacts:list': () => contacts,
  'contacts:save': (d) => { if (d.id) Object.assign(contacts.find((c) => c.id === d.id), d); else contacts.push({ ...d, id: ++idSeq, favorite: 0 }); return { ok: true }; },
  'contacts:delete': (d) => { contacts.splice(contacts.findIndex((c) => c.id === d.id), 1); return { ok: true }; },
  'calls:recent': () => [
    { id: 1, number: '5550199', name: 'Lena Moreau', status: 'answered', duration: 184, outgoing: false, ts: now() - 1200 },
    { id: 2, number: '5550877', name: 'Dr. Ines Hart', status: 'missed', duration: 0, outgoing: false, ts: now() - 7200 },
    { id: 3, number: '911', name: 'Urgences', status: 'answered', duration: 61, outgoing: true, ts: now() - 86400 },
    { id: 4, number: '5550123', name: 'Marcus Vale', status: 'answered', duration: 420, video: true, outgoing: true, ts: now() - 172800 },
  ],
  'calls:clearRecent': () => ({ ok: true }),
  'messages:list': () => convs,
  'messages:open': (d) => {
    let c = convs.find((x) => x.id === d.id) || convs.find((x) => x.peer === d.number);
    if (!c) { c = { id: ++idSeq, name: contacts.find((x) => x.number === d.number)?.name || d.number, peer: d.number, members: ['5550142', d.number], ts: now(), unread: 0 }; convs.unshift(c); msgs[c.id] = []; }
    c.unread = 0;
    const names = {}; c.members.forEach((n) => { names[n] = n === me.number ? 'Moi' : contacts.find((x) => x.number === n)?.name || n; });
    return { ok: true, id: c.id, title: c.name, isGroup: c.is_group, peer: c.peer, members: c.members, names, messages: msgs[c.id] || [] };
  },
  'messages:send': (d) => {
    const m = { id: ++idSeq, conversation: d.id, sender: me.number, content: d.content, attachment: d.attachment?.type === 'gps' ? { type: 'gps', x: 1, y: 1 } : d.attachment, ts: now() };
    (msgs[d.id] ||= []).push(m);
    const c = convs.find((x) => x.id === d.id); if (c) { c.last_message = d.content || 'Piece jointe'; c.ts = now(); }
    if (d.content) setTimeout(() => bus.emit('message', { message: { id: ++idSeq, conversation: d.id, sender: c?.peer || '5550199', content: 'Bien recu 👍', ts: now() }, notify: { app: 'messages', title: c?.name || 'Lena', body: 'Bien recu 👍' } }), 2200);
    return { ok: true, message: m };
  },
  'messages:createGroup': (d) => { const c = { id: ++idSeq, name: d.name || 'Groupe', is_group: true, members: [me.number, ...d.members], ts: now(), unread: 0 }; convs.unshift(c); msgs[c.id] = []; return { ok: true, id: c.id }; },
  'messages:read': () => ({ ok: true }), 'messages:leave': () => ({ ok: true }), 'messages:addMember': () => ({ ok: true }),
  'gallery:list': () => [],
  'gallery:delete': () => ({ ok: true }),
  'notes:list': () => [{ id: 1, title: 'Planque', content: 'Code du hangar : 4471. Ne pas oublier les gants.', color: '#762F43', ts: now() - 5000 }, { id: 2, title: 'Courses', content: 'Kit de reparation, sandwichs, radio', color: '#29242A', ts: now() - 90000 }],
  'notes:save': (d) => ({ ok: true, id: d.id || ++idSeq }), 'notes:delete': () => ({ ok: true }),
  'bank:data': () => ({
    ok: true, balance: bank, cash: 1840, accountId: me.citizenid, iban: 'LS-12736475', name: me.name, job: 'LSPD',
    transactions: [
      { id: 1, label: 'Salaire LSPD', amount: 3200, type: 'in', ts: now() - 3600 },
      { id: 2, label: 'Casino - Slots (gain)', amount: 1500, type: 'in', ts: now() - 20000 },
      { id: 3, label: 'Virement a Lena Moreau - Loyer', amount: 900, type: 'out', ts: now() - 90000 },
      { id: 4, label: 'Achat 4.24455 BOLT', amount: 100, type: 'out', ts: now() - 180000 },
      { id: 5, label: 'Facture : Benny\'s Motorworks', amount: 640, type: 'out', ts: now() - 300000 },
      { id: 6, label: 'Virement de Marcus Vale', amount: 2000, type: 'in', ts: now() - 400000 },
    ],
    invoices: [{ id: 9, label: 'Soins - Pillbox', amount: 450, society: 'ambulance', sender_name: 'Dr. Ines Hart', ts: now() - 7000 }],
  }),
  'bank:transfer': (d) => { if (d.amount > bank) return { ok: false, error: 'Solde insuffisant' }; bank -= d.amount; return { ok: true }; },
  'bank:payInvoice': () => { bank -= 450; return { ok: true }; },
  'crypto:data': () => ({ ok: true, market, wallet, bank, walletId: 'OBX-ABC12345', fees: { buy: 0.01, sell: 0.01 }, transactions: [{ coin: 'bolt', type: 'buy', amount: 4.24455, price: 23.31, ts: now() - 180000 }] }),
  'crypto:buy': (d) => { const c = market.find((x) => x.id === d.coin); const q = +(d.dollars * 0.99 / c.price).toFixed(6); wallet[d.coin] = (wallet[d.coin] || 0) + q; bank -= d.dollars; return { ok: true, qty: q }; },
  'crypto:sell': (d) => { const c = market.find((x) => x.id === d.coin); wallet[d.coin] -= d.qty; const v = Math.floor(d.qty * c.price * 0.99); bank += v; return { ok: true, dollars: v }; },
  'crypto:transfer': (d) => { wallet[d.coin] -= d.qty; return { ok: true }; },
  'casino:lobby': () => ({ ok: true, balance: bank, stats: { net: 1240 }, top: [{ name: 'Tony Benedetti', game: 'Crash', bet: 2000, payout: 31400, ts: now() - 8000 }, { name: 'Yara Okafor', game: 'Slots', bet: 500, payout: 15000, ts: now() - 50000 }, { name: 'Bablu Plays', game: 'Blackjack', bet: 1000, payout: 2500, ts: now() - 90000 }], history: [{ game: 'Slots', bet: 100, payout: 400, ts: now() - 2000 }, { game: 'Roulette', bet: 250, payout: 0, ts: now() - 4000 }] }),
  'casino:slots': (d) => {
    const ids = ['cherry', 'lemon', 'bell', 'clover', 'diamond', 'seven'];
    const r = () => ids[Math.floor(Math.random() * ids.length)];
    const line = Math.random() < 0.25 ? Array(3).fill(r()) : [r(), r(), r()];
    const pays = { cherry: 4, lemon: 8, bell: 15, clover: 30, diamond: 75, seven: 250 };
    const payout = line[0] === line[1] && line[1] === line[2] ? d.bet * pays[line[0]] : 0;
    bank += payout - d.bet;
    return { ok: true, reels: line.map((m) => [r(), m, r()]), payout, balance: bank };
  },
  'casino:roulette': (d) => {
    const n = Math.floor(Math.random() * 37); const RED = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
    let pay = 0; const tot = d.bets.reduce((s, b) => s + b.amount, 0);
    d.bets.forEach((b) => { if (b.type === 'number' && b.value === n) pay += b.amount * 36; if (n && b.type === 'red' && RED.includes(n)) pay += b.amount * 2; if (n && b.type === 'black' && !RED.includes(n)) pay += b.amount * 2; if (n && b.type === 'even' && n % 2 === 0) pay += b.amount * 2; if (n && b.type === 'odd' && n % 2) pay += b.amount * 2; if (n && b.type === 'low' && n <= 18) pay += b.amount * 2; if (n && b.type === 'high' && n > 18) pay += b.amount * 2; if (n && b.type === 'dozen' && Math.ceil(n / 12) === b.value) pay += b.amount * 3; });
    bank += pay - tot;
    return { ok: true, number: n, color: n === 0 ? 'green' : RED.includes(n) ? 'red' : 'black', payout: pay, balance: bank };
  },
  'casino:bj': (d) => {
    const card = () => ({ r: ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'][Math.floor(Math.random() * 13)], s: 'SHDC'[Math.floor(Math.random() * 4)] });
    const val = (h) => { let t = 0, a = 0; h.forEach((c) => { if (c.r === 'A') { t += 11; a++; } else if ('JQK'.includes(c.r)) t += 10; else t += +c.r; }); while (t > 21 && a) { t -= 10; a--; } return t; };
    const view = (g, rev) => ({ ok: true, player: g.p, dealer: rev ? g.d : [g.d[0], { r: '?', s: '?' }], playerValue: val(g.p), dealerValue: rev ? val(g.d) : val([g.d[0]]), bet: g.bet, done: g.done, result: g.result, payout: g.payout, canDouble: g.p.length === 2, balance: bank });
    const fin = (g, r, m) => { g.done = true; g.result = r; g.payout = Math.floor(g.bet * m); bank += g.payout; lockBj = null; return view(g, true); };
    const dealer = (g) => { while (val(g.d) < 17) g.d.push(card()); const p = val(g.p), q = val(g.d); return q > 21 || p > q ? fin(g, 'win', 2) : p === q ? fin(g, 'push', 1) : fin(g, 'lose', 0); };
    if (d.action === 'deal') { bank -= d.bet; lockBj = { bet: d.bet, p: [card(), card()], d: [card(), card()] }; if (val(lockBj.p) === 21) return fin(lockBj, 'blackjack', 2.5); return view(lockBj, false); }
    const g = lockBj; if (!g) return { ok: false };
    if (d.action === 'hit') { g.p.push(card()); if (val(g.p) > 21) return fin(g, 'bust', 0); return view(g, false); }
    if (d.action === 'stand') return dealer(g);
    if (d.action === 'double') { bank -= g.bet; g.bet *= 2; g.p.push(card()); if (val(g.p) > 21) return fin(g, 'bust', 0); return dealer(g); }
  },
  'casino:crashStart': (d) => {
    bank -= d.bet; const point = Math.max(1, +(0.96 / (1 - Math.random())).toFixed(2)); const start = Date.now();
    H._crash = { bet: d.bet, point, start };
    setTimeout(() => { if (H._crash && H._crash.start === start) { H._crash = null; bus.emit('casinoCrash', { crashed: true, point, balance: bank }); } else bus.emit('casinoCrash', { reveal: true, point }); }, Math.log(point) / 0.075 * 1000);
    return { ok: true, growth: 0.075, balance: bank };
  },
  'casino:crashCashout': () => { const g = H._crash; if (!g) return { ok: false, error: 'Trop tard' }; const m = Math.floor(Math.exp(0.075 * (Date.now() - g.start) / 1000) * 100) / 100; H._crash = null; const p = Math.floor(g.bet * m); bank += p; return { ok: true, multiplier: m, payout: p, balance: bank }; },
  'casino:mines': (d) => {
    if (d.action === 'start') { bank -= d.bet; const s = new Set(); while (s.size < d.mines) s.add(1 + Math.floor(Math.random() * 25)); H._m = { bet: d.bet, set: s, n: d.mines, picks: 0 }; return { ok: true, next: +(25 / (25 - d.mines) * 0.97).toFixed(2), balance: bank }; }
    const g = H._m; const mult = (k) => { let m = 1; for (let i = 0; i < k; i++) m *= (25 - i) / (25 - g.n - i); return +(m * 0.97).toFixed(2); };
    if (d.action === 'reveal') { if (g.set.has(d.index)) { H._m = null; return { ok: true, boom: true, index: d.index, mines: [...g.set], balance: bank }; } g.picks++; return { ok: true, index: d.index, multiplier: mult(g.picks), next: mult(g.picks + 1) }; }
    if (d.action === 'cashout') { const m = mult(g.picks); const p = Math.floor(g.bet * m); bank += p; H._m = null; return { ok: true, cashed: true, multiplier: m, payout: p, mines: [...g.set], balance: bank }; }
  },
  'casino:dice': (d) => { const roll = +(Math.random() * 100).toFixed(2); const ch = d.over ? 100 - d.target : d.target; const win = d.over ? roll > d.target : roll < d.target; const m = 0.98 / (ch / 100); const p = win ? Math.floor(d.bet * m) : 0; bank += p - d.bet; return { ok: true, roll, win, multiplier: m, payout: p, balance: bank }; },
  'garage:list': () => [
    { vehicle: 'sultanrs', label: 'Karin Sultan RS', plate: 'OBX 742', garage: 'Legion Square', state: 0, fuel: 64, engine: 92, body: 71 },
    { vehicle: 'police3', label: 'Vapid Interceptor', plate: 'LSPD 19', garage: 'Mission Row', state: 1, fuel: 100, engine: 100, body: 98 },
    { vehicle: 'bati', label: 'Pegassi Bati 801', plate: 'VEL 007', garage: 'Fourriere', state: 2, fuel: 22, engine: 41, body: 28 },
  ],
  'services:list': () => [
    { job: 'police', label: 'LSPD', icon: 'shield', color: '#3b5b8c', online: 6 }, { job: 'ambulance', label: 'EMS', icon: 'cross', color: '#8c3b45', online: 3 },
    { job: 'mechanic', label: 'Mecano', icon: 'wrench', color: '#8c6a3b', online: 2 }, { job: 'taxi', label: 'Taxi', icon: 'car', color: '#a38a2e', online: 0 },
  ],
  'services:message': () => ({ ok: true, sent: 3 }),
  'pulse:feed': () => [{ id: 1, author: 'Lena Moreau', handle: '@lenam', content: 'Qui a vu la course sur la Great Ocean hier ? Dingue.', likeCount: 12, ts: now() - 2000 }],
  'pulse:post': () => ({ ok: true }), 'pulse:like': () => ({ ok: true, liked: true, count: 13 }),
  'ads:list': () => [{ id: 1, author: 'Tony Benedetti', number: '5550331', title: 'Vends Sultan RS', content: 'Full perf, jamais accidentee (presque).', price: 85000, ts: now() - 6000 }],
  'ads:post': () => ({ ok: true }),
};

export async function post(name, data) {
  await new Promise((r) => setTimeout(r, 90));
  if (name === 'srv') { const h = H[data.name]; return h ? h(data.data || {}) : { ok: true }; }
  if (name === 'camera:shoot') return { ok: true, url: '' };
  if (name === 'camera:flip') return { selfie: true };
  if (name === 'call:start') {
    setTimeout(() => bus.emit('call:active', { id: 77, number: data.number, name: contacts.find((c) => c.number === data.number)?.name, video: data.video, channel: 1077 }), 2500);
    return { ok: true, id: 77, name: contacts.find((c) => c.number === data.number)?.name };
  }
  if (name === 'call:answer') return { ok: true, id: 78, video: false, name: 'Lena Moreau' };
  if (name === 'call:hangup' || name === 'call:decline') { setTimeout(() => bus.emit('call:ended', { id: data.id, reason: 'hangup' }), 50); return 'ok'; }
  if (name === 'contacts:shareNearby') return { ok: false, error: 'Personne a proximite' };
  if (name === 'garage:locate') return { ok: true };
  return { ok: true };
}

export function start() {
  bus.emit('boot', H.boot());
  setTimeout(() => {
    bus.emit('open', { time: { game: false }, zone: 'Legion Square' });
    const app = new URLSearchParams(location.search).get('app');
    if (app) bus.emit('open', { app });
  }, 50);
  window.__ophone = { bus };
}
