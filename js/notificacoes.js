/* Notificações: o que cada pessoa fez no painel (lançou, marcou, adicionou...). */
(function (global) {
  'use strict';
  const U = global.UI, DB = global.DB;
  const { html, icon, K, today, addDays, parseYMD, DIAS, MESES, pad, on, lsGet, lsSet, agoLabel, pessoaSlot } = U;

  const AREAS = {
    financas: { nome: 'Finanças', ic: 'wallet', rota: '#/financas' },
    tarefas: { nome: 'Tarefas', ic: 'tasks', rota: '#/tarefas' },
    compras: { nome: 'Compras', ic: 'cart', rota: '#/compras' },
    notas: { nome: 'Notas', ic: 'note', rota: '#/notas' },
    metas: { nome: 'Metas', ic: 'target', rota: '#/metas' },
    geral: { nome: 'Geral', ic: 'more', rota: '#/inicio' },
  };
  const S = { quem: 'outros', area: 'todas', limite: 80, prev: null, ultima: 0 };
  const CUR = { root: null };
  const refresh = () => { if (CUR.root && U.route.nome === 'notificacoes') render(CUR.root); };

  const eu = () => DB.user && DB.user.nome;
  const outro = () => K.NOMES.find(n => n !== eu()) || 'o outro';
  const chaveVisto = () => 'np:notif:visto:' + eu();
  function visto() {
    let v = lsGet(chaveVisto());
    if (!v) { v = new Date().toISOString(); lsSet(chaveVisto(), v); }   // primeira vez: começa do zero
    return v;
  }
  const marcarVisto = () => lsSet(chaveVisto(), new Date().toISOString());
  const ordem = () => DB.all('atividades').slice().sort((a, b) => String(b.criado_em).localeCompare(String(a.criado_em)));
  function naoLidas() {
    if (!DB.user || !DB.user.nome) return 0;
    const v = visto();
    return DB.all('atividades').filter(a => a.autor !== eu() && String(a.criado_em) > v).length;
  }

  const dia = iso => { const d = new Date(iso); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const hora = iso => { const d = new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  function tituloDia(ymd) {
    if (ymd === today()) return 'Hoje';
    if (ymd === addDays(today(), -1)) return 'Ontem';
    const d = parseYMD(ymd);
    return `${DIAS[d.getDay()].replace(/^./, c => c.toUpperCase())}, ${d.getDate()} de ${MESES[d.getMonth()]}`;
  }
  function link(a) {
    const ar = AREAS[a.area] || AREAS.geral;
    if (a.area === 'notas' && a.ref && DB.find('notas', a.ref)) return `#/notas/${a.ref}`;
    return ar.rota;
  }

  function render(root) {
    CUR.root = root;
    const agora = Date.now();
    if (agora - S.ultima > 4000) S.prev = visto();            // acabou de abrir a aba: guarda o que era "novo"
    S.ultima = agora; marcarVisto();
    if (global.App && global.App.badge) global.App.badge();

    const todas = ordem(), me = eu(), o = outro();
    const passaQuem = a => S.quem === 'todas' || (S.quem === 'minhas' ? a.autor === me : a.autor !== me);
    const base = todas.filter(passaQuem);
    const lista = base.filter(a => S.area === 'todas' || a.area === S.area);
    const mostradas = lista.slice(0, S.limite);
    const grupos = [];
    mostradas.forEach(a => { const d = dia(a.criado_em), g = grupos[grupos.length - 1]; if (g && g.d === d) g.itens.push(a); else grupos.push({ d, itens: [a] }); });
    const hoje = todas.filter(a => dia(a.criado_em) === today());
    const porPessoa = K.NOMES.map(n => [n, hoje.filter(a => a.autor === n).length]);
    const porArea = Object.keys(AREAS).map(k => [k, base.filter(a => a.area === k).length]).filter(([, n]) => n);
    const novas = a => a.autor !== me && String(a.criado_em) > S.prev;

    const corpo = grupos.length ? html`${grupos.map(g => html`<section class="section first act-day"><div class="section-head"><h3>${tituloDia(g.d)}</h3><span class="count">${g.itens.length}</span></div>
      <ul class="act-list">${g.itens.map(a => { const ar = AREAS[a.area] || AREAS.geral; return html`<li class="act${novas(a) ? ' novo' : ''}">
        <a class="act-link" href="${link(a)}"><span class="act-av p-${pessoaSlot(a.autor)}" aria-hidden="true">${(a.autor || '?')[0]}</span>
          <span class="act-body"><span class="act-text"><b>${a.autor}</b> ${a.texto}</span>
            <span class="act-meta">${icon(ar.ic, 13)}${ar.nome} · ${hora(a.criado_em)}${novas(a) ? html` <span class="act-new">novo</span>` : ''}</span></span></a></li>`; })}</ul></section>`)}
      ${lista.length > mostradas.length ? html`<button type="button" class="btn ghost" data-act="not-f:mais">Mostrar mais (${lista.length - mostradas.length})</button>` : ''}`
      : html`<div class="empty"><h3>${S.quem === 'outros' ? `Nada de ${o} por aqui ainda` : 'Nenhuma movimentação'}</h3>
        <p>${S.quem === 'outros' ? `Quando ${o} lançar uma conta, marcar algo como pago, adicionar uma tarefa ou um item de compra, aparece aqui na hora.` : 'Quando alguém fizer algo no painel, o registro aparece aqui.'}</p></div>`;

    root.innerHTML = String(html`<section class="page">
      <header class="page-head"><h1>Notificações</h1></header>

      <div class="filters">
        <div class="chips" role="group" aria-label="De quem">
          ${[['outros', `De ${o}`], ['minhas', 'Minhas'], ['todas', 'Dos dois']].map(([v, n]) => html`<button type="button" class="chip${S.quem === v ? ' on' : ''}" data-act="not-f:quem" data-v="${v}" aria-pressed="${S.quem === v ? 'true' : 'false'}">${n}</button>`)}
        </div>
        <div class="chips small" role="group" aria-label="Área">
          <button type="button" class="chip${S.area === 'todas' ? ' on' : ''}" data-act="not-f:area" data-v="todas" aria-pressed="${S.area === 'todas' ? 'true' : 'false'}">Tudo</button>
          ${Object.entries(AREAS).filter(([k]) => k !== 'geral').map(([k, a]) => html`<button type="button" class="chip${S.area === k ? ' on' : ''}" data-act="not-f:area" data-v="${k}" aria-pressed="${S.area === k ? 'true' : 'false'}">${a.nome}</button>`)}
        </div>
      </div>

      <div class="cols"><div class="col-main">
        ${corpo}
      </div>
      <aside class="side" aria-label="Resumo das movimentações">
        <section class="card">
          <div class="card-head"><h3>Hoje no painel</h3></div>
          <ul class="top-list">${porPessoa.map(([n, c]) => html`<li><span class="top-name">${U.pessoaTag(n)}</span><strong>${c} ${c === 1 ? 'ação' : 'ações'}</strong></li>`)}</ul>
        </section>
        ${porArea.length ? html`<section class="card">
          <div class="card-head"><h3>Por área</h3></div>
          <ul class="top-list">${porArea.map(([k, c]) => html`<li><span class="top-name act-area">${icon(AREAS[k].ic, 15)}${AREAS[k].nome}</span><strong>${c}</strong></li>`)}</ul>
        </section>` : ''}
        <section class="card"><div class="card-head"><h3>Como funciona</h3></div>
          <p class="card-note" style="margin-top:0">Tudo que um faz (lançamentos, tarefas, compras, notas, metas) fica registrado aqui para o outro ver. O número no menu mostra o que chegou desde a última vez que você abriu esta aba. O histórico guarda os últimos 90 dias.</p></section>
      </aside></div>
    </section>`);
  }

  on('not-f:quem', el => { S.quem = el.dataset.v; S.limite = 80; refresh(); });
  on('not-f:area', el => { S.area = el.dataset.v; S.limite = 80; refresh(); });
  on('not-f:mais', () => { S.limite += 100; refresh(); });

  global.Notificacoes = { render, naoLidas, AREAS };
})(window);
