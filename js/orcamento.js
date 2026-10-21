/* Orçamento por categoria: um limite mensal por categoria de saída, com alertas. */
(function (global) {
  'use strict';
  const U = global.UI, DB = global.DB;
  const { html, icon, fmt, parseMoney, moneyInput, today, monthKey, addMonthsKey, monthLabel, daysInMonth, K, openModal, confirmDialog, toast, on, Forms } = U;
  const F = () => global.Financas;

  const catDe = i => i.categoria || 'Outros';
  function gastos(mk) {
    const m = new Map();
    F().itensDoMes(mk).filter(i => i.tipo === 'saida').forEach(i => m.set(catDe(i), (m.get(catDe(i)) || 0) + i.valor));
    return m;
  }
  const orcamentos = () => DB.all('orcamentos').filter(o => +o.limite > 0);
  const limiteDe = c => { const o = DB.all('orcamentos').find(x => x.categoria === c); return o ? +o.limite : 0; };
  const nivel = pct => pct >= 100 ? 'over' : pct >= 80 ? 'warn' : 'ok';
  const nivelTxt = { over: 'Estourou', warn: 'Quase no limite', ok: 'Dentro do limite' };

  /* Dados prontos para as telas (Finanças · Orçamento e o painel do mês). */
  function dados(mk) {
    const g = gastos(mk), orc = orcamentos();
    const linhas = orc.map(o => {
      const gasto = g.get(o.categoria) || 0, lim = +o.limite, pct = lim ? gasto / lim * 100 : 0;
      return { id: o.id, cat: o.categoria, lim, gasto, pct, resta: lim - gasto, nivel: nivel(pct) };
    }).sort((a, b) => b.pct - a.pct);
    const sem = [...new Set([...K.CAT_SAIDA, ...g.keys()])].filter(c => !orc.some(o => o.categoria === c))
      .map(c => ({ cat: c, gasto: g.get(c) || 0 })).sort((a, b) => b.gasto - a.gasto);
    const tot = linhas.reduce((a, l) => ({ lim: a.lim + l.lim, gasto: a.gasto + l.gasto }), { lim: 0, gasto: 0 });
    return { linhas, sem, tot, g };
  }

  function barra(l) {
    return html`<div class="obar ${l.nivel}" role="img" aria-label="${Math.round(l.pct)}% do limite usado"><span style="width:${Math.min(100, l.pct).toFixed(1)}%"></span></div>`;
  }
  function linha(l, media) {
    return html`<li class="orc-row ${l.nivel}">
      <button type="button" class="orc-main" data-act="fin:orc-edit" data-cat="${l.cat}" aria-label="Editar limite de ${l.cat}">
        <span class="orc-top"><span class="orc-name">${l.cat}</span><span class="orc-pct">${Math.round(l.pct)}%</span></span>
        ${barra(l)}
        <span class="orc-bot"><span>${fmt(l.gasto)} de ${fmt(l.lim)}</span>
          <span class="${l.resta < 0 ? 'neg-text' : 'muted'}">${l.resta < 0 ? 'passou ' + fmt(-l.resta) : 'resta ' + fmt(l.resta)}</span></span>
        ${media > 0 ? html`<span class="orc-avg">média dos últimos 3 meses: ${fmt(media)}</span>` : ''}
      </button></li>`;
  }

  function view() {
    const mk = F().mes(), atual = mk === monthKey(today());
    const { linhas, sem, tot } = dados(mk);
    const m3 = new Map(); [1, 2, 3].forEach(n => gastos(addMonthsKey(mk, -n)).forEach((v, c) => m3.set(c, (m3.get(c) || 0) + v / 3)));
    const resta = tot.lim - tot.gasto, pctTot = tot.lim ? tot.gasto / tot.lim * 100 : 0;
    const estourou = linhas.filter(l => l.nivel === 'over'), quase = linhas.filter(l => l.nivel === 'warn');
    const dia = +today().slice(8, 10), dm = daysInMonth(mk), faltam = dm - dia + 1;
    const ritmo = atual && tot.lim ? tot.gasto / dia * dm : 0;

    return html`
      <div class="monthbar">
        <button type="button" class="icon-btn" data-act="fin:prev" aria-label="Mês anterior">${icon('chevL')}</button>
        <h2 class="monthname" aria-live="polite">${monthLabel(mk)}</h2>
        <button type="button" class="icon-btn" data-act="fin:next" aria-label="Próximo mês">${icon('chevR')}</button>
        ${!atual ? html`<button type="button" class="btn ghost small" data-act="fin:hoje">Mês atual</button>` : ''}
        <button type="button" class="btn ghost small push-right" data-act="fin:orc-sugerir" ${sem.some(s => (m3.get(s.cat) || 0) > 0) ? '' : 'disabled'}>${icon('gauge', 16)}Sugerir limites</button>
      </div>

      ${linhas.length ? html`
      <div class="kpis three">
        <div class="kpi money"><strong>${fmt(tot.lim)}</strong><span>Orçado no mês</span></div>
        <div class="kpi money ${pctTot >= 100 ? 'bad' : ''}"><strong>${fmt(tot.gasto)}</strong><span>Gasto nessas categorias (${Math.round(pctTot)}%)</span></div>
        <div class="kpi money ${resta < 0 ? 'bad' : 'good'}"><strong>${fmt(Math.abs(resta))}</strong><span>${resta < 0 ? 'Acima do orçado' : 'Ainda disponível'}</span></div>
      </div>` : ''}

      <div class="cols"><div class="col-main">
        ${linhas.length ? html`<section class="section first"><div class="section-head"><h3>Com limite</h3><span class="count">${linhas.length}</span></div>
          <ul class="orc-list">${linhas.map(l => linha(l, m3.get(l.cat) || 0))}</ul></section>`
        : html`<div class="empty"><h3>Defina quanto querem gastar em cada categoria</h3>
            <p>Escolha um limite mensal (Mercado, Lazer, Transporte...) e o painel avisa quando estiver chegando perto. Dá para começar pela média dos últimos meses.</p>
            <div class="empty-actions"><button type="button" class="btn primary" data-act="fin:orc-sugerir" ${sem.some(s => (m3.get(s.cat) || 0) > 0) ? '' : 'disabled'}>Sugerir limites pela média</button>
            <button type="button" class="btn ghost" data-act="fin:orc-novo">Definir um limite</button></div></div>`}

        ${sem.length ? html`<section class="section"><div class="section-head"><h3>Sem limite</h3><span class="count">${sem.length}</span></div>
          <ul class="orc-free">${sem.map(s => html`<li><span class="orc-name">${s.cat}</span><span class="muted">${s.gasto > 0 ? fmt(s.gasto) + ' neste mês' : 'sem gastos'}</span>
            <button type="button" class="btn ghost small" data-act="fin:orc-edit" data-cat="${s.cat}">Definir limite</button></li>`)}</ul></section>` : ''}
      </div>

      <aside class="side" aria-label="Alertas do orçamento">
        <section class="card">
          <div class="card-head"><h3>Atenção</h3></div>
          ${estourou.length || quase.length ? html`<ul class="alert-list">
            ${estourou.map(l => html`<li class="over">${icon('flag', 16)}<span><b>${l.cat}</b> passou ${fmt(-l.resta)} do limite.</span></li>`)}
            ${quase.map(l => html`<li class="warn">${icon('flag', 16)}<span><b>${l.cat}</b> já usou ${Math.round(l.pct)}% do limite (resta ${fmt(l.resta)}).</span></li>`)}
          </ul>` : html`<p class="muted-line">${linhas.length ? 'Tudo dentro dos limites em ' + monthLabel(mk) + '.' : 'Quando definirem limites, os alertas aparecem aqui.'}</p>`}
        </section>
        ${atual && linhas.length ? html`<section class="card">
          <div class="card-head"><h3>Ritmo do mês</h3></div>
          <dl class="pace">
            <div><dt>Dias que faltam</dt><dd>${faltam}</dd></div>
            <div><dt>Pode gastar por dia</dt><dd>${resta > 0 ? fmt(resta / faltam) : fmt(0)}</dd></div>
            <div><dt>No ritmo atual, fecha em</dt><dd class="${ritmo > tot.lim ? 'neg-text' : ''}">${fmt(ritmo)}</dd></div>
          </dl>
          <p class="card-note">Conta só as categorias com limite. O ritmo considera o que já foi lançado até hoje (inclui contas fixas e parcelas do mês).</p>
        </section>` : ''}
        <section class="card">
          <div class="card-head"><h3>Como funciona</h3></div>
          <p class="card-note" style="margin-top:0">O limite vale para todos os meses. Entram no cálculo todas as saídas da categoria no mês: avulsas, contas fixas e parcelas, pagas ou não.</p>
        </section>
      </aside></div>

      <button type="button" class="fab" data-act="fin:orc-novo">${icon('plus')}<span>Novo limite</span></button>`;
  }

  /* Painel compacto para a aba Mês */
  function painel(mk) {
    const { linhas } = dados(mk);
    if (!linhas.length) return html`<section class="card">
      <div class="card-head"><h3>Orçamento</h3><a class="link" href="#/financas/orcamento">Definir</a></div>
      <p class="muted-line">Defina um limite mensal por categoria e acompanhe aqui.</p></section>`;
    return html`<section class="card">
      <div class="card-head"><h3>Orçamento</h3><a class="link" href="#/financas/orcamento">Ver tudo</a></div>
      <ul class="orc-mini">${linhas.slice(0, 4).map(l => html`<li class="${l.nivel}"><span class="orc-top"><span class="orc-name">${l.cat}</span><span class="orc-pct">${Math.round(l.pct)}%</span></span>${barra(l)}</li>`)}</ul>
    </section>`;
  }

  function abrirForm(cat) {
    const existente = DB.all('orcamentos').find(o => o.categoria === cat);
    const mk = F().mes();
    const media = cat ? [1, 2, 3].reduce((a, n) => a + (gastos(addMonthsKey(mk, -n)).get(cat) || 0), 0) / 3 : 0;
    const cats = [...new Set([...K.CAT_SAIDA, ...gastos(mk).keys()])];
    openModal({
      title: existente ? 'Editar limite' : 'Novo limite', small: true, focus: true,
      body: html`<form class="form" novalidate>
        <div class="field"><label class="label" for="o-cat">Categoria</label>
          <select id="o-cat" name="cat" ${existente ? 'disabled' : ''}>${cats.map(c => html`<option value="${c}" ${c === cat ? 'selected' : ''}>${c}</option>`)}</select></div>
        <div class="field"><label class="label" for="o-lim">Limite por mês (R$)</label>
          <input id="o-lim" name="lim" data-num="money" maxlength="13" inputmode="decimal" placeholder="0,00" value="${existente ? moneyInput(existente.limite) : (media > 0 ? moneyInput(Math.ceil(media / 10) * 10) : '')}" autocomplete="off"></div>
        ${media > 0 ? html`<p class="hint">Nos últimos 3 meses, a média foi de ${fmt(media)}.</p>` : ''}
        <p class="form-error" role="alert" hidden></p>
        <div class="modal-actions">${existente ? html`<button type="button" class="btn danger-ghost" data-orc-del>Remover limite</button>` : ''}
          <button type="submit" class="btn primary">Salvar</button></div>
      </form>`,
      onMount(api) {
        api.el.addEventListener('click', async e => {
          if (!e.target.closest('[data-orc-del]')) return;
          await DB.apagar('orcamentos', existente.id, 'Limite removido'); api.close();
        });
        api.el.querySelector('form').addEventListener('submit', async e => {
          e.preventDefault();
          const f = e.target, c = existente ? existente.categoria : f.cat.value, v = parseMoney(f.lim.value);
          const err = f.querySelector('.form-error');
          if (!(v > 0)) { err.hidden = false; err.textContent = 'Digite um valor maior que zero.'; return; }
          if (existente) await DB.update('orcamentos', existente.id, { limite: v });
          else if (limiteDe(c)) await DB.update('orcamentos', DB.all('orcamentos').find(x => x.categoria === c).id, { limite: v });
          else await DB.insert('orcamentos', { categoria: c, limite: v });
          api.close(); toast('Limite salvo');
        });
      },
    });
  }

  async function sugerir() {
    const mk = F().mes(), g = [1, 2, 3].map(n => gastos(addMonthsKey(mk, -n)));
    const sug = [];
    K.CAT_SAIDA.forEach(c => {
      if (limiteDe(c)) return;
      const media = g.reduce((a, m) => a + (m.get(c) || 0), 0) / 3;
      if (media >= 20) sug.push([c, Math.ceil(media / 10) * 10]);
    });
    if (!sug.length) { toast('Ainda não há histórico suficiente para sugerir.'); return; }
    const ok = await confirmDialog({
      title: 'Sugerir limites?',
      message: 'Vou criar um limite para ' + sug.length + (sug.length === 1 ? ' categoria' : ' categorias') + ' com a média dos últimos 3 meses (arredondada para cima): ' + sug.slice(0, 4).map(([c, v]) => c + ' ' + fmt(v)).join(', ') + (sug.length > 4 ? ' e outras' : '') + '. Dá para ajustar cada uma depois.',
      confirmLabel: 'Criar limites',
    });
    if (!ok) return;
    for (const [categoria, limite] of sug) await DB.insert('orcamentos', { categoria, limite }, { silent: true });
    DB.log('financas', `criou ${sug.length} limites de orçamento pela média dos últimos meses`);
    toast('Limites criados');
  }

  on('fin:orc-novo', () => abrirForm(''));
  on('fin:orc-edit', el => abrirForm(el.dataset.cat));
  on('fin:orc-sugerir', () => sugerir());

  global.Orcamento = { view, painel, dados };
})(window);
