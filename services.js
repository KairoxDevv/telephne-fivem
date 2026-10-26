import { T } from './_tiles.js';
import { icon } from '../core/icons.js';
import { esc } from '../core/util.js';
import { topbar, result, sheet, toast } from '../core/ui.js';
import { store } from '../core/store.js';
import { startCall } from '../core/calls.js';

export default {
  id: 'services', name: 'Services', icon: 'services', bg: T.rose[0], fg: T.rose[1],
  mount(ctx) {
    ctx.push((el) => {
      let list = [];
      const render = () => {
        el.innerHTML = `${topbar('Services', { back: false, big: true })}
        <div class="body">
          <button class="row sos" data-sos="911"><span class="sos-ico">${icon('phone')}</span><div class="r-main"><div class="r-title">Appel d'urgence · 911</div><div class="r-sub">Police et EMS en service</div></div></button>
          <div class="section-title">Entreprises</div>
          <div class="list">${list.map((s) => `<div class="row"><span class="svc-ico" style="background:${esc(s.color)}">${icon(s.icon)}</span>
            <div class="r-main"><div class="r-title">${esc(s.label)}</div><div class="r-sub"><i class="dot ${s.online ? 'on' : ''}"></i>${s.online ? `${s.online} en service` : 'Personne en service'}</div></div>
            <button class="icon-btn accent" data-msg="${esc(s.job)}" ${s.online ? '' : 'disabled style="opacity:.4"'}>${icon('message')}</button></div>`).join('')}</div>
        </div>`;
      };
      el.addEventListener('click', (e) => {
        const sos = e.target.closest('[data-sos]'); if (sos) return startCall(sos.dataset.sos);
        const m = e.target.closest('[data-msg]');
        if (!m) return;
        const svc = list.find((s) => s.job === m.dataset.msg);
        const s = sheet(`<h3>Contacter ${esc(svc.label)}</h3>
          <div class="field"><label>Message (ta position est envoyee)</label><textarea class="input" id="sv-msg" maxlength="300" placeholder="Decris ta demande..."></textarea></div>
          <label class="row click" style="margin-bottom:12px"><div class="r-main"><div class="r-title">Rester anonyme</div></div><input type="checkbox" id="sv-anon" style="accent-color:#762F43;width:20px;height:20px"></label>
          <div class="sheet-actions"><button class="btn primary" data-t="send">${icon('send')}Envoyer</button></div>`);
        s.el.addEventListener('click', async (ev) => {
          if (!ev.target.closest('[data-t="send"]')) return;
          const res = await ctx.srv('services:message', { job: svc.job, message: s.el.querySelector('#sv-msg').value, anonymous: s.el.querySelector('#sv-anon').checked });
          if (result(res, `Envoye a ${res?.sent || 0} personne(s)`)) s.close();
        });
      });
      el.innerHTML = '<div class="empty" style="margin-top:140px">Chargement...</div>';
      ctx.srv('services:list').then((r) => { list = Array.isArray(r) ? r : []; render(); });
    });
  },
};
