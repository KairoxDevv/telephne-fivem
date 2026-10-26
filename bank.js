import { T } from './_tiles.js';
import { icon } from '../core/icons.js';
import { esc, money, timeAgo, copyText } from '../core/util.js';
import { store } from '../core/store.js';
import { toast, result, form, confirmBox } from '../core/ui.js';

const TABS = ['home', 'transfer', 'bills', 'profile'];
const TAB_ICON = { home: 'home', transfer: 'transfer', bills: 'doc', profile: 'user' };

function flowChart(tx) {
  // barres : entrees/sorties sur les 7 derniers jours
  const days = [...Array(7)].map((_, i) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (6 - i)); return { t: d.getTime() / 1000, in: 0, out: 0 }; });
  tx.forEach((x) => { const d = days.findLast((dd) => x.ts >= dd.t); if (d) d[x.type === 'in' ? 'in' : 'out'] += x.amount; });
  const max = Math.max(1, ...days.map((d) => Math.max(d.in, d.out)));
  return `<div class="flow">${days.map((d) => `<div class="flow-col"><i class="in" style="height:${(d.in / max) * 100}%"></i><i class="out" style="height:${(d.out / max) * 100}%"></i><span>${new Date(d.t * 1000).toLocaleDateString('fr-FR', { weekday: 'narrow' })}</span></div>`).join('')}</div>`;
}

