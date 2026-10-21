/* Atalhos de teclado (para quem usa no computador). Não atrapalham quando se está digitando. */
(function (global) {
  'use strict';
  const U = global.UI;
  const { html, openModal, on } = U;

  const TELAS = ['inicio', 'financas', 'calendario', 'tarefas', 'compras', 'metas', 'notas', 'notificacoes'];
  const LISTA = [
    ['Ir para uma tela', [['1 a 8', 'Início, Finanças, Calendário, Tarefas, Compras, Metas, Notas, Notificações']]],
    ['Nesta tela', [
      ['N', 'Novo item (lançamento, tarefa, item de compra, nota ou meta)'],
      ['/', 'Buscar'],
      ['← →', 'Mês anterior / próximo (Finanças e Calendário)'],
      ['H', 'Voltar para o mês de hoje'],
      ['[ ]', 'Trocar de seção dentro de Finanças'],
    ]],
    ['Geral', [[',', 'Ajustes'], ['?', 'Mostrar esta lista'], ['Esc', 'Fechar a janela aberta']]],
  ];

  function ajuda() {
    openModal({
      title: 'Atalhos do teclado', small: true,
      body: html`${LISTA.map(([t, l]) => html`<h3 class="kb-title">${t}</h3><dl class="kb">${l.map(([k, d]) => html`<div><dt><kbd>${k}</kbd></dt><dd>${d}</dd></div>`)}</dl>`)}`,
    });
  }
  on('app:atalhos', () => ajuda());

  const clica = sel => { const el = document.querySelector(sel); if (el) { el.click(); return true; } return false; };
  const foca = sel => { const el = document.querySelector(sel); if (el) { el.focus(); if (el.select) el.select(); return true; } return false; };

  document.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
    if (!document.querySelector('.shell')) return;
    const t = e.target, tag = t && t.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return;
    if (document.querySelector('.modal-wrap')) return;
    const k = e.key, tela = U.route.nome;
    let feito = true;

    if (k >= '1' && k <= '8') location.hash = '#/' + TELAS[+k - 1];
    else if (k === '?') ajuda();
    else if (k === ',') U.Actions['app:ajustes'] && U.Actions['app:ajustes']();
    else if (k === 'n' || k === 'N') {
      feito = ({
        financas: () => clica('[data-act="fin:novo"], [data-act="fin:novo-fixo"], [data-act="fin:novo-parcelado"], [data-act="fin:cofre-novo"], [data-act="fin:banco-novo"], [data-act="fin:orc-novo"]'),
        tarefas: () => foca('#qa-input'),
        compras: () => foca('#cp-nome'),
        notas: () => clica('[data-act="not:nova"]'),
        metas: () => clica('[data-act="met:nova"]'),
      }[tela] || (() => false))();
    }
    else if (k === '/') feito = foca('#fin-busca, input[type=search]');
    else if (k === 'ArrowLeft') feito = clica('[data-act="fin:prev"], [data-act="cal:prev"]');
    else if (k === 'ArrowRight') feito = clica('[data-act="fin:next"], [data-act="cal:next"]');
    else if (k === 'h' || k === 'H') feito = clica('[data-act="fin:hoje"], [data-act="cal:hoje"]');
    else if (k === '[' || k === ']') {
      const abas = [...document.querySelectorAll('.subtabs a')];
      const i = abas.findIndex(a => a.getAttribute('aria-current') === 'page' || a.classList.contains('on'));
      feito = i >= 0 && !!abas[i + (k === ']' ? 1 : -1)];
      if (feito) location.hash = abas[i + (k === ']' ? 1 : -1)].getAttribute('href');
    }
    else feito = false;
    if (feito) e.preventDefault();
  });

  global.Atalhos = { ajuda };
})(window);
