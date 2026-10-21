/* Notas livres, com salvamento automático. */
(function (global) {
  'use strict';
  const U = global.UI, DB = global.DB;
  const { html, icon, agoLabel, norm, debounce, openModal, confirmDialog, toast, on, Inputs, $ } = U;

  const S = { sel: null, q: '' };
  const CUR = { root: null };
  const CORES = [['', 'Sem cor'], ['sand', 'Areia'], ['sage', 'Verde'], ['sky', 'Azul'], ['rose', 'Rosa'], ['lilac', 'Lilás']];

  function lista() {
    const q = norm(S.q);
    return DB.all('notas')
      .filter(n => !q || norm(n.titulo + ' ' + n.corpo).includes(q))
      .sort((a, b) => (b.fixada ? 1 : 0) - (a.fixada ? 1 : 0) || (Date.parse(b.atualizado_em) || 0) - (Date.parse(a.atualizado_em) || 0));
  }

  function itemHtml(n) {
    const linhas = (n.corpo || '').split('\n').map(s => s.trim()).filter(Boolean);
    return html`<li><a class="note-item${S.sel === n.id ? ' on' : ''}" href="#/notas/${n.id}" data-cor="${n.cor || ''}">
      <span class="note-item-title">${n.fixada ? html`<span class="pin" title="Fixada">${icon('pin', 14)}</span>` : ''}${n.titulo || 'Sem título'}</span>
      <span class="note-item-prev">${linhas[0] || 'Nota vazia'}</span>
      <span class="note-item-when">${agoLabel(n.atualizado_em)}</span>
    </a></li>`;
  }
  function listaHtml() {
    const l = lista();
    if (!l.length) return html`<li class="empty small"><p>${S.q ? 'Nenhuma nota encontrada.' : 'Nenhuma nota ainda.'}</p></li>`;
    return l.map(itemHtml);
  }

  function cardsHtml(l) {
    return l.length ? html`<ul class="note-cards" id="notes-cards">${l.map(x => html`<li><a class="note-card" href="#/notas/${x.id}" data-cor="${x.cor || ''}">
          <span class="note-item-title">${x.fixada ? html`<span class="pin">${icon('pin', 14)}</span>` : ''}${x.titulo || 'Sem título'}</span>
          <span class="note-card-body">${(x.corpo || '').trim() || 'Nota vazia'}</span>
          <span class="note-item-when">${agoLabel(x.atualizado_em)}</span></a></li>`)}</ul>` : html`<ul class="note-cards" id="notes-cards"></ul>`;
  }

  function editorHtml(n) {
    if (!n) {
      const l = lista();
      return html`<div class="editor-empty"><h3>Escolha uma nota</h3><p>Ou crie uma nova. Tudo é salvo sozinho enquanto você escreve.</p>
        ${cardsHtml(l)}</div>`;
    }
    return html`<div class="editor" data-cor="${n.cor || ''}">
      <div class="editor-bar">
        <a class="icon-btn back-only" href="#/notas" aria-label="Voltar para as notas">${icon('chevL')}</a>
        <div class="swatches" role="group" aria-label="Cor da nota">
          ${CORES.map(([v, nome]) => html`<button type="button" class="swatch${(n.cor || '') === v ? ' on' : ''}" data-act="not:cor" data-v="${v}" data-cor="${v}" aria-label="${nome}" aria-pressed="${(n.cor || '') === v ? 'true' : 'false'}"></button>`)}
        </div>
        <button type="button" class="icon-btn${n.fixada ? ' on' : ''}" data-act="not:pin" aria-pressed="${n.fixada ? 'true' : 'false'}" aria-label="${n.fixada ? 'Desafixar' : 'Fixar no topo'}">${icon('pin')}</button>
        <button type="button" class="icon-btn" data-act="not:del" aria-label="Excluir nota">${icon('trash')}</button>
      </div>
      <input class="note-title" id="n-titulo" data-input="not:edit" value="${n.titulo}" maxlength="120" placeholder="Título" aria-label="Título da nota">
      <textarea class="note-body" id="n-corpo" data-input="not:edit" placeholder="Escreva aqui" aria-label="Texto da nota">${n.corpo}</textarea>
      <p class="note-status" id="n-status">${n.editado_por ? `Editada por ${n.editado_por} ${agoLabel(n.atualizado_em)}` : ''}</p>
    </div>`;
  }

  function render(root, sub) {
    CUR.root = root;
    S.sel = sub && DB.find('notas', sub) ? sub : null;
    const n = S.sel ? DB.find('notas', S.sel) : null;
    root.innerHTML = String(html`<section class="page notes${S.sel ? ' editing' : ''}">
      <header class="page-head"><h1>Notas</h1>
        <button type="button" class="btn primary" data-act="not:nova">${icon('plus', 18)}Nova nota</button></header>
      <div class="notes-layout">
        <div class="notes-list">
          <label class="search">${icon('search', 18)}<span class="sr-only">Buscar nas notas</span>
            <input type="search" data-input="not:busca" value="${S.q}" placeholder="Buscar nas notas" autocomplete="off"></label>
          <ul id="notes-ul" class="note-items">${listaHtml()}</ul>
        </div>
        <div class="notes-editor" id="notes-editor">${editorHtml(n)}</div>
      </div>
    </section>`);
    autosize();
  }

  /* chamado quando chegam dados novos: não pisa em quem está digitando */
  function onData() {
    if (!CUR.root) return;
    const ul = $('#notes-ul', CUR.root), a = document.activeElement;
    const digitando = a && (a.id === 'n-titulo' || a.id === 'n-corpo');
    if (!digitando) { render(CUR.root, S.sel); return; }
    if (ul) ul.innerHTML = String(listaHtml());
    if (S.sel && !DB.find('notas', S.sel)) location.hash = '#/notas';
  }

  function autosize() {
    const t = $('#n-corpo', CUR.root || document); if (!t) return;
    t.style.height = 'auto'; t.style.height = Math.max(t.scrollHeight + 2, 240) + 'px';
  }

  const salvar = debounce(() => {
    const n = S.sel && DB.find('notas', S.sel); if (!n) return;
    const titulo = $('#n-titulo'), corpo = $('#n-corpo'); if (!titulo || !corpo) return;
    DB.update('notas', n.id, { titulo: titulo.value, corpo: corpo.value, atualizado_em: new Date().toISOString(), editado_por: DB.user.nome });
    const st = $('#n-status'); if (st) st.textContent = 'Salvo agora';
    const ul = $('#notes-ul'); if (ul) ul.innerHTML = String(listaHtml());
  }, 600);

  Inputs['not:edit'] = () => { const st = $('#n-status'); if (st) st.textContent = 'Salvando...'; autosize(); salvar(); };
  Inputs['not:busca'] = el => {
    S.q = el.value; const ul = $('#notes-ul'); if (ul) ul.innerHTML = String(listaHtml());
    const c = $('#notes-cards'); if (c) c.outerHTML = String(cardsHtml(lista()) || '');
  };

  on('not:nova', async () => {
    const row = await DB.insert('notas', { titulo: '', corpo: '', cor: '', fixada: false, atualizado_em: new Date().toISOString(), editado_por: DB.user.nome, criado_por: DB.user.nome });
    S.q = '';
    location.hash = '#/notas/' + row.id;
    setTimeout(() => { const t = $('#n-titulo'); if (t) t.focus(); }, 60);
  });
  on('not:cor', el => { if (!S.sel) return; DB.update('notas', S.sel, { cor: el.dataset.v, atualizado_em: new Date().toISOString(), editado_por: DB.user.nome }); render(CUR.root, S.sel); });
  on('not:pin', () => { const n = S.sel && DB.find('notas', S.sel); if (!n) return; DB.update('notas', n.id, { fixada: !n.fixada }); render(CUR.root, S.sel); });
  on('not:del', async () => {
    const n = S.sel && DB.find('notas', S.sel); if (!n) return;
    const ok = await confirmDialog({ title: 'Excluir nota?', message: `"${n.titulo || 'Sem título'}" será apagada para vocês dois.`, confirmLabel: 'Excluir', danger: true });
    if (!ok) return;
    DB.apagar('notas', n.id, 'Nota excluída'); location.hash = '#/notas';
  });

  global.Notas = { render, onData, recentes: (k = 3) => lista().slice(0, k) };
})(window);