export default {
  id: 'bank', name: 'Banque', icon: 'bank', bg: T.burg[0], fg: T.burg[1],
  mount(ctx, payload) {
    ctx.push((el) => {
      let tab = payload?.tab || 'home', data = null, q = '';
      const load = async () => {
        data = await ctx.srv('bank:data');
        if (!data || !data.ok) { el.innerHTML = '<div class="empty" style="margin-top:120px">Banque indisponible</div>'; return; }
        render();
      };
      const txRow = (t) => `<div class="row"><span class="tx-ico ${t.type}">${icon(t.type === 'in' ? 'arrowDown' : 'arrowUp')}</span>
        <div class="r-main"><div class="r-title">${esc(t.label)}</div><div class="r-sub">${timeAgo(t.ts)}</div></div>
        <div class="r-end"><b class="${t.type === 'in' ? 'up' : ''}">${t.type === 'in' ? '+' : '-'}${money(t.amount)}</b></div></div>`;
      const views = {
        home: () => {
          const list = data.transactions.filter((t) => !q || t.label.toLowerCase().includes(q));
          return `${flowChart(data.transactions)}
          <div class="quick">
            <button data-tab="transfer"><span>${icon('send')}</span>Virer</button>
            <button data-tab="bills"><span>${icon('doc')}</span>Factures${data.invoices.length ? `<em>${data.invoices.length}</em>` : ''}</button>
            <button data-a="copy"><span>${icon('copy')}</span>Mon RIB</button>
          </div>
          <div class="section-title">Activite recente</div>
          <div class="list">${list.slice(0, 30).map(txRow).join('') || `<div class="empty">${icon('list')}Aucune operation</div>`}</div>`;
        },
        transfer: () => `<div class="section-title">Nouveau virement</div>
          <div class="field"><label>Destinataire (numero de tel. ou ID compte)</label><input class="input" id="t-to" maxlength="30" placeholder="5551234567 ou LS-ABC12345" value="${esc(payload?.to || '')}"></div>
          <div class="field"><label>Montant</label><input class="input amount" id="t-amt" type="number" min="1" placeholder="0"></div>
          <div class="field"><label>Motif (optionnel)</label><input class="input" id="t-note" maxlength="60" placeholder="Loyer, dette, cadeau..."></div>
          <div class="chips-row">${[100, 500, 1000, 5000].map((v) => `<button class="chip" data-amt="${v}">${money(v)}</button>`).join('')}</div>
          <button class="btn primary block" style="margin-top:14px" data-a="send">${icon('send')}Envoyer</button>
          <div class="section-title">Contacts</div>
          <div class="list">${store.contacts.slice(0, 8).map((c) => `<button class="row" data-to="${esc(c.number)}"><div class="r-main"><div class="r-title">${esc(c.name)}</div><div class="r-sub">${esc(c.number)}</div></div>${icon('send', 'style="width:16px;opacity:.6"')}</button>`).join('')}</div>`,
        bills: () => data.invoices.length ? `<div class="section-title">A payer</div><div class="list">${data.invoices.map((i) => `
          <div class="row bill"><span class="tx-ico out">${icon('doc')}</span><div class="r-main"><div class="r-title">${esc(i.label)}</div><div class="r-sub">${esc(i.sender_name || i.society || '')} · ${timeAgo(i.ts)}</div></div>
          <div class="r-end"><b>${money(i.amount)}</b><button class="btn primary" style="height:30px;font-size:13px;margin-top:4px;padding:0 12px" data-pay="${i.id}">Payer</button></div></div>`).join('')}</div>`
          : `<div class="empty">${icon('check')}Aucune facture en attente</div>`,
        profile: () => `<div class="section-title">Profil</div><div class="list">
          <div class="row"><div class="r-main"><div class="r-sub">Titulaire</div><div class="r-title">${esc(data.name)}</div></div></div>
          <div class="row"><div class="r-main"><div class="r-sub">ID compte</div><div class="r-title">${esc(data.iban)}</div></div><button class="icon-btn" data-a="copy">${icon('copy')}</button></div>
          <div class="row"><div class="r-main"><div class="r-sub">Especes sur toi</div><div class="r-title">${money(data.cash)}</div></div></div>
          <div class="row"><div class="r-main"><div class="r-sub">Employeur</div><div class="r-title">${esc(data.job || '-')}</div></div></div></div>`,
      };
      const render = () => {
        el.innerHTML = `<div class="bank-head">
            <div class="bank-brand"><span>OBSIDIAN</span><b>BANK</b></div>
            ${tab === 'home' ? `<div class="search light">${icon('search')}<input id="bq" placeholder="Rechercher" value="${esc(q)}"></div>` : '<div style="flex:1"></div>'}
          </div>
          <div class="bank-card">
            <span class="chip">COURANT</span>
            <div class="bc-label">Solde actuel</div>
            <div class="bc-balance">${money(data.balance)}</div>
            <div class="bc-id">ID compte : ${esc(data.iban)}</div>
          </div>
          <div class="body" id="bbody">${views[tab]()}</div>
          <div class="tabbar"><span class="keycap" data-k="q">Q</span><div class="tabs">${TABS.map((t) => `<button class="tab ${t === tab ? 'on' : ''}" data-tab="${t}">${icon(TAB_ICON[t])}</button>`).join('')}</div><span class="keycap" data-k="e">E</span></div>`;
        const bq = el.querySelector('#bq');
        if (bq) bq.addEventListener('input', () => { q = bq.value.toLowerCase(); el.querySelector('#bbody').innerHTML = views.home(); });
      };
      const change = (d) => { tab = TABS[(TABS.indexOf(tab) + d + TABS.length) % TABS.length]; render(); };
      ctx.tabs({ change });
      el.addEventListener('click', async (e) => {
        const t = e.target.closest('[data-tab]'); if (t) { tab = t.dataset.tab; render(); return; }
        const k = e.target.closest('[data-k]'); if (k) return change(k.dataset.k === 'q' ? -1 : 1);
        const amt = e.target.closest('[data-amt]'); if (amt) { el.querySelector('#t-amt').value = amt.dataset.amt; return; }
        const to = e.target.closest('[data-to]'); if (to) { el.querySelector('#t-to').value = to.dataset.to; el.querySelector('#t-amt').focus(); return; }
        const pay = e.target.closest('[data-pay]');
        if (pay) {
          const inv = data.invoices.find((i) => String(i.id) === pay.dataset.pay);
          if (inv && await confirmBox(`Payer ${money(inv.amount)} ?`, inv.label, { ok: 'Payer' })) {
            if (result(await ctx.srv('bank:payInvoice', { id: inv.id }), 'Facture payee')) load();
          }
          return;
        }
        const a = e.target.closest('[data-a]')?.dataset.a;
        if (a === 'copy') { copyText(data.iban); toast('ID compte copie'); }
        if (a === 'send') {
          const target = el.querySelector('#t-to').value.trim();
          const amount = Math.floor(+el.querySelector('#t-amt').value);
          const note = el.querySelector('#t-note').value.trim();
          if (!target || !amount || amount <= 0) return toast('Destinataire et montant requis', true);
          if (!await confirmBox(`Virer ${money(amount)} ?`, `Vers ${target}`, { ok: 'Envoyer' })) return;
          if (result(await ctx.srv('bank:transfer', { target, amount, note }), 'Virement envoye')) { tab = 'home'; load(); }
        }
      });
      ctx.on('notifications', () => { if (store.notifications[0]?.app === 'bank') load(); });
      load();
    }, { bg: 'var(--ob)' });
  },
};
