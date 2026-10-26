// Sonneries generees en WebAudio : aucun fichier audio a fournir
import { store } from './store.js';

let ctx = null;
const ac = () => (ctx ||= new (window.AudioContext || window.webkitAudioContext)());

function tone(freq, start, dur, { type = 'sine', gain = 0.25, glide = 0 } = {}) {
  const a = ac();
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, a.currentTime + start);
  if (glide) o.frequency.exponentialRampToValueAtTime(freq * glide, a.currentTime + start + dur);
  const vol = gain * (store.settings.volume ?? 0.6);
  g.gain.setValueAtTime(0.0001, a.currentTime + start);
  g.gain.exponentialRampToValueAtTime(Math.max(vol, 0.0002), a.currentTime + start + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + start + dur);
  o.connect(g).connect(a.destination);
  o.start(a.currentTime + start);
  o.stop(a.currentTime + start + dur + 0.05);
}

export const RINGTONES = {
  ember:   { label: 'Ember',   len: 2.4, play() { [523, 659, 784, 659].forEach((f, i) => tone(f, i * 0.18, 0.5, { type: 'triangle' })); [523, 659, 784, 1046].forEach((f, i) => tone(f, 1 + i * 0.16, 0.6, { type: 'triangle' })); } },
  velvet:  { label: 'Velvet',  len: 2.6, play() { [392, 494, 587].forEach((f, i) => tone(f, i * 0.32, 0.9, { type: 'sine', gain: 0.3 })); [440, 554, 659].forEach((f, i) => tone(f, 1.2 + i * 0.32, 0.9, { type: 'sine', gain: 0.3 })); } },
  classic: { label: 'Classique', len: 2.0, play() { for (let i = 0; i < 10; i++) tone(i % 2 ? 1400 : 1150, i * 0.05, 0.05, { type: 'square', gain: 0.06 }); for (let i = 0; i < 10; i++) tone(i % 2 ? 1400 : 1150, 0.7 + i * 0.05, 0.05, { type: 'square', gain: 0.06 }); } },
  obsidian:{ label: 'Obsidian', len: 2.2, play() { tone(196, 0, 1.2, { type: 'sawtooth', gain: 0.07 }); [784, 988, 1175].forEach((f, i) => tone(f, i * 0.12, 0.35, { type: 'sine' })); [784, 988, 1318].forEach((f, i) => tone(f, 0.9 + i * 0.12, 0.45, { type: 'sine' })); } },
  pulse:   { label: 'Pulse',   len: 1.6, play() { [880, 880, 1320].forEach((f, i) => tone(f, i * 0.14, 0.12, { type: 'square', gain: 0.08 })); [880, 880, 1320].forEach((f, i) => tone(f, 0.7 + i * 0.14, 0.12, { type: 'square', gain: 0.08 })); } },
};

export const NOTIF_SOUNDS = {
  drop:  { label: 'Goutte', play() { tone(1200, 0, 0.18, { glide: 0.5, gain: 0.3 }); } },
  chime: { label: 'Carillon', play() { tone(988, 0, 0.3, { type: 'triangle' }); tone(1318, 0.1, 0.4, { type: 'triangle' }); } },
  tap:   { label: 'Tap', play() { tone(660, 0, 0.08, { type: 'square', gain: 0.08 }); tone(990, 0.07, 0.1, { type: 'square', gain: 0.08 }); } },
};

let ringTimer = null;
export function startRing(id) {
  stopRing();
  if (store.settings.silent || store.settings.dnd) return;
  const r = RINGTONES[id || store.settings.ringtone] || RINGTONES.ember;
  const loop = () => { try { r.play(); } catch {} ringTimer = setTimeout(loop, r.len * 1000 + 600); };
  loop();
}
export function stopRing() { if (ringTimer) clearTimeout(ringTimer); ringTimer = null; }

export function previewRing(id) { stopRing(); try { (RINGTONES[id] || RINGTONES.ember).play(); } catch {} }

export function notifSound() {
  if (store.settings.silent || store.settings.dnd) return;
  try { (NOTIF_SOUNDS[store.settings.notifSound] || NOTIF_SOUNDS.drop).play(); } catch {}
}

export function click() { try { tone(1800, 0, 0.03, { type: 'square', gain: 0.03 }); } catch {} }

// Dialtone en appel sortant
let dialTimer = null;
export function startDial() {
  stopDial();
  const loop = () => { try { tone(440, 0, 1.4, { gain: 0.08 }); tone(480, 0, 1.4, { gain: 0.08 }); } catch {} dialTimer = setTimeout(loop, 4000); };
  loop();
}
export function stopDial() { if (dialTimer) clearTimeout(dialTimer); dialTimer = null; }
