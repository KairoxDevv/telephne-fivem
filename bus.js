// Mini bus d'evenements
const handlers = new Map();
export const bus = {
  on(evt, fn) {
    if (!handlers.has(evt)) handlers.set(evt, new Set());
    handlers.get(evt).add(fn);
    return () => handlers.get(evt)?.delete(fn);
  },
  emit(evt, data) {
    handlers.get(evt)?.forEach((fn) => { try { fn(data); } catch (e) { console.error('[ophone]', evt, e); } });
  },
};
