// Fonds d'ecran vectoriels (aucune image a charger)
function rng(seed) { return () => ((seed = (seed * 16807) % 2147483647) / 2147483647); }

function peaks(colors, seed = 7) {
  const r = rng(seed);
  const W = 400, H = 860;
  let polys = '';
  // ciel
  polys += `<rect width="${W}" height="${H}" fill="${colors[0]}"/>`;
  const layers = [
    { base: 470, amp: 170, col: colors[1], n: 7 },
    { base: 560, amp: 140, col: colors[2], n: 9 },
    { base: 660, amp: 110, col: colors[3], n: 11 },
  ];
  layers.forEach((L) => {
    const pts = [];
    for (let i = 0; i <= L.n; i++) pts.push([(W / L.n) * i, L.base - r() * L.amp]);
    for (let i = 0; i < L.n; i++) {
      const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
      const mx = (x1 + x2) / 2 + (r() - 0.5) * 30, my = Math.max(y1, y2) + 40 + r() * 60;
      const shade = (k) => `rgba(255,255,255,${k})`;
      polys += `<polygon points="${x1},${y1} ${x2},${y2} ${mx},${my}" fill="${L.col}"/>`;
      polys += `<polygon points="${x1},${y1} ${x2},${y2} ${mx},${my}" fill="${shade(0.02 + r() * 0.05)}"/>`;
      polys += `<polygon points="${x1},${y1} ${mx},${my} ${x1},${H}" fill="${L.col}"/>`;
      polys += `<polygon points="${x1},${y1} ${mx},${my} ${x1},${H}" fill="${shade(r() * 0.04)}"/>`;
      polys += `<polygon points="${x2},${y2} ${mx},${my} ${x2},${H}" fill="${L.col}"/>`;
      polys += `<polygon points="${mx},${my} ${x1},${H} ${x2},${H}" fill="${L.col}"/>`;
    }
  });
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">${polys}</svg>`;
}

function velvet() {
  return `<svg viewBox="0 0 400 860" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="vg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4A1D2A"/><stop offset=".55" stop-color="#762F43"/><stop offset="1" stop-color="#171619"/></linearGradient>
    <linearGradient id="vf" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity=".35"/><stop offset=".5" stop-color="#fff" stop-opacity=".07"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></linearGradient>
  </defs>
  <rect width="400" height="860" fill="url(#vg)"/>
  ${[0, 1, 2, 3, 4, 5, 6].map((i) => `<path d="M${i * 70 - 40} 0 C ${i * 70 + 30} 300, ${i * 70 - 60} 560, ${i * 70 + 20} 860 L ${i * 70 + 80} 860 C ${i * 70} 560, ${i * 70 + 90} 300, ${i * 70 + 30} 0 Z" fill="url(#vf)"/>`).join('')}
  </svg>`;
}

function topo() {
  let lines = '';
  for (let i = 0; i < 22; i++) {
    const y = 80 + i * 38;
    lines += `<path d="M-20 ${y} C 80 ${y - 40 + (i % 3) * 20}, 160 ${y + 50}, 240 ${y - 10} S 380 ${y + 30}, 420 ${y - 20}" stroke="#E9E0D5" stroke-opacity="${0.05 + (i % 4) * 0.02}" fill="none" stroke-width="1.2"/>`;
  }
  return `<svg viewBox="0 0 400 860" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg"><rect width="400" height="860" fill="#29242A"/>${lines}<circle cx="300" cy="190" r="70" fill="#762F43" fill-opacity=".55"/></svg>`;
}

function bone() {
  return `<svg viewBox="0 0 400 860" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
  <rect width="400" height="860" fill="#29242A"/>
  <path d="M0 520 C 120 450, 260 600, 400 500 L400 860 L0 860 Z" fill="#3F3641"/>
  <path d="M0 640 C 140 580, 250 700, 400 620 L400 860 L0 860 Z" fill="#171619"/>
  <circle cx="110" cy="260" r="88" fill="#E9E0D5" fill-opacity=".92"/>
  <circle cx="110" cy="260" r="88" fill="#762F43" fill-opacity=".18"/>
  </svg>`;
}

function ember() {
  return `<svg viewBox="0 0 400 860" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
  <defs><radialGradient id="eg" cx=".5" cy=".85" r=".8"><stop offset="0" stop-color="#9A4560"/><stop offset=".35" stop-color="#4A1D2A"/><stop offset="1" stop-color="#171619"/></radialGradient></defs>
  <rect width="400" height="860" fill="url(#eg)"/>
  ${Array.from({ length: 40 }, (_, i) => { const r = rng(i + 3); return `<circle cx="${r() * 400}" cy="${300 + r() * 560}" r="${0.6 + r() * 1.8}" fill="#E9E0D5" fill-opacity="${0.15 + r() * 0.4}"/>`; }).join('')}
  </svg>`;
}

export const WALLPAPERS = {
  peaks:   { label: 'Sommets',  svg: () => peaks(['#29242A', '#3A3340', '#4A424D', '#5B525C'], 11) },
  dusk:    { label: 'Crepuscule', svg: () => peaks(['#171619', '#4A1D2A', '#5E2738', '#762F43'], 23) },
  velvet:  { label: 'Velours',  svg: velvet },
  topo:    { label: 'Relief',   svg: topo },
  moon:    { label: 'Lune',     svg: bone },
  ember:   { label: 'Braise',   svg: ember },
};

const cache = {};
export function wallpaperHTML(id, custom) {
  if (id === 'custom' && custom) return `<div style="position:absolute;inset:0;background:url('${custom.replace(/'/g, '')}') center/cover"></div>`;
  const w = WALLPAPERS[id] || WALLPAPERS.peaks;
  return (cache[id] ||= w.svg());
}
