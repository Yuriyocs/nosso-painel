/* Utilitários compartilhados: HTML seguro, datas, dinheiro, modais, ações. */
(function (global) {
  'use strict';

  /* ---------- HTML seguro (tudo é escapado, a menos que seja "raw") ---------- */
  function raw(s) { const v = String(s); return { __raw: v, toString() { return v; } }; }
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function toHtml(v) {
    if (v === false || v == null) return '';
    if (Array.isArray(v)) return v.map(toHtml).join('');
    if (typeof v === 'object' && '__raw' in v) return v.__raw;
    return esc(v);
  }
  function html(strings, ...vals) {
    let out = '';
    strings.forEach((s, i) => { out += s; if (i < vals.length) out += toHtml(vals[i]); });
    return raw(out);
  }

  /* ---------- ícones ---------- */
  const P = {
    home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
    wallet: '<path d="M3 7a2 2 0 0 1 2-2h13v4"/><path d="M3 7v11a2 2 0 0 0 2 2h15V9H5a2 2 0 0 1-2-2z"/><circle cx="16.5" cy="14.5" r="1"/>',
    tasks: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M8 12.5l3 3 5-6"/>',
    note: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5"/><path d="M9 13h7M9 17h5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    chevL: '<path d="M15 5l-7 7 7 7"/>',
    chevR: '<path d="M9 5l7 7-7 7"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>',
    logout: '<path d="M9 4H5v16h4"/><path d="M16 8l4 4-4 4M20 12H9"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    repeat: '<path d="M17 3l3 3-3 3"/><path d="M4 11V9a3 3 0 0 1 3-3h13"/><path d="M7 21l-3-3 3-3"/><path d="M20 13v2a3 3 0 0 1-3 3H4"/>',
    pin: '<path d="M9 4h6l-1 6 3 3H7l3-3z"/><path d="M12 13v7"/>',
    search: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4-4"/>',
    vault: '<rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="12" cy="12" r="3"/><path d="M12 9V8M12 16v-1"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    download: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
    upload: '<path d="M12 16V5M7 9l5-5 5 5M5 20h14"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
    down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
    flag: '<path d="M6 21V4h11l-2 4 2 4H6"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    cart: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M3 4h2.5l2.2 11h10.6l2-8H6.2"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    more: '<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>',
    bell: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 21h4"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1.9-1.1 1.8"/><path d="M12 17h.01"/>',
    keyboard: '<rect x="2.5" y="6" width="19" height="12" rx="3"/><path d="M6.5 10h.01M10 10h.01M14 10h.01M17.5 10h.01M7.5 14h9"/>',
    card: '<rect x="2.5" y="5" width="19" height="14" rx="3"/><path d="M2.5 10h19M6.5 15h4"/>',
    gauge: '<path d="M4 17a8 8 0 1 1 16 0"/><path d="M12 17l4-5"/>',
    pencil: '<path d="M4 20l1-4L16 5l3 3L8 19z"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  };
  function icon(name, size = 20) {
    return raw(`<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`);
  }

  /* ---------- constantes do casal ---------- */
  const NOMES = (global.CONFIG && global.CONFIG.NOMES) || ['Yuri', 'Lohrane'];
  const K = {
    NOMES,
    PESSOAS: [...NOMES, 'Casal'],
    RESPONSAVEIS: [...NOMES, 'Ambos'],
    BANCOS_BASE: ['Nubank', 'Itaú', 'Bradesco', 'Santander'],
    BANCOS: ['Nubank', 'Itaú', 'Bradesco', 'Santander', 'Dinheiro', 'Outro'],
    BANCO_COR: { 'Nubank': '#8A05BE', 'Itaú': '#EC7000', 'Bradesco': '#CC092F', 'Santander': '#E0525B', 'Dinheiro': '#5F7A6E', 'Outro': '#7B8794' },
    BANDEIRAS: ['Visa', 'Mastercard', 'Elo', 'American Express', 'Hipercard', 'Outra'],
    CAT_SAIDA: ['Moradia', 'Mercado', 'Alimentação', 'Contas (luz, água, internet)', 'Transporte', 'Saúde', 'Educação', 'Lazer', 'Assinaturas', 'Compras', 'Cartão de crédito', 'Viagem', 'Pets', 'Presentes', 'Outros'],
    CAT_ENTRADA: ['Salário', 'Renda extra', 'Reembolso', 'Rendimentos', 'Presente', 'Outros'],
    FORMAS: ['Pix', 'Débito', 'Crédito', 'Dinheiro', 'Boleto', 'Transferência'],
    LISTAS_COMPRA: ['Mercado', 'Farmácia', 'Casa', 'Outros'],
    SECOES_COMPRA: ['Hortifruti', 'Padaria', 'Açougue e peixaria', 'Frios e laticínios', 'Mercearia', 'Bebidas', 'Congelados', 'Limpeza', 'Higiene', 'Pet', 'Outros'],
    CAT_META: ['Viagem', 'Casa', 'Carro', 'Finanças', 'Saúde', 'Estudos', 'Família', 'Lazer', 'Outros'],
  };
  function pessoaSlot(n) { const i = NOMES.indexOf(n); return i === 0 ? 'a' : i === 1 ? 'b' : 'c'; }
  function pessoaTag(n) {
    if (!n) return '';
    return html`<span class="pessoa p-${pessoaSlot(n)}"><i></i>${n}</span>`;
  }
  function bancoTag(b) {
    const nome = b || 'Outro';
    const cor = K.BANCO_COR[nome] || '#7B8794';
    return html`<span class="banco"><i style="background:${cor}"></i>${nome}</span>`;
  }

  /* ---------- datas ---------- */
  const pad = n => String(n).padStart(2, '0');
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const MESES_C = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseYMD = s => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
  const today = () => ymd(new Date());
  const monthKey = s => String(s).slice(0, 7);
  function addMonthsKey(mk, n) { const [y, m] = mk.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; }
  function monthDiff(a, b) { const [ya, ma] = a.split('-').map(Number); const [yb, mb] = b.split('-').map(Number); return (yb - ya) * 12 + (mb - ma); }
  function daysInMonth(mk) { const [y, m] = mk.split('-').map(Number); return new Date(y, m, 0).getDate(); }
  function dateInMonth(mk, day) { return `${mk}-${pad(Math.min(Math.max(1, day), daysInMonth(mk)))}`; }
  function addDays(s, n) { const d = parseYMD(s); d.setDate(d.getDate() + n); return ymd(d); }
  function addMonthsDate(s, n) { return dateInMonth(addMonthsKey(monthKey(s), n), +s.slice(8, 10)); }
  function diffDays(a, b) { return Math.round((parseYMD(a) - parseYMD(b)) / 86400000); }
  function monthLabel(mk) { const [y, m] = mk.split('-').map(Number); return `${MESES[m - 1]} de ${y}`; }
  function monthShort(mk) { const [y, m] = mk.split('-').map(Number); return `${MESES_C[m - 1]}/${y}`; }
  function dateLabel(s) {
    const d = diffDays(s, today());
    if (d === 0) return 'hoje';
    if (d === 1) return 'amanhã';
    if (d === -1) return 'ontem';
    const dt = parseYMD(s);
    if (d > 1 && d < 7) return DIAS[dt.getDay()];
    const base = `${pad(dt.getDate())}/${pad(dt.getMonth() + 1)}`;
    return dt.getFullYear() === new Date().getFullYear() ? base : `${base}/${dt.getFullYear()}`;
  }
  function longDate(d = new Date()) { return `${DIAS[d.getDay()]}-feira, ${d.getDate()} de ${MESES[d.getMonth()]}`.replace('sábado-feira', 'sábado').replace('domingo-feira', 'domingo'); }
  function agoLabel(iso) {
    if (!iso) return '';
    const t = Date.parse(iso); if (isNaN(t)) return '';
    const min = Math.round((Date.now() - t) / 60000);
    if (min < 1) return 'agora';
    if (min < 60) return `há ${min} min`;
    const h = Math.round(min / 60);
    if (h < 24) return `há ${h} h`;
    const d = Math.round(h / 24);
    if (d === 1) return 'ontem';
    if (d < 7) return `há ${d} dias`;
    return dateLabel(ymd(new Date(t)));
  }

  /* ---------- dinheiro ---------- */
  const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const fmt = v => brl.format(Number(v) || 0);
  function parseMoney(str) {
    let s = String(str == null ? '' : str).replace(/R\$|\s/g, '');
    if (!s) return 0;
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    const n = parseFloat(s);
    return isNaN(n) ? 0 : Math.round(n * 100) / 100;
  }
  const moneyInput = v => (v === '' || v == null ? '' : String(v).replace('.', ','));

  /* ---------- diversos ---------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
  function uid() {
    if (global.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); });
  }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignora */ } }
  function render(el, h) { el.innerHTML = String(h); }

  function toast(msg, type, acao) {
    const host = $('#toasts'); if (!host) return;
    const el = document.createElement('div');
    el.className = 'toast' + (type ? ' ' + type : '') + (acao ? ' has-act' : '');
    const t = document.createElement('span'); t.textContent = msg; el.appendChild(t);
    if (acao) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'toast-act'; b.textContent = acao.label;
      b.addEventListener('click', () => { el.remove(); acao.fn(); });
      el.appendChild(b);
    }
    host.appendChild(el);
    const ms = acao ? 7000 : 2800;
    setTimeout(() => el.classList.add('out'), ms);
    setTimeout(() => el.remove(), ms + 500);
  }

  /* ---------- modais ---------- */
  const stack = [];
  function openModal({ title, body, small, wide, focus, onMount, onClose }) {
    const wrap = document.createElement('div');
    wrap.className = 'modal-wrap';
    wrap.innerHTML = String(html`
      <div class="modal-backdrop" data-modal-close></div>
      <div class="modal${small ? ' small' : ''}${wide ? ' wide' : ''}" role="dialog" aria-modal="true" aria-label="${title}">
        <header class="modal-head"><h2>${title}</h2><button type="button" class="icon-btn" data-modal-close aria-label="Fechar">${icon('close')}</button></header>
        <div class="modal-body">${body}</div>
      </div>`);
    const prev = document.activeElement;
    const api = {
      el: wrap.querySelector('.modal'),
      body: wrap.querySelector('.modal-body'),
      close() {
        const i = stack.indexOf(api); if (i < 0) return;
        stack.splice(i, 1); wrap.remove();
        if (!stack.length) document.body.classList.remove('no-scroll');
        if (onClose) onClose();
        if (prev && prev.focus && document.contains(prev)) prev.focus();
      },
    };
    wrap.addEventListener('click', e => { if (e.target.closest('[data-modal-close]')) api.close(); });
    document.body.appendChild(wrap);
    document.body.classList.add('no-scroll');
    stack.push(api);
    if (onMount) onMount(api);
    if (focus) { const f = api.el.querySelector('input:not([type=hidden]):not([disabled]),select,textarea'); if (f) f.focus(); }
    return api;
  }
  function closeAllModals() { while (stack.length) stack[stack.length - 1].close(); }
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && stack.length) stack[stack.length - 1].close(); });

  function confirmDialog({ title, message, confirmLabel = 'Confirmar', danger = false }) {
    return new Promise(resolve => {
      let done = false;
      const m = openModal({
        title, small: true,
        body: html`<p class="confirm-msg">${message}</p>
          <div class="modal-actions">
            <button type="button" class="btn ghost" data-r="0">Cancelar</button>
            <button type="button" class="btn ${danger ? 'danger' : 'primary'}" data-r="1">${confirmLabel}</button>
          </div>`,
        onMount(api) {
          api.el.addEventListener('click', e => {
            const b = e.target.closest('[data-r]'); if (!b) return;
            done = true; resolve(b.dataset.r === '1'); m.close();
          });
        },
        onClose() { if (!done) resolve(false); },
      });
    });
  }

  /* ---------- ações por data-act / data-form / data-input ---------- */
  const route = { nome: '' }; // tela atual (o app atualiza)
  const Actions = {}, Forms = {}, Inputs = {};
  const on = (name, fn) => { Actions[name] = fn; };
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-act]'); if (!t) return;
    const fn = Actions[t.dataset.act];
    if (fn) { e.preventDefault(); fn(t, e); }
  });
  document.addEventListener('submit', e => {
    const f = e.target.closest('[data-form]'); if (!f) return;
    e.preventDefault();
    const fn = Forms[f.dataset.form]; if (fn) fn(f, e);
  });
  ['input', 'change'].forEach(type => document.addEventListener(type, e => {
    const t = e.target.closest('[data-input]'); if (!t) return;
    const wants = t.dataset.on || (t.tagName === 'SELECT' ? 'change' : 'input');
    if (wants !== type) return;
    const fn = Inputs[t.dataset.input]; if (fn) fn(t, e);
  }));

  /* campos de número: só deixam digitar o que faz sentido (data-num = int | money | qtd) */
  function limpaNum(modo, v) {
    if (modo === 'int') return v.replace(/\D/g, '');
    let n = v.replace(modo === 'qtd' ? /[^\d.,]/g : /[^\d.,]/g, '');
    if (modo === 'qtd') n = n.replace(/\./g, ',');
    const i = n.indexOf(',');
    if (i >= 0) {
      const dec = n.slice(i + 1).replace(/[.,]/g, '').slice(0, modo === 'qtd' ? 2 : 2);
      n = n.slice(0, i).replace(/\./g, modo === 'qtd' ? '' : '.') + ',' + dec;
    }
    return n;
  }
  document.addEventListener('input', e => {
    const t = e.target, modo = t && t.dataset && t.dataset.num; if (!modo) return;
    const v = t.value, n = limpaNum(modo, v); if (n === v) return;
    const pos = Math.max(0, (t.selectionStart == null ? n.length : t.selectionStart) - (v.length - n.length));
    t.value = n; try { t.setSelectionRange(pos, pos); } catch (err) { /* campos sem seleção */ }
  }, true);
  document.addEventListener('keydown', e => {
    const t = e.target, modo = t && t.dataset && t.dataset.num; if (!modo || e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return;
    if (!(modo === 'int' ? /\d/ : /[\d.,]/).test(e.key)) e.preventDefault();
  }, true);

  global.UI = {
    raw, esc, html, toHtml, icon, K, pessoaSlot, pessoaTag, bancoTag,
    pad, ymd, parseYMD, today, monthKey, addMonthsKey, monthDiff, daysInMonth, dateInMonth, addDays, addMonthsDate, diffDays,
    monthLabel, monthShort, dateLabel, longDate, agoLabel, MESES, DIAS,
    fmt, parseMoney, moneyInput, limpaNum, $, $$, norm, debounce, uid, lsGet, lsSet, render,
    toast, openModal, closeAllModals, confirmDialog, on, Actions, Forms, Inputs, route,
  };
})(window);
