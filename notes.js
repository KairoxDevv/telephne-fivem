import { T } from './_tiles.js';
import { icon } from '../core/icons.js';
import { esc, timeAgo, debounce } from '../core/util.js';
import { topbar, confirmBox, toast } from '../core/ui.js';

const COLORS = ['#29242A', '#762F43', '#4A3F4C', '#5E4A3A', '#3D4A44'];

export default {
  id: 'notes', name: 'Notes', icon: 'notes', bg: T.boneBurg[0], fg: T.boneBurg[1],
  mount(ctx) {
    const editor = (note, reload) => ctx.push((el) => {
      const n = { title: '', content: '', color: COLORS[0], ...note };
      let saved = true;
      const save = async () => {
        const res = await ctx.srv('notes:save', n);
        if (res?.ok) { n.id = res.id; saved = true; el.querySelector('#n-state').textContent = 'Enregistre'; }
      };
      const autosave = debounce(save, 700);
      el.innerHTML = `${topbar('', { actions: `<span class="sub" id="n-state" style="font-size:13px;color:var(--bone-3)">${n.id ? 'Enregistre' : 'Nouvelle note'}</span>${n.id ? `<button class="icon-btn" data-a="del">${icon('trash')}</button>` : ''}` })}
        <div class="body note-ed" style="--nc:${n.color}">
          <input class="note-title" id="n-title" maxlength="80" placeholder="Titre" value="${esc(n.title)}">
          <div class="note-colors">${COLORS.map((c) => `<button data-c="${c}" style="background:${c}" class="${c === n.color ? 'on' : ''}"></button>`).join('')}</div>
          <textarea class="note-body" id="n-body" maxlength="5000" placeholder="Ecris quelque chose...">${esc(n.content)}</textarea>
        </div>`;
      el.addEventListener('input', () => {
        n.title = el.querySelector('#n-title').value; n.content = el.querySelector('#n-body').value;
        saved = false; el.querySelector('#n-state').textContent = '...'; autosave();
      });
      el.addEventListener('click', async (e) => {
        const c = e.target.closest('[data-c]');
        if (c) { n.color = c.dataset.c; el.querySelector('.note-ed').style.setProperty('--nc', n.color); el.querySelectorAll('[data-c]').forEach((x) => x.classList.toggle('on', x === c)); autosave(); }
        if (e.target.closest('[data-a="del"]') && await confirmBox('Supprimer la note ?', '', { danger: true, ok: 'Supprimer' })) {
          await ctx.srv('notes:delete', { id: n.id }); saved = true; ctx.back();
        }
      });
      setTimeout(() => el.querySelector(n.id ? '#n-body' : '#n-title')?.focus(), 350);
      return () => { if (!saved && (n.title || n.content)) save(); setTimeout(reload, 200); };
    });

    ctx.push((el, _c, entry) => {
      let notes = [], q = '';
      const load = async () => { const r = await ctx.srv('notes:list'); notes = Array.isArray(r) ? r : []; render(); };
      const render = () => {
        const list = notes.filter((n) => !q || (n.title + n.content).toLowerCase().includes(q));
        el.innerHTML = `${topbar('Notes', { back: false, big: true, actions: `<button class="icon-btn accent" data-a="new">${icon('plus')}</button>` })}
        <div class="body">
          <div class="search">${icon('search')}<input id="nq" placeholder="Rechercher" value="${esc(q)}"></div>
          <div class="notes-grid">${list.map((n) => `<button class="note-card" data-id="${n.id}" style="--nc:${n.color || COLORS[0]}"><b>${esc(n.title)}</b><p>${esc((n.content || '').slice(0, 120))}</p><small>${timeAgo(n.ts)}</small></button>`).join('')}</div>
          ${!list.length ? `<div class="empty">${icon('notes')}${q ? 'Aucun resultat' : 'Aucune note'}</div>` : ''}
        </div>`;
        const i = el.querySelector('#nq');
        i.addEventListener('input', () => { q = i.value.toLowerCase(); render(); const x = el.querySelector('#nq'); x.focus(); x.setSelectionRange(q.length, q.length); });
      };
      el.addEventListener('click', (e) => {
        if (e.target.closest('[data-a="new"]')) return editor({}, load);
        const id = e.target.closest('[data-id]')?.dataset.id;
        if (id) editor(notes.find((n) => String(n.id) === id), load);
      });
      load();
    });
  },
};
