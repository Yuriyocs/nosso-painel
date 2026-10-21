/* Lista de compras compartilhada. */
(function (global) {
  'use strict';
  const U = global.UI, DB = global.DB;
  const { html, icon, K, norm, openModal, confirmDialog, toast, on, Forms, lsGet, lsSet } = U;

  const S = { lista: lsGet('np:compras:lista') || K.LISTAS_COMPRA[0], sub: null };
  const CUR = { root: null };
  const refresh = () => { if (CUR.root && U.route.nome === 'compras') render(CUR.root); };

  const listas = () => [...new Set([...K.LISTAS_COMPRA, ...DB.all('listas_compra').filter(l => !l.pai).map(l => l.nome)])];
  const subsDe = l => [...new Set(DB.all('listas_compra').filter(x => x.pai === l).map(x => x.nome))];
  const noSub = (c, sub) => sub == null || (sub === '' ? !c.sublista : c.sublista === sub);
  const alvoSub = () => (S.sub ? S.sub : null);
  const ehPropria = l => !K.LISTAS_COMPRA.includes(l);
  const daLista = l => DB.all('compras').filter(c => (c.lista || 'Mercado') === l);
  const ordemSecao = s => { const i = K.SECOES_COMPRA.indexOf(s || 'Outros'); return i < 0 ? 99 : i; };
  const porNome = (a, b) => a.nome.localeCompare(b.nome, 'pt-BR');

  /* quando o item já foi comprado antes, reaproveita seção e quantidade */
  function lembrar(nome) {
    const n = norm(nome);
    const antes = DB.all('compras').filter(c => norm(c.nome) === n).sort((a, b) => String(b.criado_em || '').localeCompare(String(a.criado_em || '')));
    return antes[0] || null;
  }

  function rotuloLixeira() {
    if (S.sub) return 'Excluir a sublista ' + S.sub;
    return ehPropria(S.lista) ? 'Excluir a lista ' + S.lista : 'Esvaziar a lista ' + S.lista;
  }
  function itemHtml(c) {
    return html`<li class="row${c.comprado ? ' done' : ''}">
      <button type="button" class="check${c.comprado ? ' on' : ''}" data-act="com:toggle" data-id="${c.id}" aria-pressed="${c.comprado ? 'true' : 'false'}" aria-label="${c.comprado ? 'Voltar para a lista' : 'Marcar como comprado'}">${icon('check', 14)}</button>
      <button type="button" class="row-body" data-act="com:edit" data-id="${c.id}">
        <span class="row-title">${c.nome}${c.qtd ? html` <span class="badge qtd">${c.qtd}</span>` : ''}${S.sub == null && c.sublista ? html` <span class="badge">${c.sublista}</span>` : ''}</span>
        ${c.adicionado_por ? html`<span class="row-meta">${U.pessoaTag(c.adicionado_por)}</span>` : ''}
      </button>
    </li>`;
  }

  function render(root) {
    CUR.root = root;
    if (!listas().includes(S.lista)) S.lista = K.LISTAS_COMPRA[0];
    const subs = subsDe(S.lista);
    if (S.sub && !subs.includes(S.sub)) S.sub = null;
    if (S.sub === '' && !subs.length) S.sub = null;
    const daListaInteira = daLista(S.lista), todas = daListaInteira.filter(c => noSub(c, S.sub));
    const titulo = S.lista + (S.sub ? ' › ' + S.sub : S.sub === '' ? ' › Geral' : '');
    const pend = todas.filter(c => !c.comprado), carrinho = todas.filter(c => c.comprado).sort((a, b) => String(b.comprado_em || '').localeCompare(String(a.comprado_em || '')));
    const secoes = [...new Set(pend.map(c => c.secao || 'Outros'))].sort((a, b) => ordemSecao(a) - ordemSecao(b));
    const nomes = [...new Set(DB.all('compras').map(c => c.nome))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    const qa = root.querySelector('#cp-nome');
    const keep = qa ? { v: qa.value, q: root.querySelector('#cp-qtd').value, f: document.activeElement === qa } : null;

    root.innerHTML = String(html`<section class="page">
      <header class="page-head">
        <h1>Compras</h1>
        <p class="page-sub">${pend.length ? `${pend.length} ${pend.length === 1 ? 'item' : 'itens'} para comprar` : 'Lista vazia'}</p>
      </header>

      <div class="chips" role="group" aria-label="Listas de compras">
        ${listas().map(l => { const n = daLista(l).filter(c => !c.comprado).length; return html`<button type="button" class="chip${S.lista === l ? ' on' : ''}" data-act="com:lista" data-v="${l}" aria-pressed="${S.lista === l ? 'true' : 'false'}">${l}${n ? html` <span class="seg-n">${n}</span>` : ''}</button>`; })}
        <button type="button" class="chip dashed" data-act="com:nova-lista">${icon('plus', 14)}Nova lista</button>
      </div>

      <div class="list-bar">
        <h2 class="list-name">${titulo}</h2>
        <span class="muted">${todas.length ? `${todas.length} ${todas.length === 1 ? 'item' : 'itens'}${carrinho.length ? `, ${carrinho.length} no carrinho` : ''}` : 'vazia'}</span>
        <span class="list-tools">
          <button type="button" class="btn ghost small" data-act="com:nova-sub">${icon('plus', 16)}Sublista</button>
          ${pend.length ? html`<button type="button" class="btn ghost small" data-act="com:copiar">${icon('copy', 16)}Copiar</button>` : ''}
          <button type="button" class="icon-btn danger" data-act="com:apagar-lista" aria-label="${rotuloLixeira()}" title="${rotuloLixeira()}" ${!todas.length && !ehPropria(S.lista) && !S.sub ? 'disabled' : ''}>${icon('trash', 20)}</button>
        </span>
      </div>

      ${subs.length ? html`<div class="chips small subchips" role="group" aria-label="Sublistas de ${S.lista}">
        <span class="muted">Sublistas</span>
        ${[[null, 'Todas', daListaInteira.filter(c => !c.comprado).length], ['', 'Geral', daListaInteira.filter(c => !c.comprado && !c.sublista).length], ...subs.map(n => [n, n, daListaInteira.filter(c => !c.comprado && c.sublista === n).length])]
          .map(([v, nome, n]) => html`<button type="button" class="chip${S.sub === v ? ' on' : ''}" data-act="com:sub" data-v="${v == null ? '__todas' : v}" aria-pressed="${S.sub === v ? 'true' : 'false'}">${nome}${n ? html` <span class="seg-n">${n}</span>` : ''}</button>`)}
      </div>` : ''}

      <form class="quickadd comp" data-form="com:add" autocomplete="off">
        <input id="cp-nome" name="nome" maxlength="80" list="cp-sug" placeholder="${alvoSub() ? 'Novo item em ' + S.sub : 'Novo item'}" aria-label="Novo item">
        <input id="cp-qtd" name="qtd" maxlength="6" data-num="qtd" inputmode="decimal" placeholder="Qtd." aria-label="Quantidade (só números)" class="qtd-input">
        <button type="submit" class="btn primary">Adicionar</button>
        <datalist id="cp-sug">${nomes.map(n => html`<option value="${n}"></option>`)}</datalist>
      </form>

      ${pend.length === 0 && carrinho.length === 0 ? html`<div class="empty"><h3>Nada na lista de ${S.lista.toLowerCase()}</h3><p>Digite o item e aperte Enter. Se já comprou antes, o painel lembra a seção e a quantidade.</p></div>` : ''}

      <div class="board">
      ${secoes.map(sec => html`<section class="section"><div class="section-head"><h3>${sec}</h3><span class="count">${pend.filter(c => (c.secao || 'Outros') === sec).length}</span></div>
        <ul class="rows">${pend.filter(c => (c.secao || 'Outros') === sec).sort(porNome).map(itemHtml)}</ul></section>`)}

      ${pend.length === 0 && carrinho.length ? html`<div class="empty small"><h3>Tudo comprado</h3><p>Limpe o carrinho quando quiser começar outra lista.</p></div>` : ''}

      ${carrinho.length ? html`<section class="section">
        <div class="section-head"><h3>No carrinho</h3><span class="count">${carrinho.length}</span>
          <button type="button" class="btn ghost small" data-act="com:limpar">Limpar comprados</button></div>
        <ul class="rows">${carrinho.map(itemHtml)}</ul></section>` : ''}
      </div>

    </section>`);

    if (keep) {
      const n = root.querySelector('#cp-nome'); n.value = keep.v; root.querySelector('#cp-qtd').value = keep.q;
      if (keep.f) { n.focus(); n.setSelectionRange(keep.v.length, keep.v.length); }
    }
  }

  Forms['com:add'] = f => {
    const nome = f.nome.value.trim(), qtd = f.qtd.value.trim();
    if (!nome) { f.nome.focus(); return; }
    const antes = lembrar(nome), sublista = alvoSub();
    const ja = daLista(S.lista).find(c => !c.comprado && (c.sublista || null) === sublista && norm(c.nome) === norm(nome));
    if (ja) { toast('Esse item já está na lista.'); f.nome.value = ''; f.qtd.value = ''; f.nome.focus(); return; }
    DB.insert('compras', Object.assign(sublista ? { sublista } : {}, { lista: S.lista, nome, qtd: qtd || U.limpaNum('qtd', (antes && antes.qtd) || '') || null, secao: (antes && antes.secao) || 'Outros', comprado: false, comprado_em: null, adicionado_por: DB.user.nome, criado_em: new Date().toISOString() }));
    f.nome.value = ''; f.qtd.value = ''; f.nome.focus();
  };

  on('com:sub', el => { S.sub = el.dataset.v === '__todas' ? null : el.dataset.v; refresh(); });
  on('com:lista', el => { S.sub = null; S.lista = el.dataset.v; lsSet('np:compras:lista', S.lista); refresh(); });
  on('com:toggle', el => {
    const c = DB.find('compras', el.dataset.id); if (!c) return;
    DB.update('compras', c.id, { comprado: !c.comprado, comprado_em: !c.comprado ? new Date().toISOString() : null });
  });
  on('com:limpar', async () => {
    const comprados = daLista(S.lista).filter(c => c.comprado && noSub(c, S.sub));
    const ok = await confirmDialog({ title: 'Limpar o carrinho?', message: `${comprados.length} ${comprados.length === 1 ? 'item comprado será removido' : 'itens comprados serão removidos'} da lista de ${S.lista.toLowerCase()}.`, confirmLabel: 'Limpar' });
    if (!ok) return;
    DB.apagarVarios(comprados.map(c => ['compras', c.id]), 'Carrinho limpo', 'compras', `limpou o carrinho da lista de ${S.lista} (${comprados.length} ${comprados.length === 1 ? 'item' : 'itens'})`);
  });
  on('com:nova-lista', () => {
    openModal({
      title: 'Nova lista de compras', small: true, focus: true,
      body: html`<form class="form" novalidate>
        <div class="field"><label class="label" for="nl-nome">Nome da lista</label><input id="nl-nome" name="nome" maxlength="24" placeholder="Ex.: Churrasco, Feira, Festa" autocomplete="off"></div>
        <p class="hint">Cada lista tem seus próprios itens. Dá para ter uma para a casa de praia, outra para o aniversário...</p>
        <p class="form-error" role="alert" hidden></p>
        <div class="modal-actions"><button type="submit" class="btn primary">Criar lista</button></div></form>`,
      onMount(api) {
        api.el.querySelector('form').addEventListener('submit', async e => {
          e.preventDefault();
          const nome = e.target.nome.value.trim().replace(/\s+/g, ' '), err = e.target.querySelector('.form-error');
          if (!nome) { err.hidden = false; err.textContent = 'Digite o nome da lista.'; return; }
          if (listas().some(l => norm(l) === norm(nome))) { err.hidden = false; err.textContent = 'Já existe uma lista com esse nome.'; return; }
          await DB.insert('listas_compra', { nome });
          S.lista = nome; lsSet('np:compras:lista', nome); api.close(); refresh(); toast('Lista criada');
        });
      },
    });
  });
  on('com:apagar-lista', async () => {
    const l = S.lista, sub = S.sub;
    if (sub) {                                   // excluir uma sublista
      const itens = daLista(l).filter(c => c.sublista === sub), reg = DB.all('listas_compra').find(x => x.pai === l && x.nome === sub);
      const ok = await confirmDialog({ title: `Excluir a sublista ${sub}?`, danger: true, confirmLabel: 'Excluir sublista', message: `A sublista e ${itens.length === 1 ? 'o 1 item' : 'os ' + itens.length + ' itens'} dela serão apagados da lista ${l}.` });
      if (!ok) return;
      S.sub = null;
      DB.apagarVarios([...itens.map(c => ['compras', c.id]), ...(reg ? [['listas_compra', reg.id]] : [])], 'Sublista excluída', 'compras', `excluiu a sublista "${sub}" da lista "${l}" (${itens.length} ${itens.length === 1 ? 'item' : 'itens'})`);
      return;
    }
    const itens = daLista(l), propria = ehPropria(l);
    const ok = await confirmDialog({
      title: propria ? `Excluir a lista ${l}?` : `Esvaziar a lista ${l}?`, danger: true, confirmLabel: propria ? 'Excluir lista' : 'Esvaziar',
      message: propria ? `A lista e ${itens.length === 1 ? 'o 1 item' : 'os ' + itens.length + ' itens'} dela (com as sublistas) serão apagados para vocês dois.` : `${itens.length === 1 ? 'O 1 item' : 'Todos os ' + itens.length + ' itens'} serão apagados. A lista ${l} continua existindo, vazia.`,
    });
    if (!ok) return;
    const reg = DB.all('listas_compra').filter(x => x.nome === l && !x.pai);
    const subsReg = DB.all('listas_compra').filter(x => x.pai === l);
    const lote = itens.map(c => ['compras', c.id]);
    if (propria) { reg.forEach(r => lote.push(['listas_compra', r.id])); subsReg.forEach(r => lote.push(['listas_compra', r.id])); }
    if (propria) { S.lista = K.LISTAS_COMPRA[0]; S.sub = null; lsSet('np:compras:lista', S.lista); }
    DB.apagarVarios(lote, propria ? 'Lista excluída' : 'Lista esvaziada', 'compras', `${propria ? 'excluiu' : 'esvaziou'} a lista de compras "${l}" (${itens.length} ${itens.length === 1 ? 'item' : 'itens'})`);
  });
  on('com:nova-sub', () => {
    openModal({
      title: `Nova sublista em ${S.lista}`, small: true, focus: true,
      body: html`<form class="form" novalidate>
        <div class="field"><label class="label" for="ns-nome">Nome da sublista</label><input id="ns-nome" name="nome" maxlength="24" placeholder="Ex.: Compra do mês, Feira, Açougue" autocomplete="off"></div>
        <p class="hint">Use para separar o que comprar dentro de ${S.lista}: cada sublista tem seus itens, e os itens sem sublista ficam em "Geral".</p>
        <p class="form-error" role="alert" hidden></p>
        <div class="modal-actions"><button type="submit" class="btn primary">Criar sublista</button></div></form>`,
      onMount(api) {
        api.el.querySelector('form').addEventListener('submit', async e => {
          e.preventDefault();
          const nome = e.target.nome.value.trim().replace(/\s+/g, ' '), err = e.target.querySelector('.form-error');
          if (!nome) { err.hidden = false; err.textContent = 'Digite o nome da sublista.'; return; }
          if (['todas', 'geral'].includes(norm(nome)) || subsDe(S.lista).some(x => norm(x) === norm(nome))) { err.hidden = false; err.textContent = 'Já existe uma sublista com esse nome.'; return; }
          await DB.insert('listas_compra', { nome, pai: S.lista });
          S.sub = nome; api.close(); refresh(); toast('Sublista criada');
        });
      },
    });
  });
  on('com:copiar', async () => {
    const pend = daLista(S.lista).filter(c => !c.comprado && noSub(c, S.sub));
    const secoes = [...new Set(pend.map(c => c.secao || 'Outros'))].sort((a, b) => ordemSecao(a) - ordemSecao(b));
    const linhas = [`Lista de ${S.lista.toLowerCase()}${S.sub ? ' - ' + S.sub : ''}`];
    secoes.forEach(sec => { linhas.push('', sec); pend.filter(c => (c.secao || 'Outros') === sec).sort(porNome).forEach(c => linhas.push(`- ${c.nome}${c.qtd ? ' (' + c.qtd + ')' : ''}`)); });
    const texto = linhas.join('\n');
    try { await navigator.clipboard.writeText(texto); toast('Lista copiada. É só colar no WhatsApp.'); }
    catch (e) {
      const ta = document.createElement('textarea'); ta.value = texto; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); toast('Lista copiada. É só colar no WhatsApp.'); } catch (e2) { toast('Não consegui copiar.', 'erro'); }
      ta.remove();
    }
  });

  on('com:edit', el => {
    const c = DB.find('compras', el.dataset.id); if (!c) return;
    const st = { nome: c.nome, qtd: U.limpaNum('qtd', c.qtd || ''), secao: c.secao || 'Outros', lista: c.lista || 'Mercado', sublista: c.sublista || '' };
    let err = '';
    const form = () => html`<form class="form" novalidate>
      <div class="field"><label class="label" for="ci-nome">Item</label><input id="ci-nome" name="nome" value="${st.nome}" maxlength="80"></div>
      <div class="grid2">
        <div class="field"><label class="label" for="ci-qtd">Quantidade</label><input id="ci-qtd" name="qtd" value="${st.qtd}" maxlength="6" data-num="qtd" inputmode="decimal" placeholder="Só números"></div>
        <div class="field"><label class="label" for="ci-sec">Seção</label>
          <select id="ci-sec" name="secao">${K.SECOES_COMPRA.map(s => html`<option value="${s}" ${st.secao === s ? 'selected' : ''}>${s}</option>`)}</select></div>
      </div>
      <div class="field"><span class="label">Lista</span>
        <div class="chips" role="group" aria-label="Lista">${listas().map(l => html`<button type="button" class="chip${st.lista === l ? ' on' : ''}" data-set="lista" data-v="${l}" aria-pressed="${st.lista === l ? 'true' : 'false'}">${l}</button>`)}</div></div>
      ${subsDe(st.lista).length ? html`<div class="field"><span class="label">Sublista</span>
        <div class="chips" role="group" aria-label="Sublista">${['', ...subsDe(st.lista)].map(n => html`<button type="button" class="chip${st.sublista === n ? ' on' : ''}" data-set="sublista" data-v="${n}" aria-pressed="${st.sublista === n ? 'true' : 'false'}">${n || 'Geral'}</button>`)}</div></div>` : ''}
      ${err ? html`<p class="form-error" role="alert">${err}</p>` : ''}
      <div class="modal-actions">
        <button type="button" class="btn danger-ghost" data-del>${icon('trash', 16)}Excluir</button>
        <button type="submit" class="btn primary push-right">Salvar</button>
      </div>
    </form>`;
    openModal({
      title: 'Editar item', body: form(), small: true,
      onMount(api) {
        const redraw = () => { api.body.innerHTML = String(form()); };
        api.body.addEventListener('click', e => {
          const b = e.target.closest('[data-set]');
          if (b) { st[b.dataset.set] = b.dataset.v; if (b.dataset.set === 'lista' && !subsDe(st.lista).includes(st.sublista)) st.sublista = ''; redraw(); return; }
          if (e.target.closest('[data-del]')) { DB.apagar('compras', c.id, 'Item removido'); api.close(); }
        });
        api.body.addEventListener('input', e => { if (e.target.name) st[e.target.name] = e.target.value; });
        api.body.addEventListener('change', e => { if (e.target.name) st[e.target.name] = e.target.value; });
        api.body.addEventListener('submit', e => {
          e.preventDefault();
          if (!st.nome.trim()) { err = 'Escreva o nome do item.'; redraw(); return; }
          DB.update('compras', c.id, Object.assign({ nome: st.nome.trim(), qtd: st.qtd.trim() || null, secao: st.secao, lista: st.lista }, st.sublista || c.sublista ? { sublista: st.sublista || null } : {}));
          api.close();
        });
      },
    });
  });

  /* usado na tela inicial */
  function pendentes(limite = 4) {
    const todas = DB.all('compras').filter(c => !c.comprado).sort((a, b) => String(a.criado_em || '').localeCompare(String(b.criado_em || '')));
    return { total: todas.length, itens: todas.slice(0, limite) };
  }

  global.Compras = { render, pendentes };
})(window);
