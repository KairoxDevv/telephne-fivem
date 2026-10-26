export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function html(str) {
  const t = document.createElement('template');
  t.innerHTML = str.trim();
  return t.content.firstElementChild;
}

let CURRENCY = '$';
export const setCurrency = (c) => { CURRENCY = c || '$'; };
export function money(n, decimals = 0) {
  const v = Number(n) || 0;
  return CURRENCY + v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
export function num(n, d = 2) {
  return (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: d });
}

export function timeAgo(ts) {
  if (!ts) return '';
  const s = Math.max(0, Date.now() / 1000 - ts);
  if (s < 60) return "a l'instant";
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  if (s < 86400) return `${Math.floor(s / 3600)} h`;
  if (s < 604800) return `${Math.floor(s / 86400)} j`;
  return new Date(ts * 1000).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}
export function hhmm(ts) {
  return new Date(ts * 1000).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}
export function duration(sec) {
  sec = Math.max(0, Math.floor(sec));
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function initials(name) {
  const p = String(name || '?').trim().split(/\s+/);
  return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase() || '#';
}

const AV = ['#762F43', '#5B3A55', '#3F3641', '#8A4A3E', '#4E5A4F', '#6B4E3A', '#3D4A63', '#94405A'];
export function colorFor(str) {
  let h = 0;
  for (const c of String(str)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AV[h % AV.length];
}

export function avatar(name, url, cls = '') {
  if (url) return `<div class="avatar ${cls}" style="background-image:url('${esc(url)}')"></div>`;
  return `<div class="avatar ${cls}" style="background:${colorFor(name)}">${esc(initials(name))}</div>`;
}

export function fmtNumber(n) {
  const s = String(n || '');
  if (s.length === 10) return `${s.slice(0, 3)}-${s.slice(3, 6)}-${s.slice(6)}`;
  if (s.length === 7) return `${s.slice(0, 3)}-${s.slice(3)}`;
  return s;
}

export function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

export function on(root, evt, sel, fn) {
  root.addEventListener(evt, (e) => {
    const t = e.target.closest(sel);
    if (t && root.contains(t)) fn(e, t);
  });
}

export function copyText(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); } catch {}
  ta.remove();
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
