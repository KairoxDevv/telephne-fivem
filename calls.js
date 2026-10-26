// Appels : sortant / entrant / en cours / video
import { bus } from './bus.js';
import { post } from './bridge.js';
import { store, contactName, addBadge } from './store.js';
import { html, esc, avatar, duration, fmtNumber, $ } from './util.js';
import { icon } from './icons.js';
import { screenEl, OS, peek, unpeek } from './os.js';
import { toast } from './ui.js';
import { startRing, stopRing, startDial, stopDial } from './sounds.js';

const C = { state: null, el: null, timer: null, minimized: false, videoOn: true, peerVideo: true };
export const CallState = C;
const island = () => document.getElementById('island');

function view() {
  if (!C.state) return;
  const s = C.state;
  const active = s.status === 'active';
  const video = s.video && active;
  const label = s.status === 'incoming' ? (s.video ? 'Appel video entrant' : s.emergency ? `Appel ${s.emergency}` : 'Appel entrant')
    : s.status === 'outgoing' ? 'Appel en cours...' : duration((Date.now() - s.startedAt) / 1000);
  if (!C.el) { C.el = html(`<div class="layer callview"></div>`); screenEl.appendChild(C.el); }
  C.el.className = `layer callview ${active ? 'active' : ''} ${video ? 'video' : ''}`;
  C.el.style.display = C.minimized ? 'none' : '';
  C.el.innerHTML = `
    ${video ? `<div class="video-remote" id="vremote"></div>${C.peerVideo ? '<div class="video-wait" id="vwait">Connexion video...</div>' : '<div class="video-wait">Camera coupee</div>'}` : ''}
    ${video ? '' : `<div class="rings">${avatar(s.name, null, 'lg')}</div>`}
    <div class="c-name">${esc(s.name || fmtNumber(s.number))}</div>
    <div class="c-state ${s.emergency ? 'emergency' : ''}" id="c-state">${esc(label)}</div>
    <div class="c-actions">
      ${s.status === 'incoming' ? `
        <button class="c-btn end" data-c="decline"><span>${icon('phoneOff')}</span>Refuser</button>
        <button class="c-btn go" data-c="answer"><span>${icon(s.video ? 'video' : 'phone')}</span>Repondre</button>` : `
        ${active ? `<button class="c-btn" data-c="min"><span>${icon('home')}</span>Reduire</button>` : ''}
        ${active && s.video ? `<button class="c-btn ${C.videoOn ? '' : 'on'}" data-c="video"><span>${icon(C.videoOn ? 'video' : 'videoOff')}</span>Camera</button>` : ''}
        <button class="c-btn end" data-c="hangup"><span>${icon('phoneOff')}</span>Raccrocher</button>`}
    </div>`;
}

function tick() {
  clearInterval(C.timer);
  C.timer = setInterval(() => {
    if (!C.state || C.state.status !== 'active') return;
    const t = duration((Date.now() - C.state.startedAt) / 1000);
    const st = document.getElementById('c-state'); if (st) st.textContent = t;
    document.getElementById('island-timer').textContent = t;
  }, 1000);
}

function setIsland() {
  const on = C.state && C.state.status === 'active';
  island().classList.toggle('call', !!on);
  island().onclick = on ? () => { C.minimized = false; view(); } : null;
}

function teardown(reason) {
  stopRing(); stopDial();
  clearInterval(C.timer);
  if (C.el) { C.el.remove(); C.el = null; }
  const prev = C.state;
  C.state = null; C.minimized = false; C.videoOn = true; C.peerVideo = true;
  setIsland();
  document.getElementById('island-timer').textContent = '';
  if (!OS.open) unpeek();
  if (prev && reason) {
    const msg = { declined: 'Appel refuse', timeout: 'Pas de reponse', hangup: 'Appel termine', taken: 'Pris par un collegue' }[reason];
    if (msg) toast(msg);
  }
}

