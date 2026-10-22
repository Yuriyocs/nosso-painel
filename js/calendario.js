/* Calendário de vencimentos: contas, entradas e (opcional) tarefas e metas. */
(function (global) {
  'use strict';
  const U = global.UI, DB = global.DB;
  const { html, icon, fmt, today, pad, monthKey, addMonthsKey, daysInMonth, monthLabel, dateLabel, longDate, parseYMD, on, lsGet, lsSet, K } = U;

  const S = { mes: monthKey(today()), sel: today(), extra: lsGet('np:cal:extra') === '1' };
  const CUR = { root: null };
  let MAP = new Map();
  const refresh = () => { if (CUR.root && U.route.nome === 'calendario') render(CUR.root); };

  const vazio = () => ({ saidas: [], entradas: [], tarefas: [], metas: [] });

  function dados(mk) {
    const dias = {};
    const get = d => dias[d] || (dias[d] = vazio());
    const F = global.Financas;
    const itens = F.itensDoMes(mk).filter(i => !F.ehCredito(i)).concat(F.faturasDoMes(mk));   // compras no crédito aparecem como uma fatura no dia do vencimento
    MAP = new Map(itens.map(i => [i.key, i]));
    itens.forEach(it => get(it.data)[it.tipo === 'entrada' ? 'entradas' : 'saidas'].push(it));
    if (S.extra) {
      DB.all('tarefas').filter(t => !t.feita && t.prazo && monthKey(t.prazo) === mk).forEach(t => get(t.prazo).tarefas.push(t));
      DB.all('metas').filter(m => !m.concluida && m.prazo && monthKey(m.prazo) === mk).forEach(m => get(m.prazo).metas.push(m));
    }
    return { dias, itens };
  }

  function curto(v) {
    if (v >= 1000) return 'R$ ' + (v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil';
    return 'R$ ' + Math.round(v).toLocaleString('pt-BR');
  }

  function grade(mk, dias) {
    const [y, m] = mk.split('-').map(Number);
    const primeiro = new Date(y, m - 1, 1).getDay(), n = daysInMonth(mk), t0 = today();
    const cels = [];
    for (let i = 0; i < primeiro; i++) cels.push(html`<span class="cal-cell blank" aria-hidden="true"></span>`);
    for (let d = 1; d <= n; d++) {
      const data = `${mk}-${pad(d)}`, x = dias[data] || vazio();
      const pend = x.saidas.filter(i => !i.pago), pagas = x.saidas.length - pend.length;
      const totalPend = pend.reduce((a, i) => a + i.valor, 0);
      const resumoAria = [pend.length ? `${pend.length} a pagar` : '', pagas ? `${pagas} pago` : '', x.entradas.length ? `${x.entradas.length} entrada` : '', x.tarefas.length ? `${x.tarefas.length} tarefa` : '', x.metas.length ? `${x.metas.length} meta` : ''].filter(Boolean).join(', ') || 'nada marcado';
      cels.push(html`<button type="button" class="cal-cell${data === t0 ? ' today' : ''}${data === S.sel ? ' sel' : ''}${pend.length && data < t0 ? ' late' : ''}" data-act="cal:dia" data-d="${data}" aria-pressed="${data === S.sel ? 'true' : 'false'}" aria-label="Dia ${d}: ${resumoAria}">
        <span class="cal-num">${d}</span>
        <span class="cal-dots">${pend.length ? html`<i class="dot out"></i>` : ''}${pagas ? html`<i class="dot paid"></i>` : ''}${x.entradas.length ? html`<i class="dot in"></i>` : ''}${x.tarefas.length ? html`<i class="dot task"></i>` : ''}${x.metas.length ? html`<i class="dot meta"></i>` : ''}</span>
        ${totalPend > 0 ? html`<span class="cal-val">${curto(totalPend)}</span>` : ''}
        ${(() => { const todos = [...pend, ...x.entradas, ...x.saidas.filter(i => i.pago)]; return todos.length ? html`<span class="cal-items" aria-hidden="true">${todos.slice(0, 3).map(i => html`<span class="cal-it ${i.tipo === 'entrada' ? 'in' : i.pago ? 'paid' : 'out'}">${i.descricao}</span>`)}${todos.length > 3 ? html`<span class="cal-it more">+${todos.length - 3}</span>` : ''}</span>` : ''; })()}
      </button>`);
    }
    return cels;
  }

  function metaRow(m) {
    return html`<li class="row"><span class="check static" aria-hidden="true">${icon('target', 14)}</span>
      <button type="button" class="row-body" data-act="met:abrir" data-id="${m.id}"><span class="row-title">${m.titulo}</span><span class="row-meta"><span class="badge">Prazo da meta</span></span></button></li>`;
  }

  function render(root) {
    CUR.root = root;
    const mk = S.mes, atual = mk === monthKey(today());
    if (monthKey(S.sel) !== mk) S.sel = atual ? today() : mk + '-01';
    const { dias, itens } = dados(mk);
    const saidas = itens.filter(i => i.tipo === 'saida');
    const faltaPagar = saidas.filter(i => !i.pago).reduce((a, i) => a + i.valor, 0);
    const jaPago = saidas.filter(i => i.pago).reduce((a, i) => a + i.valor, 0);
    const pendentes = saidas.filter(i => !i.pago).sort((a, b) => a.data.localeCompare(b.data));
    const x = dias[S.sel] || vazio();
    const doDia = [...x.saidas, ...x.entradas].sort((a, b) => (a.pago ? 1 : 0) - (b.pago ? 1 : 0) || (a.tipo === b.tipo ? 0 : a.tipo === 'saida' ? -1 : 1));
    const diaPend = x.saidas.filter(i => !i.pago).reduce((a, i) => a + i.valor, 0);
    const diaEnt = x.entradas.reduce((a, i) => a + i.valor, 0);
    const nada = !doDia.length && !x.tarefas.length && !x.metas.length;

    root.innerHTML = String(html`<section class="page">
      <header class="page-head"><h1>Calendário</h1><p class="page-sub">Vencimentos de contas, parcelas e entradas.</p></header>

      <div class="monthbar">
        <button type="button" class="icon-btn" data-act="cal:prev" aria-label="Mês anterior">${icon('chevL')}</button>
        <h2 class="monthname" aria-live="polite">${monthLabel(mk)}</h2>
        <button type="button" class="icon-btn" data-act="cal:next" aria-label="Próximo mês">${icon('chevR')}</button>
        ${!atual ? html`<button type="button" class="btn ghost small" data-act="cal:hoje">Mês atual</button>` : ''}
      </div>

      <div class="summary-line">
        <div><span class="muted">Falta pagar no mês</span><strong class="neg-text">${fmt(faltaPagar)}</strong></div>
        <div><span class="muted">Já pago</span><strong>${fmt(jaPago)}</strong></div>
      </div>

      <div class="cols"><div class="col-main">
      <div class="cal-wrap">
        <div class="cal-head" aria-hidden="true">${['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'].map(d => html`<span>${d}</span>`)}</div>
        <div class="cal-grid" role="group" aria-label="Dias de ${monthLabel(mk)}">${grade(mk, dias)}</div>
      </div>
      <div class="cal-legend">
        <span><i class="dot out"></i>A pagar</span><span><i class="dot paid"></i>Pago ou lançado</span><span><i class="dot in"></i>Entrada</span>
        ${S.extra ? html`<span><i class="dot task"></i>Tarefa</span><span><i class="dot meta"></i>Meta</span>` : ''}
        <button type="button" class="chip small${S.extra ? ' on' : ''}" data-act="cal:extra" aria-pressed="${S.extra ? 'true' : 'false'}">Tarefas e metas</button>
      </div>

      </div>
      <aside class="side sticky">
      <section class="card">
        <div class="card-head"><h3>${dateLabel(S.sel) === 'hoje' ? 'Hoje' : dateLabel(S.sel).replace(/^./, c => c.toUpperCase())}, ${parseYMD(S.sel).getDate()} de ${U.MESES[parseYMD(S.sel).getMonth()]}</h3>
          ${diaPend > 0 ? html`<span class="section-sum out">${fmt(diaPend)}</span>` : diaEnt > 0 ? html`<span class="section-sum in">${fmt(diaEnt)}</span>` : ''}</div>
        ${nada ? html`<p class="muted-line">Nada marcado para este dia.</p>` : html`<ul class="rows">
          ${doDia.map(i => global.Financas.rowItem(i, 'cal'))}
          ${x.tarefas.map(t => global.Tarefas.rowHtml(t))}
          ${x.metas.map(metaRow)}</ul>`}
      </section>

      ${pendentes.length ? html`<section class="card">
        <div class="card-head"><h3>Falta pagar em ${monthLabel(mk).split(' de ')[0]}</h3><span class="count">${pendentes.length}</span></div>
        <ul class="rows compact scroll">${pendentes.map(i => global.Financas.rowItem(i, 'cal'))}</ul>
      </section>` : ''}
      </aside></div>
    </section>`);
  }

  on('cal:prev', () => { S.mes = addMonthsKey(S.mes, -1); refresh(); });
  on('cal:next', () => { S.mes = addMonthsKey(S.mes, 1); refresh(); });
  on('cal:hoje', () => { S.mes = monthKey(today()); S.sel = today(); refresh(); });
  on('cal:dia', el => { S.sel = el.dataset.d; refresh(); });
  on('cal:extra', () => { S.extra = !S.extra; lsSet('np:cal:extra', S.extra ? '1' : '0'); refresh(); });
  on('cal:pago', el => { const it = MAP.get(el.dataset.key); if (it) global.Financas.togglePago(it); });
  on('cal:editar', el => { const it = MAP.get(el.dataset.key); if (it) global.Financas.openItem(it); });

  global.Calendario = { render };
})(window);
