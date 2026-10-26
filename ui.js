import { html, esc } from './util.js';
import { icon } from './icons.js';
import { post } from './bridge.js';

let host = null;
export const setHost = (el) => { host = el; };

export function toast(msg, err = false) {
  if (!host) return;
  host.querySelectorAll('.toast').forEach((t) => t.remove());
  const t = html(`<div class="toast ${err ? 'err' : ''}">${esc(msg)}</div>`);
  host.appendChild(t);
  setTimeout(() => t.remove(), 2400);
}

// Retour standard d'une action serveur
export function result(res, okMsg) {
  if (res && res.ok !== false) { if (okMsg) toast(okMsg); return true; }
  toast((res && res.error) || 'Action impossible', true);
  return false;
}

let openSheets = [];
export function sheet(content, { onClose } = {}) {
  const back = html(`<div class="sheet-back"><div class="sheet"><div class="grabber"></div></div></div>`);
  const box = back.firstElementChild;
  if (typeof content === 'string') box.insertAdjacentHTML('beforeend', content);
  else box.appendChild(content);
  const api = {
    el: box,
    close() {
      back.remove();
      openSheets = openSheets.filter((s) => s !== api);
      onClose && onClose();
    },
  };
  back.addEventListener('mousedown', (e) => { if (e.target === back) api.close(); });
  host.appendChild(back);
  openSheets.push(api);
  setTimeout(() => box.querySelector('input,textarea')?.focus(), 380);
  return api;
}
export function closeTopSheet() {
  const s = openSheets[openSheets.length - 1];
  if (s) { s.close(); return true; }
  return false;
}

export function confirmBox(title, text, { ok = 'Confirmer', danger = false } = {}) {
  return new Promise((resolve) => {
    const s = sheet(`<h3>${esc(title)}</h3>${text ? `<p style="color:var(--bone-2);font-size:15px;margin:-6px 0 16px;line-height:1.4">${esc(text)}</p>` : ''}
      <div class="sheet-actions"><button class="btn" data-a="no">Annuler</button><button class="btn ${danger ? 'danger' : 'primary'}" data-a="yes">${esc(ok)}</button></div>`,
      { onClose: () => resolve(false) });
    s.el.addEventListener('click', (e) => {
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (!a) return;
      resolve(a === 'yes');
      s.close();
    });
  });
}

// Formulaire rapide : fields = [{ name, label, type, value, placeholder }]
export function form(title, fields, { submit = 'Enregistrer' } = {}) {
  return new Promise((resolve) => {
    let done = false;
    const s = sheet(`<h3>${esc(title)}</h3>
      ${fields.map((f) => `<div class="field"><label>${esc(f.label)}</label>${f.type === 'textarea'
        ? `<textarea class="input" name="${f.name}" maxlength="${f.max || 500}" placeholder="${esc(f.placeholder || '')}">${esc(f.value || '')}</textarea>`
        : `<input class="input" name="${f.name}" type="${f.type || 'text'}" maxlength="${f.max || 120}" value="${esc(f.value ?? '')}" placeholder="${esc(f.placeholder || '')}" />`}</div>`).join('')}
      <div class="sheet-actions"><button class="btn" data-a="no">Annuler</button><button class="btn primary" data-a="yes">${esc(submit)}</button></div>`,
      { onClose: () => { if (!done) resolve(null); } });
    const finish = () => {
      const out = {};
      fields.forEach((f) => { out[f.name] = s.el.querySelector(`[name="${f.name}"]`).value.trim(); });
      done = true; resolve(out); s.close();
    };
    s.el.addEventListener('click', (e) => {
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (a === 'yes') finish();
      if (a === 'no') s.close();
    });
    s.el.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') finish(); });
  });
}

export function topbar(title, { back = true, sub = '', actions = '', big = false } = {}) {
  return `<div class="top">
    ${back ? `<button class="icon-btn" data-nav="back">${icon('back')}</button>` : ''}
    <div class="grow">${big ? `<h1>${esc(title)}</h1>` : `<h2>${esc(title)}</h2>`}${sub ? `<div class="sub">${esc(sub)}</div>` : ''}</div>
    ${actions}
  </div>`;
}

// Saisie : on previent Lua pour bloquer les deplacements du perso
document.addEventListener('focusin', (e) => { if (e.target.matches('input,textarea')) post('typing', { state: true }); });
document.addEventListener('focusout', (e) => { if (e.target.matches('input,textarea')) post('typing', { state: false }); });
