import { bus } from './bus.js';

export const IS_GAME = typeof window.GetParentResourceName === 'function';
const RES = IS_GAME ? window.GetParentResourceName() : 'obsidian_phone';
let mock = null;
async function getMock() {
  if (!mock) mock = await import('../mock.js');
  return mock;
}

// Appel NUI -> client Lua
export async function post(name, data = {}) {
  if (!IS_GAME) return (await getMock()).post(name, data);
  try {
    const r = await fetch(`https://${RES}/${name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify(data),
    });
    const txt = await r.text();
    try { return JSON.parse(txt); } catch { return txt; }
  } catch (e) {
    return { ok: false, error: 'NUI indisponible' };
  }
}

// Appel NUI -> serveur (callback QBCore 'ophone:<name>')
export const srv = (name, data = {}) => post('srv', { name, data });

window.addEventListener('message', (e) => {
  const msg = e.data;
  if (msg && typeof msg.action === 'string') bus.emit(msg.action, msg.data);
});

if (!IS_GAME) getMock().then((m) => m.start && m.start());