export async function startCall(number, video = false) {
  if (C.state) return toast('Deja en appel', true);
  if (store.settings.airplane) return toast('Desactive le mode avion', true);
  number = String(number || '').replace(/\D/g, '');
  if (!number) return;
  const name = store.config.emergency?.[number] || contactName(number) || fmtNumber(number);
  C.state = { status: 'outgoing', number, name, video, emergency: store.config.emergency?.[number] };
  view();
  startDial();
  const res = await post('call:start', { number, video });
  if (!res || !res.ok) { teardown(); toast(res?.error || 'Appel impossible', true); return; }
  if (C.state) { C.state.id = res.id; C.state.name = res.name || name; C.state.video = res.video; view(); }
}

bus.on('ui:call', ({ number, video }) => startCall(number, video));

bus.on('call:incoming', (d) => {
  if (C.state) return;
  C.state = { status: 'incoming', id: d.id, number: d.number, name: d.name || contactName(d.number) || fmtNumber(d.number), video: d.video, emergency: d.emergency };
  view();
  startRing();
  if (!OS.open) {
    peek(0);
    const n = document.getElementById('island-note');
    n.innerHTML = `<span class="n-ico" style="background:#3f7a4c;color:var(--bone)">${icon('phone')}</span><span class="n-txt"><div class="n-title">${esc(C.state.name)}</div><div class="n-body">Ouvre le telephone pour repondre</div></span>`;
    island().classList.add('expanded');
  }
});

bus.on('call:active', (d) => {
  stopDial();
  if (!C.state) C.state = { number: d.number, name: d.name };
  Object.assign(C.state, { status: 'active', id: d.id, video: d.video, startedAt: Date.now(), name: d.name || C.state.name });
  view(); tick(); setIsland();
});

bus.on('call:ended', ({ id, reason }) => {
  if (C.state && (C.state.id === id || !C.state.id)) teardown(reason);
  else if (!C.state) teardown();
  if (reason === 'timeout' || reason === 'hangup') {/* rien */}
});

bus.on('phone:open', () => {
  island().classList.remove('expanded');
  if (C.state && !C.minimized) view();
});

// --------------------------------------------- video : compression + affichage
const canvas = document.createElement('canvas');
const ctx2d = canvas.getContext('2d');
bus.on('video:compress', ({ data, w, h, q }) => {
  const img = new Image();
  img.onload = () => {
    canvas.width = w; canvas.height = h;
    // recadrage centre (portrait)
    const ratio = w / h;
    let sw = img.height * ratio, sh = img.height;
    if (sw > img.width) { sw = img.width; sh = img.width / ratio; }
    ctx2d.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, 0, 0, w, h);
    post('video:frame', { frame: canvas.toDataURL('image/jpeg', q || 0.55) });
  };
  img.src = data;
});
bus.on('video:frame', (frame) => {
  const el = document.getElementById('vremote');
  if (el) el.style.backgroundImage = `url(${frame})`;
  const w = document.getElementById('vwait'); if (w) w.remove();
});
bus.on('video:peer', ({ enabled }) => { C.peerVideo = enabled; view(); });

// --------------------------------------------- actions
screenEl.addEventListener('click', async (e) => {
  const b = e.target.closest('.callview [data-c]');
  if (!b || !C.state) return;
  const a = b.dataset.c;
  if (a === 'answer') {
    stopRing();
    const res = await post('call:answer', { id: C.state.id });
    if (!res || !res.ok) { teardown(); toast(res?.error || 'Appel termine', true); return; }
    Object.assign(C.state, { status: 'active', startedAt: Date.now(), video: res.video, name: res.name || C.state.name });
    view(); tick(); setIsland();
  }
  if (a === 'decline') { const id = C.state.id; teardown(); post('call:decline', { id }); }
  if (a === 'hangup') { const id = C.state.id; teardown('hangup'); post('call:hangup', { id }); }
  if (a === 'min') { C.minimized = true; view(); }
  if (a === 'video') { C.videoOn = !C.videoOn; post('video:toggle', { enabled: C.videoOn }); view(); }
});
