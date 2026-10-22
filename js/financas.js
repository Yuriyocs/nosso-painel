/* Finanças: mês, fixas, parcelados e guardado. */
(function (global) {
  'use strict';
  const U = global.UI, DB = global.DB;
  const { html, icon, fmt, parseMoney, moneyInput, today, monthKey, addMonthsKey, monthDiff, dateInMonth, monthLabel, monthShort, addMonthsDate,
    K, bancoTag, pessoaTag, pessoaSlot, openModal, confirmDialog, toast, on, Inputs, Forms, lsGet, lsSet, dateLabel, ymd } = U;

  /* ---------- estado da tela ---------- */
  const SAVED = (() => { try { return JSON.parse(lsGet('np:fin') || '{}'); } catch (e) { return {}; } })();
  const S = {
    mes: monthKey(today()),
    pessoa: SAVED.pessoa || 'todos',
    banco: SAVED.banco || 'todos',
    tipo: SAVED.tipo || 'todos',
    agrupar: SAVED.agrupar || 'categoria',
    parc: SAVED.parc || 'andamento',
    busca: '', aba: 'pend', lim: 15, chaveLista: '',
  };
  const PAG = 15;
  const persist = () => lsSet('np:fin', JSON.stringify({ pessoa: S.pessoa, banco: S.banco, tipo: S.tipo, agrupar: S.agrupar, parc: S.parc }));
  const CUR = { root: null, sub: 'mes' };
  const refresh = () => { if (CUR.root && U.route.nome === 'financas') render(CUR.root, CUR.sub); };
  let ITENS = new Map();

  /* ---------- regras de cálculo ---------- */
  function parcelaValor(p, k) {
    const cents = Math.round(+p.valor_total * 100), n = +p.parcelas;
    const base = Math.floor(cents / n), resto = cents - base * n;
    return (base + (k <= resto ? 1 : 0)) / 100;
  }
  const parcelaMes = (p, k) => addMonthsKey(monthKey(p.primeira), k - 1);
  const parcelasPagasSet = p => new Set(DB.all('parcelas_pagas').filter(x => x.parcelado_id === p.id && x.numero <= +p.parcelas).map(x => x.numero));

  /* ----- fatura do cartão: a compra no crédito é paga no vencimento da fatura, não no dia da compra ----- */
  const PAG_RE = /\b(pagto|pgto|pagamento|pag\.)/i;               // "PAGTO ANTECIPADO": pagamento da fatura anterior, não é entrada
  const ehCredito = i => i.origem === 'parcela' || i.forma === 'Crédito';
  function cartaoDe(banco, pessoa) {
    const cs = DB.all('cartoes').filter(c => c.banco === (banco || 'Outro') && c.vencimento);
    return cs.find(c => c.pessoa === pessoa) || cs.find(c => !c.pessoa || c.pessoa === 'Casal' || pessoa === 'Casal') || null;
  }
  const diaFechamento = c => { if (+c.fechamento >= 1 && +c.fechamento <= 31) return +c.fechamento; const f = +c.vencimento - 7; return f >= 1 ? f : f + 30; };
  /* data de vencimento da fatura em que uma compra no crédito cai (ou null se não há cartão cadastrado) */
  function faturaVenc(banco, pessoa, data) {
    const c = cartaoDe(banco, pessoa); if (!c || !data) return null;
    const fech = diaFechamento(c), venc = +c.vencimento, dia = +data.slice(8, 10);
    let mk = monthKey(data);
    if (dia > fech) mk = addMonthsKey(mk, 1);          // passou do fechamento: vai para a fatura seguinte
    if (venc <= fech) mk = addMonthsKey(mk, 1);        // vencimento cai no mês seguinte ao fechamento
    return dateInMonth(mk, venc);
  }
  const pagoPadrao = st => (st.tipo === 'saida' && st.forma === 'Crédito')
    ? (() => { const fv = faturaVenc(st.banco, st.pessoa, st.data); return fv ? fv <= today() : false; })()
    : st.data <= today();

  /* mês do gasto: compra no crédito conta no mês em que a fatura FECHA (a fatura que fecha em setembro é o gasto de setembro) */
  function mesGasto(l) {
    if (l.forma !== 'Crédito' || !l.fatura) return monthKey(l.data);
    const c = cartaoDe(l.banco, l.pessoa); if (!c) return monthKey(l.data);
    return +c.vencimento <= diaFechamento(c) ? addMonthsKey(monthKey(l.fatura), -1) : monthKey(l.fatura);
  }
  function itemLanc(l) {
    const credito = l.forma === 'Crédito', venc = credito ? (l.fatura || l.data) : l.data;
    return { key: 'lanc:' + l.id, origem: 'lanc', id: l.id, ref: l, forma: l.forma, tipo: l.tipo, descricao: l.descricao, valor: +l.valor, data: l.data, venc, comp: mesGasto(l), categoria: l.categoria, banco: l.banco, pessoa: l.pessoa, pago: l.pago !== false, tag: credito && l.fatura && l.fatura !== l.data ? 'Fatura ' + dateLabel(l.fatura) : '' };
  }
  const ehPagamentoFatura = l => l.tipo === 'entrada' && l.forma === 'Crédito' && PAG_RE.test(l.descricao || '');   // pagamento da fatura anterior: não é entrada
  function itemParcela(p, k, pagas) {
    const data = dateInMonth(parcelaMes(p, k), +p.primeira.slice(8, 10));
    return { key: 'parc:' + p.id + ':' + k, origem: 'parcela', id: p.id, ref: p, numero: k, tipo: 'saida', descricao: p.descricao, valor: parcelaValor(p, k), data, venc: faturaVenc(p.banco, p.pessoa, data) || data, categoria: p.categoria, banco: p.banco, pessoa: p.pessoa, pago: pagas.has(p.id + '|' + k), tag: `Parcela ${k}/${p.parcelas}` };
  }

  /* gasto do mês: cada compra no mês em que foi feita (competência) */
  function itensDoMes(mk) {
    const out = [];
    const pagasFixa = new Set(DB.all('fixas_pagas').map(x => x.fixa_id + '|' + x.mes));
    const pagasParc = new Set(DB.all('parcelas_pagas').map(x => x.parcelado_id + '|' + x.numero));

    DB.all('lancamentos').forEach(l => {
      if (ehPagamentoFatura(l)) return;
      const it = itemLanc(l);
      if (it.comp === mk) out.push(it);
    });
    DB.all('fixas').forEach(f => {
      if (mk < monthKey(f.inicio)) return;
      if (f.fim && mk > monthKey(f.fim)) return;
      const data = dateInMonth(mk, +f.inicio.slice(8, 10));
      out.push({ key: 'fixa:' + f.id + ':' + mk, origem: 'fixa', id: f.id, ref: f, mes: mk, tipo: f.tipo, descricao: f.descricao, valor: +f.valor, data, venc: data, categoria: f.categoria, banco: f.banco, pessoa: f.pessoa, pago: pagasFixa.has(f.id + '|' + mk), tag: 'Todo mês' });
    });
    DB.all('parcelados').forEach(p => {
      const k = monthDiff(monthKey(p.primeira), mk) + 1;
      if (k < 1 || k > +p.parcelas) return;
      out.push(itemParcela(p, k, pagasParc));
    });
    return out;
  }

  /* fatura do cartão: compras no crédito que vencem no mês (é quando o dinheiro sai da conta) */
  function itensFatura(mk) {
    const out = [], pagasParc = new Set(DB.all('parcelas_pagas').map(x => x.parcelado_id + '|' + x.numero));
    DB.all('lancamentos').forEach(l => {
      if (l.forma !== 'Crédito' || ehPagamentoFatura(l)) return;
      if (monthKey(l.fatura || l.data) === mk) out.push(itemLanc(l));
    });
    DB.all('parcelados').forEach(p => {
      const kc = monthDiff(monthKey(p.primeira), mk) + 1;
      for (let k = Math.max(1, kc - 2); k <= Math.min(+p.parcelas, kc + 2); k++) {
        const it = itemParcela(p, k, pagasParc);
        if (monthKey(it.venc) === mk) out.push(it);
      }
    });
    return out;
  }
  /* uma linha por fatura (banco + pessoa + vencimento), para calendário e "próximos vencimentos" */
  function faturasDoMes(mk, filtro) {
    const m = new Map();
    itensFatura(mk).filter(i => !filtro || filtro(i)).forEach(i => {
      const k = [i.banco || 'Outro', i.pessoa || '', i.venc].join('|');
      const g = m.get(k) || { key: 'fat:' + k, origem: 'fatura', itens: [], tipo: 'saida', valor: 0, data: i.venc, venc: i.venc, banco: i.banco, pessoa: i.pessoa, categoria: null, tag: 'Fatura do cartão', pago: true };
      g.itens.push(i); g.valor += i.tipo === 'entrada' ? -i.valor : i.valor; if (!i.pago) g.pago = false;
      m.set(k, g);
    });
    return [...m.values()].map(g => {
      const c = cartaoDe(g.banco, g.pessoa);
      return Object.assign(g, { descricao: 'Fatura ' + (g.banco || 'Outro') + (c && c.final ? ' final ' + c.final : '') });
    }).filter(g => g.valor > 0.004);
  }
  /* o que sai da conta no mês por causa das faturas */
  function caixaInfo(mk, filtro) {
    const its = itensFatura(mk).filter(i => !filtro || filtro(i));
    const total = its.reduce((a, i) => a + (i.tipo === 'entrada' ? -i.valor : i.valor), 0);
    const falta = its.filter(i => !i.pago).reduce((a, i) => a + (i.tipo === 'entrada' ? -i.valor : i.valor), 0);
    const datas = [...new Set(its.map(i => i.venc))].sort();
    return { total, falta, venc: datas[0] || null };
  }
  /* "Fecha dia 27 · vence 10/11" do cartão (ou dos cartões) que passam no filtro */
  function cicloTexto(filtroBanco, filtroPessoa) {
    const cs = DB.all('cartoes').filter(c => c.vencimento && (!filtroBanco || filtroBanco === 'todos' || c.banco === filtroBanco) && (!filtroPessoa || filtroPessoa === 'todos' || !c.pessoa || c.pessoa === 'Casal' || c.pessoa === filtroPessoa));
    return cs.slice(0, 2).map(c => `${cs.length > 1 ? c.banco + ': ' : ''}fecha dia ${diaFechamento(c)} · vence ${dateLabel(faturaVenc(c.banco, c.pessoa, today()))}`).join(' | ');
  }

  function resumo(items) {
    const r = { ent: 0, sai: 0, entRec: 0, saiPago: 0, conta: { ent: 0, sai: 0 }, cartao: 0, cartaoFalta: 0 };
    items.forEach(i => {
      const cred = ehCredito(i);
      if (i.tipo === 'entrada') { r.ent += i.valor; if (i.pago) r.entRec += i.valor; if (cred) { r.cartao -= i.valor; if (!i.pago) r.cartaoFalta -= i.valor; } else r.conta.ent += i.valor; }
      else { r.sai += i.valor; if (i.pago) r.saiPago += i.valor; if (cred) { r.cartao += i.valor; if (!i.pago) r.cartaoFalta += i.valor; } else r.conta.sai += i.valor; }
    });
    r.sobra = r.ent - r.sai; r.falta = r.sai - r.saiPago;
    return r;
  }
  const passaBanco = i => S.banco === 'todos' || (i.banco || 'Outro') === S.banco;
  const passaPessoa = i => S.pessoa === 'todos' || i.pessoa === S.pessoa;
  const passaTipo = i => S.tipo === 'todos' || i.tipo === S.tipo;

  function proximos(dias = 7, limite = 5) {
    const t0 = today(), mk = monthKey(t0), ate = U.addDays(t0, dias);
    const ms = [mk, addMonthsKey(mk, 1)];
    return ms.flatMap(m => itensDoMes(m).filter(i => !ehCredito(i)).concat(faturasDoMes(m)))
      .filter(i => i.tipo === 'saida' && !i.pago && i.data <= ate)
      .sort((a, b) => a.data.localeCompare(b.data)).slice(0, limite);
  }

  /* ---------- peças de tela ---------- */
  function heroHtml(r, { split = '', label = 'Sobra prevista', delta = null, caixa = null, ciclo = '' } = {}) {
    const pct = r.sai > 0 ? Math.min(100, Math.round(r.saiPago / r.sai * 100)) : 0;
    return html`<div class="hero">
      <div class="hero-main"><span class="hero-label">${label}</span><span class="hero-value ${r.sobra < 0 ? 'neg' : 'pos'}">${fmt(r.sobra)}</span></div>
      <dl class="hero-stats">
        <div class="in"><dt>${icon('up', 13)}Entradas</dt><dd>${fmt(r.ent)}</dd></div>
        <div class="out"><dt>${icon('down', 13)}Saídas</dt><dd>${fmt(r.sai)}</dd>${delta != null && isFinite(delta) ? html`<small class="delta ${delta > 0 ? 'up' : 'down'}">${delta > 0 ? '▲' : delta < 0 ? '▼' : '='} ${Math.abs(Math.round(delta))}% vs mês anterior</small>` : ''}</div>
        <div><dt>Falta pagar</dt><dd>${fmt(r.falta)}</dd></div>
      </dl>
      <div class="paybar" role="img" aria-label="${pct}% das saídas já pagas"><span style="width:${pct}%"></span></div>
      ${split}
    </div>${doisCards(r, caixa, ciclo)}`;
  }

  /* dois cards: o que há na conta (débito/pix) e o que está no cartão de crédito */
  function doisCards(r, c, ciclo) {
    c = c || { total: 0, falta: 0, venc: null };
    const conta = r.conta.ent - r.conta.sai - c.total;
    return html`<div class="duo">
      <section class="duo-card conta"><span class="duo-label">${icon('wallet', 15)}Na conta · débito, pix e faturas</span>
        <strong class="duo-val ${conta < 0 ? 'neg' : 'pos'}">${fmt(conta)}</strong>
        <small>Entradas ${fmt(r.conta.ent)} − débito/pix ${fmt(r.conta.sai)}${c.total > 0.004 ? html` − fatura que vence ${c.venc ? 'dia ' + dateLabel(c.venc) : 'no mês'} (${fmt(c.total)}${c.falta > 0.004 ? ', falta pagar' : ', paga'})` : ''}</small></section>
      <section class="duo-card cartao"><span class="duo-label">${icon('card', 15)}Gasto no cartão de crédito</span>
        <strong class="duo-val">${fmt(r.cartao)}</strong>
        <small>Compras cuja fatura fecha neste mês; saem da conta no vencimento.${ciclo ? ' ' + ciclo.charAt(0).toUpperCase() + ciclo.slice(1) + '.' : ''}</small></section>
    </div>`;
  }

  function splitHtml(items) {
    const tot = {};
    items.filter(i => i.tipo === 'saida').forEach(i => { const n = i.pessoa || 'Casal'; tot[n] = (tot[n] || 0) + i.valor; });
    const soma = Object.values(tot).reduce((a, b) => a + b, 0);
    if (!soma) return '';
    const nomes = Object.keys(tot).sort((a, b) => tot[b] - tot[a]);
    return html`<div class="split" role="img" aria-label="Divisão das saídas por pessoa">
        ${nomes.map(n => html`<span class="seg-${pessoaSlot(n)}" style="width:${(tot[n] / soma * 100).toFixed(2)}%"></span>`)}
      </div>
      <ul class="split-legend">
        ${nomes.map(n => html`<li><i class="seg-${pessoaSlot(n)}"></i>${n} <strong>${fmt(tot[n])}</strong></li>`)}
      </ul>`;
  }

  function grupos(items, por, tipo = 'saida') {
    const m = new Map();
    items.filter(i => i.tipo === tipo).forEach(i => {
      const k = por === 'categoria' ? (i.categoria || 'Sem categoria') : por === 'banco' ? (i.banco || 'Outro') : (i.pessoa || 'Casal');
      m.set(k, (m.get(k) || 0) + i.valor);
    });
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }

  function rowItem(it, pref = 'fin') {
    const entrada = it.tipo === 'entrada';
    const dia = `dia ${+it.data.slice(8, 10)}`;
    const aria = it.pago ? 'Marcar como pendente' : (entrada ? 'Marcar como recebido' : 'Marcar como pago');
    return html`<li class="row ${entrada ? 'in' : 'out'}${it.pago ? ' done' : ''}">
      <button type="button" class="check ${it.tipo}${it.pago ? ' on' : ''}" data-act="${pref}:pago" data-key="${it.key}" aria-pressed="${it.pago ? 'true' : 'false'}" aria-label="${aria}">${icon('check', 14)}</button>
      <button type="button" class="row-body" data-act="${pref}:editar" data-key="${it.key}">
        <span class="row-title">${it.descricao}</span>
        <span class="row-meta"><span class="badge ${entrada ? 'in' : 'out'}">${entrada ? 'Entrada' : 'Saída'}</span>${bancoTag(it.banco)}${pessoaTag(it.pessoa)}${it.categoria ? html`<span class="meta-text">${it.categoria}</span>` : ''}${it.tag ? html`<span class="badge">${it.tag}</span>` : ''}</span>
      </button>
      <div class="row-amount ${it.tipo}"><strong>${entrada ? '+' : '−'} ${fmt(it.valor)}</strong><small>${dia}</small></div>
    </li>`;
  }

  const subtabs = sub => html`<nav class="subtabs" aria-label="Seções de finanças">
    ${[['mes', 'Mês'], ['cartoes', 'Cartões'], ['orcamento', 'Orçamento'], ['fixas', 'Fixas'], ['parcelados', 'Parcelados'], ['guardado', 'Guardado']].map(([id, nome]) =>
      html`<a href="#/financas${id === 'mes' ? '' : '/' + id}" class="subtab${sub === id ? ' on' : ''}"${sub === id ? html` aria-current="page"` : ''}>${nome}</a>`)}
  </nav>`;

  /* ---------- séries e painéis laterais ---------- */
  function serie(centro, antes, depois, filtrar) {
    const out = [];
    for (let i = -antes; i <= depois; i++) {
      const mk = addMonthsKey(centro, i);
      let it = itensDoMes(mk);
      if (filtrar) it = it.filter(passaBanco).filter(passaPessoa);
      const r = resumo(it);
      out.push({ mk, ent: r.ent, sai: r.sai, sobra: r.sobra, parc: it.filter(x => x.origem === 'parcela' && !x.pago).reduce((a, x) => a + x.valor, 0) });
    }
    return out;
  }
  const compacto = v => { const a = Math.abs(v); return (v < 0 ? '−' : '') + (a >= 1000 ? (a / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil' : Math.round(a).toLocaleString('pt-BR')); };
  function chartMeses(ser, sel, act) {
    const max = Math.max(1, ...ser.flatMap(x => [x.ent, x.sai])), hoje = monthKey(today());
    return html`<div class="mchart" role="group" aria-label="Entradas e saídas por mês">
      ${ser.map(x => html`<button type="button" class="mcol${x.mk === sel ? ' on' : ''}${x.mk > hoje ? ' fut' : ''}" data-act="${act}" data-mk="${x.mk}" aria-label="${monthLabel(x.mk)}: entradas ${fmt(x.ent)}, saídas ${fmt(x.sai)}, sobra ${fmt(x.sobra)}">
        <span class="mbars"><i class="in" style="height:${(x.ent / max * 100).toFixed(1)}%"></i><i class="out" style="height:${(x.sai / max * 100).toFixed(1)}%"></i></span>
        <span class="mlab">${monthShort(x.mk).split('/')[0]}</span>
        <span class="msobra ${x.sobra < 0 ? 'neg' : 'pos'}">${compacto(x.sobra)}</span>
      </button>`)}
    </div>
    <p class="chart-legend"><span><i class="lg in"></i>Entradas</span><span><i class="lg out"></i>Saídas</span><span class="muted">Número embaixo: sobra do mês</span></p>`;
  }
  function cardProjecao(sel, filtrar, act = 'fin:mes') {
    const ser = serie(monthKey(today()), 1, 4, filtrar);
    const parc = ser.filter(x => x.mk > monthKey(today())).reduce((a, x) => a + x.parc, 0);
    return html`<section class="card">
      <div class="card-head"><h3>Próximos meses</h3></div>
      ${chartMeses(ser, sel, act)}
      <p class="card-note">Meses futuros mostram só o que já está cadastrado: contas fixas e parcelas.${parc > 0 ? html` Em parcelas, vocês já têm <b>${fmt(parc)}</b> comprometidos nos próximos 4 meses.` : ''}</p>
    </section>`;
  }
  function listaBarras(pares, cls) {
    const max = pares.length ? pares[0][1] : 0, tot = pares.reduce((a, [, v]) => a + v, 0);
    return html`<ul class="bars ${cls}">${pares.map(([nome, v, rot]) => html`<li>
      <div class="bar-line"><span class="bar-name">${rot || nome}</span><span class="bar-val">${fmt(v)} <small>${tot ? Math.round(v / tot * 100) : 0}%</small></span></div>
      <div class="bar-track"><span style="width:${max ? (v / max * 100).toFixed(1) : 0}%"></span></div></li>`)}</ul>`;
  }

  /* ---------- aba: mês ---------- */
  function viewMes() {
    const mk = S.mes;
    const todos = itensDoMes(mk);
    ITENS = new Map(todos.map(i => [i.key, i]));
    const base = todos.filter(passaBanco);
    const doFiltro = base.filter(passaPessoa);   // alimenta o resumo do topo
    const itens = doFiltro.filter(passaTipo);    // alimenta a lista
    const r = resumo(doFiltro);
    const nEnt = doFiltro.filter(i => i.tipo === 'entrada').length, nSai = doFiltro.length - nEnt;
    const pend = itens.filter(i => !i.pago).sort((a, b) => a.data.localeCompare(b.data));
    const conc = itens.filter(i => i.pago).sort((a, b) => b.data.localeCompare(a.data));
    const rotPend = S.tipo === 'entrada' ? 'A receber' : S.tipo === 'saida' ? 'A pagar' : 'Pendentes';
    const rotConc = S.tipo === 'entrada' ? 'Recebidas' : S.tipo === 'saida' ? 'Pagas e lançadas' : 'Pagos e lançados';
    const soma = L => S.tipo === 'todos' ? '' : html`<span class="section-sum ${S.tipo === 'entrada' ? 'in' : 'out'}">${fmt(L.reduce((a, i) => a + i.valor, 0))}</span>`;
    const atual = mk === monthKey(today());
    const tipoGr = S.tipo === 'entrada' ? 'entrada' : 'saida';
    const gr = grupos(itens, S.agrupar, tipoGr), maxG = gr.length ? gr[0][1] : 0, totG = gr.reduce((a, [, v]) => a + v, 0);
    const filtrando = S.pessoa !== 'todos' || S.banco !== 'todos' || S.tipo !== 'todos';
    const tbtn = (v, rotulo, cls, n) => html`<button type="button" class="seg-btn ${cls}${S.tipo === v ? ' on' : ''}" data-act="fin:tipo" data-v="${v}" aria-pressed="${S.tipo === v ? 'true' : 'false'}">${v === 'entrada' ? icon('up', 14) : v === 'saida' ? icon('down', 14) : ''}${rotulo}${n == null ? '' : html` <span class="seg-n">${n}</span>`}</button>`;

    const q = U.norm(S.busca || '');
    const chaveLista = [mk, S.pessoa, S.banco, S.tipo, S.busca, S.aba].join('|');
    if (S.chaveLista !== chaveLista) { S.chaveLista = chaveLista; S.lim = PAG; }
    const lPend = q ? pend.filter(i => U.norm([i.descricao, i.categoria, i.banco, i.pessoa, i.tag].join(' ')).includes(q)) : pend;
    const lConc = q ? conc.filter(i => U.norm([i.descricao, i.categoria, i.banco, i.pessoa, i.tag].join(' ')).includes(q)) : conc;
    const aba = S.aba, ativa = aba === 'pago' ? lConc : lPend, visiveis = ativa.slice(0, S.lim);
    const prev = resumo(itensDoMes(addMonthsKey(mk, -1)).filter(passaBanco).filter(passaPessoa));
    const delta = prev.sai > 0 ? (r.sai - prev.sai) / prev.sai * 100 : null;
    const maiores = itens.filter(i => i.tipo === 'saida').sort((a, b) => b.valor - a.valor).slice(0, 5);

    return html`
      <div class="monthbar">
        <button type="button" class="icon-btn" data-act="fin:prev" aria-label="Mês anterior">${icon('chevL')}</button>
        <h2 class="monthname" aria-live="polite">${monthLabel(mk)}</h2>
        <button type="button" class="icon-btn" data-act="fin:next" aria-label="Próximo mês">${icon('chevR')}</button>
        ${!atual ? html`<button type="button" class="btn ghost small" data-act="fin:hoje">Mês atual</button>` : ''}
        <button type="button" class="btn ghost small push-right" data-act="fin:fatura">${icon('upload', 16)}Importar fatura</button>
        <button type="button" class="btn ghost small" data-act="fin:csv" ${itens.length ? '' : 'disabled'}>${icon('download', 16)}Exportar</button>
      </div>

      <div class="filters">
        <div class="seg tipo-seg" role="group" aria-label="Mostrar">
          ${tbtn('todos', 'Tudo', 't-todos')}${tbtn('entrada', 'Entradas', 't-entrada', nEnt)}${tbtn('saida', 'Saídas', 't-saida', nSai)}
        </div>
        <div class="filters-row">
          <div class="chips" role="group" aria-label="Filtrar por pessoa">
            ${['todos', ...K.PESSOAS].map(p => html`<button type="button" class="chip${S.pessoa === p ? ' on' : ''}" data-act="fin:pessoa" data-v="${p}" aria-pressed="${S.pessoa === p ? 'true' : 'false'}">${p === 'todos' ? 'Todos' : p}</button>`)}
          </div>
          <label class="select-inline"><span class="sr-only">Banco</span>
            <select data-input="fin:banco" aria-label="Filtrar por banco">
              <option value="todos">Todos os bancos</option>
              ${K.BANCOS.map(b => html`<option value="${b}" ${S.banco === b ? 'selected' : ''}>${b}</option>`)}
            </select>
          </label>
          <label class="search small push-right">${icon('search', 16)}<span class="sr-only">Buscar lançamentos</span>
            <input id="fin-busca" type="search" data-input="fin:busca" value="${S.busca}" placeholder="Buscar" autocomplete="off"></label>
        </div>
      </div>

      ${heroHtml(r, { split: splitHtml(base), delta, caixa: caixaInfo(mk, i => passaBanco(i) && passaPessoa(i)), ciclo: mk === monthKey(today()) ? cicloTexto(S.banco, S.pessoa) : '', label: (S.pessoa !== 'todos' || S.banco !== 'todos') ? 'Sobra prevista (filtro ativo)' : 'Sobra prevista' })}

      <div class="cols">
        <div class="col-main">
          ${itens.length === 0 ? html`<div class="empty">
              <h3>${S.tipo === 'entrada' ? 'Nenhuma entrada' : S.tipo === 'saida' ? 'Nenhuma saída' : 'Nada por aqui'} em ${monthLabel(mk)}</h3>
              <p>${filtrando ? 'Nenhum lançamento combina com os filtros escolhidos.' : 'Toque em Lançar para registrar uma entrada, uma saída, uma conta fixa ou uma compra parcelada.'}</p>
            </div>` : (q && !lPend.length && !lConc.length) ? html`<div class="empty small"><h3>Nada encontrado</h3><p>Nenhum lançamento de ${monthLabel(mk)} tem "${S.busca}".</p></div>` : html`
            <div class="seg lista-seg" role="tablist" aria-label="Ver lançamentos">
              <button type="button" role="tab" class="seg-btn${aba === 'pend' ? ' on' : ''}" data-act="fin:aba" data-v="pend" aria-selected="${aba === 'pend' ? 'true' : 'false'}">${rotPend} <span class="seg-n">${lPend.length}</span></button>
              <button type="button" role="tab" class="seg-btn${aba === 'pago' ? ' on' : ''}" data-act="fin:aba" data-v="pago" aria-selected="${aba === 'pago' ? 'true' : 'false'}">${rotConc} <span class="seg-n">${lConc.length}</span></button>
            </div>
            ${ativa.length ? html`<section class="section first"><div class="section-head"><h3>${aba === 'pend' ? rotPend : rotConc}</h3><span class="count">${ativa.length}</span>${soma(ativa)}</div>
              <ul class="rows">${visiveis.map(i => rowItem(i))}</ul>
              ${ativa.length > visiveis.length ? html`<button type="button" class="btn ghost block more-btn" data-act="fin:mais">Mostrar mais ${Math.min(PAG, ativa.length - visiveis.length)} <small>(faltam ${ativa.length - visiveis.length})</small></button>` : ativa.length > PAG ? html`<p class="list-end">Fim da lista</p>` : ''}</section>`
              : html`<div class="empty small"><h3>${aba === 'pend' ? 'Nada pendente' : 'Nada pago ainda'}</h3><p>${aba === 'pend' ? (lConc.length ? 'Tudo em dia neste filtro. Veja a aba ao lado para o que já foi pago.' : 'Nenhum lançamento pendente.') : 'Quando marcar um lançamento como pago, ele aparece aqui.'}</p></div>`}`}
        </div>

        <aside class="side" aria-label="Painéis do mês">
          ${gr.length ? html`<section class="card">
            <div class="card-head">
              <h3>${S.tipo === 'entrada' ? 'De onde veio' : 'Para onde foi'}</h3>
              <div class="chips small" role="group" aria-label="Agrupar por">
                ${[['categoria', 'Categoria'], ['banco', 'Banco'], ['pessoa', 'Pessoa']].map(([id, nome]) => html`<button type="button" class="chip${S.agrupar === id ? ' on' : ''}" data-act="fin:agrupar" data-v="${id}" aria-pressed="${S.agrupar === id ? 'true' : 'false'}">${nome}</button>`)}
              </div>
            </div>
            <ul class="bars ${tipoGr === 'entrada' ? 'in' : 'out'}">
              ${gr.map(([nome, v]) => html`<li>
                <div class="bar-line"><span class="bar-name">${S.agrupar === 'banco' ? bancoTag(nome) : S.agrupar === 'pessoa' ? pessoaTag(nome) : nome}</span><span class="bar-val">${fmt(v)} <small>${Math.round(v / totG * 100)}%</small></span></div>
                <div class="bar-track"><span style="width:${(v / maxG * 100).toFixed(1)}%"></span></div>
              </li>`)}
            </ul>
          </section>` : ''}
          ${global.Orcamento.painel(mk)}
          ${cardProjecao(mk, true)}
          ${maiores.length ? html`<section class="card">
            <div class="card-head"><h3>Maiores gastos</h3></div>
            <ol class="top-list">${maiores.map((i, n) => html`<li><span class="top-n">${n + 1}</span><span class="top-name">${i.descricao}${i.tag ? html` <small>${i.tag}</small>` : ''}</span><strong>${fmt(i.valor)}</strong></li>`)}</ol>
          </section>` : ''}
        </aside>
      </div>

      <button type="button" class="fab" data-act="fin:novo">${icon('plus')}<span>Lançar</span></button>`;
  }

  /* ---------- aba: fixas ---------- */
  function viewFixas() {
    const mk = monthKey(today());
    const fixas = DB.all('fixas').slice().sort((a, b) => (a.tipo === b.tipo ? +a.inicio.slice(8, 10) - +b.inicio.slice(8, 10) : a.tipo === 'entrada' ? -1 : 1));
    const ativa = f => mk >= monthKey(f.inicio) && (!f.fim || mk <= monthKey(f.fim));
    const sai = fixas.filter(f => f.tipo === 'saida' && ativa(f)).reduce((a, f) => a + +f.valor, 0);
    const ent = fixas.filter(f => f.tipo === 'entrada' && ativa(f)).reduce((a, f) => a + +f.valor, 0);
    const porCat = new Map();
    fixas.filter(f => f.tipo === 'saida' && ativa(f)).forEach(f => porCat.set(f.categoria || 'Sem categoria', (porCat.get(f.categoria || 'Sem categoria') || 0) + +f.valor));
    const pares = [...porCat.entries()].sort((a, b) => b[1] - a[1]);
    return html`
      <div class="summary-line">
        <div><span class="muted">Saídas fixas por mês</span><strong>${fmt(sai)}</strong></div>
        <div><span class="muted">Entradas fixas por mês</span><strong>${fmt(ent)}</strong></div>
        <div><span class="muted">Sobra das fixas</span><strong class="${ent - sai < 0 ? 'neg-text' : ''}">${fmt(ent - sai)}</strong></div>
      </div>
      <div class="cols"><div class="col-main">
      ${fixas.length === 0 ? html`<div class="empty"><h3>Nenhuma conta fixa ainda</h3><p>Aluguel, salário, internet, assinaturas: cadastre uma vez e ela aparece sozinha em todos os meses.</p></div>` : html`
      <ul class="rows grid">
        ${fixas.map(f => html`<li class="row${ativa(f) ? '' : ' done'}">
          <span class="check static ${f.tipo}" aria-hidden="true">${icon(f.tipo === 'entrada' ? 'up' : 'down', 14)}</span>
          <button type="button" class="row-body" data-act="fin:fixa" data-id="${f.id}">
            <span class="row-title">${f.descricao}</span>
            <span class="row-meta">${bancoTag(f.banco)}${pessoaTag(f.pessoa)}${f.categoria ? html`<span class="meta-text">${f.categoria}</span>` : ''}${!ativa(f) ? html`<span class="badge">Encerrada</span>` : ''}</span>
          </button>
          <div class="row-amount ${f.tipo}"><strong>${fmt(f.valor)}</strong><small>todo dia ${+f.inicio.slice(8, 10)}</small></div>
        </li>`)}
      </ul>`}
      </div>
      <aside class="side">${pares.length ? html`<section class="card"><div class="card-head"><h3>Fixas por categoria</h3></div>${listaBarras(pares, 'out')}</section>` : ''}
        ${sai > 0 ? html`<section class="card"><div class="card-head"><h3>Peso das fixas</h3></div>
          <p class="card-note">${ent > 0 ? html`As contas fixas levam <b>${Math.round(sai / ent * 100)}%</b> das entradas fixas.` : 'Cadastre as entradas fixas (salário) para ver quanto as contas pesam.'}</p>
          ${ent > 0 ? html`<div class="bar-track"><span style="width:${Math.min(100, sai / ent * 100).toFixed(1)}%;background:var(--neg)"></span></div>` : ''}</section>` : ''}
      </aside></div>
      <button type="button" class="fab" data-act="fin:novo-fixo">${icon('plus')}<span>Nova fixa</span></button>`;
  }

  /* ---------- aba: parcelados ---------- */
  function viewParcelados() {
    const mk = monthKey(today());
    const lista = DB.all('parcelados').map(p => {
      const pagas = parcelasPagasSet(p).size, n = +p.parcelas;
      return { p, pagas, n, quitado: pagas >= n };
    });
    const andamento = lista.filter(x => !x.quitado), quitados = lista.filter(x => x.quitado);
    const mostrar = (S.parc === 'quitados' ? quitados : andamento).sort((a, b) => a.p.descricao.localeCompare(b.p.descricao));
    let restante = 0, mensal = 0;
    andamento.forEach(({ p, n }) => {
      const pagas = parcelasPagasSet(p);
      for (let k = 1; k <= n; k++) if (!pagas.has(k)) restante += parcelaValor(p, k);
      const k = monthDiff(monthKey(p.primeira), mk) + 1;
      if (k >= 1 && k <= n) mensal += parcelaValor(p, k);
    });
    return html`
      <div class="summary-line">
        <div><span class="muted">Parcelas deste mês</span><strong>${fmt(mensal)}</strong></div>
        <div><span class="muted">Ainda falta pagar</span><strong>${fmt(restante)}</strong></div>
      </div>
      <div class="cols"><div class="col-main">
      <div class="chips" role="group" aria-label="Filtrar compras">
        <button type="button" class="chip${S.parc === 'andamento' ? ' on' : ''}" data-act="fin:parc-filtro" data-v="andamento">Em andamento (${andamento.length})</button>
        <button type="button" class="chip${S.parc === 'quitados' ? ' on' : ''}" data-act="fin:parc-filtro" data-v="quitados">Quitados (${quitados.length})</button>
      </div>
      ${mostrar.length === 0 ? html`<div class="empty"><h3>${S.parc === 'quitados' ? 'Nenhuma compra quitada' : 'Nenhuma compra parcelada'}</h3><p>${S.parc === 'quitados' ? 'Quando todas as parcelas de uma compra forem marcadas como pagas, ela aparece aqui.' : 'Cole o valor total e a quantidade de parcelas, e o painel distribui nos meses certos.'}</p></div>` : html`
      <ul class="rows grid">
        ${mostrar.map(({ p, pagas, n }) => {
          const ultima = parcelaMes(p, n), pct = Math.round(pagas / n * 100);
          let rest = 0; const ps = parcelasPagasSet(p); for (let k = 1; k <= n; k++) if (!ps.has(k)) rest += parcelaValor(p, k);
          return html`<li class="row tall">
            <button type="button" class="row-body" data-act="fin:parc" data-id="${p.id}">
              <span class="row-title">${p.descricao}</span>
              <span class="row-meta">${bancoTag(p.banco)}${pessoaTag(p.pessoa)}<span class="meta-text">${pagas} de ${n} pagas</span><span class="meta-text">até ${monthShort(ultima)}</span></span>
              <span class="bar-track thin"><span style="width:${pct}%"></span></span>
            </button>
            <div class="row-amount saida"><strong>${fmt(parcelaValor(p, 1))}</strong><small>${rest > 0 ? 'restam ' + fmt(rest) : 'quitado'}</small></div>
          </li>`;
        })}
      </ul>`}
      </div>
      <aside class="side">
        <section class="card"><div class="card-head"><h3>Quanto vence por mês</h3></div>
          ${(() => {
            const m = []; const c0 = monthKey(today());
            for (let i = 0; i < 12; i++) { const mk2 = addMonthsKey(c0, i); const v = itensDoMes(mk2).filter(x => x.origem === 'parcela' && !x.pago).reduce((a, x) => a + x.valor, 0); m.push([mk2, v]); }
            const max = Math.max(1, ...m.map(x => x[1]));
            return html`<ul class="bars out">${m.map(([mk2, v]) => html`<li><div class="bar-line"><span class="bar-name">${monthShort(mk2)}</span><span class="bar-val">${v > 0 ? fmt(v) : '—'}</span></div><div class="bar-track"><span style="width:${(v / max * 100).toFixed(1)}%"></span></div></li>`)}</ul>`;
          })()}
          <p class="card-note">Soma das parcelas que ainda faltam pagar em cada mês.</p></section>
      </aside></div>
      <button type="button" class="fab" data-act="fin:novo-parcelado">${icon('plus')}<span>Nova compra</span></button>`;
  }

  /* ---------- aba: guardado ---------- */
  const saldoCofre = c => DB.all('cofre_movs').filter(m => m.cofre_id === c.id).reduce((a, m) => a + +m.valor, 0);
  function viewGuardado() {
    const cofres = DB.all('cofres').slice().sort((a, b) => a.nome.localeCompare(b.nome));
    const total = cofres.reduce((a, c) => a + saldoCofre(c), 0);
    return html`
      <div class="summary-line single"><div><span class="muted">Total guardado</span><strong class="big">${fmt(total)}</strong></div></div>
      <div class="cols"><div class="col-main">
      ${cofres.length === 0 ? html`<div class="empty"><h3>Nada guardado ainda</h3><p>Crie um cofre para a reserva de emergência, a viagem, o carro novo. Depois é só registrar quanto entra e quanto sai.</p></div>` : html`
      <ul class="rows grid">
        ${cofres.map(c => {
          const s = saldoCofre(c), meta = +c.meta || 0, pct = meta ? Math.max(0, Math.min(100, Math.round(s / meta * 100))) : 0;
          return html`<li class="row tall">
            <button type="button" class="row-body" data-act="fin:cofre" data-id="${c.id}">
              <span class="row-title">${c.nome}</span>
              <span class="row-meta">${bancoTag(c.banco)}${pessoaTag(c.pessoa)}${meta ? html`<span class="meta-text">${pct}% de ${fmt(meta)}</span>` : ''}</span>
              ${meta ? html`<span class="bar-track thin"><span style="width:${pct}%"></span></span>` : ''}
            </button>
            <div class="row-amount entrada"><strong>${fmt(s)}</strong>
              <span class="mini-actions">
                <button type="button" class="btn ghost small" data-act="fin:mov" data-id="${c.id}" data-sinal="1">${icon('plus', 14)}Guardar</button>
                <button type="button" class="btn ghost small" data-act="fin:mov" data-id="${c.id}" data-sinal="-1">${icon('minus', 14)}Retirar</button>
              </span>
            </div>
          </li>`;
        })}
      </ul>`}
      </div>
      <aside class="side">
        <section class="card"><div class="card-head"><h3>Últimas movimentações</h3></div>
          ${(() => {
            const nome = id => (DB.find('cofres', id) || {}).nome || 'Cofre';
            const ms = DB.all('cofre_movs').slice().sort((a, b) => String(b.data).localeCompare(String(a.data)) || String(b.criado_em || '').localeCompare(String(a.criado_em || ''))).slice(0, 8);
            return ms.length ? html`<ul class="top-list">${ms.map(m => html`<li><span class="top-name">${nome(m.cofre_id)}<small>${m.nota ? m.nota + ' · ' : ''}${dateLabel(m.data)}</small></span><strong class="${+m.valor < 0 ? 'neg-text' : 'pos-text'}">${+m.valor < 0 ? '−' : '+'} ${fmt(Math.abs(+m.valor))}</strong></li>`)}</ul>` : html`<p class="card-note">Quando vocês guardarem ou retirarem dinheiro, aparece aqui.</p>`;
          })()}
        </section>
      </aside></div>
      <button type="button" class="fab" data-act="fin:cofre-novo">${icon('plus')}<span>Novo cofre</span></button>`;
  }

  /* ---------- tela ---------- */
  function render(root, sub) {
    CUR.root = root;
    CUR.sub = ['mes', 'cartoes', 'orcamento', 'fixas', 'parcelados', 'guardado'].includes(sub) ? sub : 'mes';
    const ab = document.activeElement, keepBusca = ab && ab.id === 'fin-busca' ? { a: ab.selectionStart, b: ab.selectionEnd } : null;
    const corpo = CUR.sub === 'mes' ? viewMes() : CUR.sub === 'cartoes' ? global.Cartoes.view() : CUR.sub === 'orcamento' ? global.Orcamento.view() : CUR.sub === 'fixas' ? viewFixas() : CUR.sub === 'parcelados' ? viewParcelados() : viewGuardado();
    root.innerHTML = String(html`<section class="page">
      <header class="page-head"><h1>Finanças</h1>${subtabs(CUR.sub)}</header>
      ${corpo}
    </section>`);
    if (keepBusca) { const n = root.querySelector('#fin-busca'); if (n) { n.focus(); try { n.setSelectionRange(keepBusca.a, keepBusca.b); } catch (e) { /* ignora */ } } }
  }

  /* ---------- ações da aba mês ---------- */
  on('fin:prev', () => { S.mes = addMonthsKey(S.mes, -1); refresh(); });
  on('fin:next', () => { S.mes = addMonthsKey(S.mes, 1); refresh(); });
  on('fin:hoje', () => { S.mes = monthKey(today()); refresh(); });
  on('fin:pessoa', el => { S.pessoa = el.dataset.v; persist(); refresh(); });
  on('fin:agrupar', el => { S.agrupar = el.dataset.v; persist(); refresh(); });
  on('fin:parc-filtro', el => { S.parc = el.dataset.v; persist(); refresh(); });
  Inputs['fin:banco'] = el => { S.banco = el.value; persist(); refresh(); };
  Inputs['fin:busca'] = el => { S.busca = el.value; refresh(); };
  on('fin:mes', el => { S.mes = el.dataset.mk; if (U.route.nome === 'financas') refresh(); else location.hash = '#/financas'; });

  function togglePago(it) {
    if (it.origem === 'fatura') { const alvo = !it.pago; DB.lote(() => it.itens.forEach(x => { if (x.pago !== alvo) togglePago(x); }), 'financas', `${alvo ? 'marcou como paga' : 'reabriu'} a ${it.descricao.toLowerCase()}`); return; }
    if (it.origem === 'lanc') {
      DB.update('lancamentos', it.id, { pago: !it.pago });
    } else if (it.origem === 'fixa') {
      const ex = DB.all('fixas_pagas').find(x => x.fixa_id === it.id && x.mes === it.mes);
      if (ex) DB.remove('fixas_pagas', ex.id); else DB.insert('fixas_pagas', { fixa_id: it.id, mes: it.mes });
    } else if (it.origem === 'parcela') {
      const ex = DB.all('parcelas_pagas').find(x => x.parcelado_id === it.id && x.numero === it.numero);
      if (ex) DB.remove('parcelas_pagas', ex.id); else DB.insert('parcelas_pagas', { parcelado_id: it.id, numero: it.numero });
    }
  }
  function openItem(it) {
    if (it.origem === 'fatura') { global.location.hash = '#/financas/cartoes'; return; }
    if (it.origem === 'parcela') openParcelado(it.id); else openEntry({ edit: { origem: it.origem, ref: it.ref } });
  }
  on('fin:aba', el => { S.aba = el.dataset.v; refresh(); });
  on('fin:mais', () => { S.lim += PAG; refresh(); });
  on('fin:tipo', el => { S.tipo = el.dataset.v; persist(); refresh(); });
  on('fin:pago', el => { const it = ITENS.get(el.dataset.key); if (it) togglePago(it); });
  on('fin:editar', el => { const it = ITENS.get(el.dataset.key); if (it) openItem(it); });
  on('fin:novo', () => openEntry({ tipo: S.tipo === 'entrada' ? 'entrada' : 'saida' }));
  on('fin:novo-fixo', () => openEntry({ freq: 'fixo' }));
  on('fin:novo-parcelado', () => openEntry({ freq: 'parcelado' }));
  on('fin:fixa', el => { const f = DB.find('fixas', el.dataset.id); if (f) openEntry({ edit: { origem: 'fixa', ref: f } }); });
  on('fin:parc', el => openParcelado(el.dataset.id));
  on('fin:cofre', el => openCofre(el.dataset.id));
  on('fin:cofre-novo', () => openCofreForm());
  on('fin:mov', el => openMov(el.dataset.id, +el.dataset.sinal));
  on('fin:csv', () => {
    const itens = itensDoMes(S.mes).filter(passaBanco).filter(passaPessoa).filter(passaTipo).sort((a, b) => a.data.localeCompare(b.data));
    const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const num = v => v.toFixed(2).replace('.', ',');
    const linhas = [['Data', 'Tipo', 'Descrição', 'Valor', 'Categoria', 'Banco', 'Pessoa', 'Origem', 'Pago/recebido'].map(q).join(';')]
      .concat(itens.map(i => [i.data, i.tipo === 'entrada' ? 'Entrada' : 'Saída', i.descricao, num(i.valor), i.categoria || '', i.banco || '', i.pessoa || '', i.tag || 'Avulso', i.pago ? 'Sim' : 'Não'].map((v, idx) => idx === 3 ? v : q(v)).join(';')));
    const blob = new Blob(['﻿' + linhas.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `financas-${S.mes}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  /* ---------- modal: novo / editar lançamento ---------- */
  function defaultData() {
    const t0 = today();
    return monthKey(t0) === S.mes ? t0 : S.mes + '-01';
  }
  function stFromRef(edit) {
    const r = edit.ref;
    if (edit.origem === 'fixa') return { tipo: r.tipo, freq: 'fixo', descricao: r.descricao, valor: moneyInput(r.valor), parcelas: '12', data: r.inicio, fim: r.fim || '', banco: r.banco || 'Outro', pessoa: r.pessoa || K.PESSOAS[0], categoria: r.categoria || '', forma: 'Pix', obs: r.obs || '' };
    if (edit.origem === 'parcela') return { tipo: 'saida', freq: 'parcelado', descricao: r.descricao, valor: moneyInput(r.valor_total), parcelas: String(r.parcelas), data: r.primeira, fim: '', banco: r.banco || 'Outro', pessoa: r.pessoa || K.PESSOAS[0], categoria: r.categoria || '', forma: 'Crédito', obs: r.obs || '' };
    return { tipo: r.tipo, freq: 'unico', pago: r.pago !== false, pagoTocado: true, descricao: r.descricao, valor: moneyInput(r.valor), parcelas: '12', data: r.data, fim: '', banco: r.banco || 'Outro', pessoa: r.pessoa || K.PESSOAS[0], categoria: r.categoria || '', forma: r.forma || 'Pix', obs: r.obs || '' };
  }
  function previewParcelas(st) {
    const total = parseMoney(st.valor), n = parseInt(st.parcelas, 10);
    if (st.freq !== 'parcelado' || !(total > 0) || !(n >= 2)) return '';
    const cents = Math.round(total * 100), base = Math.floor(cents / n);
    const exato = base * n === cents;
    const fim = st.data ? ' Última parcela em ' + monthShort(addMonthsKey(st.data.slice(0, 7), n - 1)) + '.' : '';
    return `${n} parcelas ${exato ? 'de' : 'de cerca de'} ${fmt(base / 100)}.${fim}`;
  }

  function entryForm(st, edit, err, sugestoes) {
    const parcelado = st.freq === 'parcelado', fixo = st.freq === 'fixo', unico = st.freq === 'unico';
    const cats = st.tipo === 'entrada' ? K.CAT_ENTRADA : K.CAT_SAIDA;
    const seg = (campo, valor, rotulo, off, cls = '') => html`<button type="button" class="seg-btn ${cls}${st[campo] === valor ? ' on' : ''}" data-set="${campo}" data-v="${valor}" aria-pressed="${st[campo] === valor ? 'true' : 'false'}" ${off ? 'disabled' : ''}>${rotulo}</button>`;
    return html`<form class="form" novalidate data-entry>
      ${!edit ? html`<button type="button" class="import-link" data-act="fin:fatura">${icon('upload', 16)}<span>Tem a fatura do cartão em PDF? <b>Importar de uma vez</b></span></button>` : ''}
      ${!parcelado ? html`<div class="field"><span class="label">Tipo</span>
        <div class="seg" role="group" aria-label="Tipo">${seg('tipo', 'saida', html`${icon('down', 14)}Saída`, false, 't-saida')}${seg('tipo', 'entrada', html`${icon('up', 14)}Entrada`, false, 't-entrada')}</div></div>` : ''}
      <div class="field"><span class="label">Frequência</span>
        <div class="seg" role="group" aria-label="Frequência">
          ${seg('freq', 'unico', 'Avulso', !!edit)}${seg('freq', 'fixo', 'Todo mês', !!edit)}${st.tipo === 'saida' ? seg('freq', 'parcelado', 'Parcelado', !!edit) : ''}
        </div></div>

      <div class="field"><label class="label" for="f-desc">Descrição</label>
        <input id="f-desc" name="descricao" value="${st.descricao}" maxlength="80" autocomplete="off" list="f-sug" placeholder="${st.tipo === 'entrada' ? 'Ex.: Salário' : 'Ex.: Mercado'}" required>
        <datalist id="f-sug">${sugestoes.map(s => html`<option value="${s}"></option>`)}</datalist></div>

      <div class="grid2">
        <div class="field"><label class="label" for="f-valor">${parcelado ? 'Valor total da compra' : 'Valor'}</label>
          <input id="f-valor" name="valor" value="${st.valor}" data-num="money" maxlength="13" inputmode="decimal" autocomplete="off" placeholder="0,00" required></div>
        ${parcelado ? html`<div class="field"><label class="label" for="f-parc">Parcelas</label>
          <input id="f-parc" name="parcelas" data-num="int" maxlength="3" inputmode="numeric" value="${st.parcelas}"></div>` : ''}
      </div>
      ${parcelado ? html`<p class="hint" id="f-preview">${previewParcelas(st)}</p>` : ''}

      <div class="grid2">
        <div class="field"><label class="label" for="f-data">${unico ? 'Data' : fixo ? 'Primeiro vencimento' : 'Data da 1ª parcela'}</label>
          <input id="f-data" name="data" type="date" value="${st.data}" required></div>
        ${fixo ? html`<div class="field"><label class="label" for="f-fim">Termina em (opcional)</label>
          <input id="f-fim" name="fim" type="date" value="${st.fim}"></div>` : ''}
      </div>
      ${unico ? html`<label class="fat-toggle slim"><input type="checkbox" name="pago" ${(st.pagoTocado ? st.pago : pagoPadrao(st)) ? 'checked' : ''}>
        <span>${st.tipo === 'entrada' ? 'Já recebi' : 'Já foi pago'}<br><small>Desmarcado, fica em "${st.tipo === 'entrada' ? 'a receber' : 'a pagar'}" até você marcar.</small></span></label>` : ''}
      ${fixo ? html`<p class="hint">O lançamento se repete todo mês, no mesmo dia.${edit ? ' Mudanças valem para todos os meses. Para reajustar um valor, preencha "Termina em" aqui e crie outro a partir do mês do reajuste.' : ''}</p>` : ''}

      <div class="field"><span class="label">Banco</span>
        <div class="chips" role="group" aria-label="Banco">${K.BANCOS.map(b => html`<button type="button" class="chip${st.banco === b ? ' on' : ''}" data-set="banco" data-v="${b}" aria-pressed="${st.banco === b ? 'true' : 'false'}">${bancoTag(b)}</button>`)}</div></div>
      <div class="field"><span class="label">De quem é</span>
        <div class="chips" role="group" aria-label="Pessoa">${K.PESSOAS.map(p => html`<button type="button" class="chip${st.pessoa === p ? ' on' : ''}" data-set="pessoa" data-v="${p}" aria-pressed="${st.pessoa === p ? 'true' : 'false'}">${pessoaTag(p)}</button>`)}</div></div>

      <div class="grid2">
        <div class="field"><label class="label" for="f-cat">Categoria</label>
          <select id="f-cat" name="categoria"><option value="">Sem categoria</option>${cats.map(c => html`<option value="${c}" ${st.categoria === c ? 'selected' : ''}>${c}</option>`)}${st.categoria && !cats.includes(st.categoria) ? html`<option value="${st.categoria}" selected>${st.categoria}</option>` : ''}</select></div>
        ${unico && st.tipo === 'saida' ? html`<div class="field"><label class="label" for="f-forma">Forma de pagamento</label>
          <select id="f-forma" name="forma">${K.FORMAS.map(f => html`<option value="${f}" ${st.forma === f ? 'selected' : ''}>${f}</option>`)}</select></div>` : ''}
      </div>
      ${unico && st.tipo === 'saida' && st.forma === 'Crédito' ? html`<p class="hint">${(() => { const fv = faturaVenc(st.banco, st.pessoa, st.data); return fv ? html`Entra na fatura do ${st.banco} que <b>vence em ${dateLabel(fv)}</b> e diminui o limite do cartão até ser paga.` : html`Não há cartão do ${st.banco} cadastrado para ${st.pessoa}. Cadastre em Finanças › Cartões (com vencimento e fechamento) para a compra entrar na fatura certa.`; })()}</p>` : ''}
      <div class="field"><label class="label" for="f-obs">Observação (opcional)</label>
        <textarea id="f-obs" name="obs" rows="2" maxlength="300">${st.obs}</textarea></div>

      ${err ? html`<p class="form-error" role="alert">${err}</p>` : ''}
      <div class="modal-actions">
        ${edit ? html`<button type="button" class="btn danger-ghost" data-del>${icon('trash', 16)}Excluir</button>` : ''}
        <button type="submit" class="btn primary push-right">${edit ? 'Salvar alterações' : 'Salvar'}</button>
      </div>
    </form>`;
  }

  /* ---------- duplicados: mesmo nome e mesmo valor ---------- */
  const chaveNome = d => U.norm(d).replace(/\s*\(parcela[^)]*\)/g, '').replace(/[^a-z0-9]/g, '');
  const mesmoValor = (a, b) => Math.abs(+a - +b) < 0.011;   // parcelas diferem 1 centavo por arredondamento
  /* tudo que já existe com o mesmo nome e valor: [{tipo:'lanc'|'fixa'|'parcelado', ref}] */
  function similares(descricao, valores) {
    const k = chaveNome(descricao); if (!k) return [];
    const vs = (Array.isArray(valores) ? valores : [valores]).filter(v => v > 0);
    const bate = (nome, v) => chaveNome(nome) === k && vs.some(x => mesmoValor(x, v));
    const out = [];
    DB.all('lancamentos').filter(x => bate(x.descricao, x.valor)).sort((a, b) => String(b.data).localeCompare(String(a.data))).forEach(ref => out.push({ tipo: 'lanc', ref }));
    DB.all('fixas').filter(x => bate(x.descricao, x.valor)).forEach(ref => out.push({ tipo: 'fixa', ref }));
    DB.all('parcelados').filter(x => chaveNome(x.descricao) === k && vs.some(v => mesmoValor(v, x.valor_total) || mesmoValor(v, parcelaValor(x, 1)))).forEach(ref => out.push({ tipo: 'parcelado', ref }));
    return out;
  }
  function achaDuplicado(descricao, valores) {
    const m = similares(descricao, valores)[0]; if (!m) return null;
    const r = m.ref;
    if (m.tipo === 'lanc') return { descricao: r.descricao, valor: +r.valor, onde: `lançado em ${dateLabel(r.data)}`, banco: r.banco };
    if (m.tipo === 'fixa') return { descricao: r.descricao, valor: +r.valor, onde: 'já existe como conta fixa', banco: r.banco };
    return { descricao: r.descricao, valor: +r.valor_total, onde: 'já existe como compra parcelada', banco: r.banco };
  }

  function categoriaDe(nome) {
    const k = chaveNome(nome); if (!k) return null;
    const todos = DB.all('lancamentos').slice().sort((a, b) => String(b.data).localeCompare(String(a.data))).concat(DB.all('fixas'), DB.all('parcelados'));
    const m = todos.find(x => x.categoria && chaveNome(x.descricao) === k);
    return m ? m.categoria : null;
  }

  function openEntry(opts = {}) {
    const edit = opts.edit || null;
    const me = DB.user.nome;
    const st = edit ? stFromRef(edit) : {
      tipo: opts.tipo || 'saida', freq: opts.freq || 'unico', descricao: '', valor: '', parcelas: '12', data: defaultData(), fim: '', pago: true, pagoTocado: false,
      banco: lsGet('np:ultimoBanco') || K.BANCOS[0], pessoa: K.PESSOAS.includes(me) ? me : K.PESSOAS[0], categoria: '', forma: 'Pix', obs: '',
    };
    let err = '';
    const sugestoes = [...new Set(DB.all('lancamentos').concat(DB.all('fixas'), DB.all('parcelados')).map(x => x.descricao))].slice(-50);
    const titulo = !edit ? 'Novo lançamento' : edit.origem === 'fixa' ? 'Editar lançamento fixo' : edit.origem === 'parcela' ? 'Editar compra parcelada' : 'Editar lançamento';

    openModal({
      title: titulo, body: entryForm(st, edit, err, sugestoes), focus: !edit,
      onMount(api) {
        const redraw = () => {
          const y = api.body.scrollTop;
          api.body.innerHTML = String(entryForm(st, edit, err, sugestoes));
          api.body.scrollTop = y;
        };
        api.body.addEventListener('click', e => {
          const b = e.target.closest('[data-set]');
          if (b) {
            const campo = b.dataset.set; st[campo] = b.dataset.v;
            if (campo === 'tipo') { st.categoria = ''; if (st.tipo === 'entrada' && st.freq === 'parcelado') st.freq = 'unico'; }
            if (campo === 'banco') lsSet('np:ultimoBanco', st.banco);
            err = ''; redraw(); return;
          }
          if (e.target.closest('[data-del]')) excluir();
        });
        api.body.addEventListener('input', e => {
          const n = e.target.name; if (!n) return;
          if (n === 'pago') { st.pago = e.target.checked; st.pagoTocado = true; return; }
          st[n] = e.target.value;
          if (n === 'valor' || n === 'parcelas' || n === 'data') { const p = api.body.querySelector('#f-preview'); if (p) p.textContent = previewParcelas(st); }
        });
        api.body.addEventListener('change', e => { const n = e.target.name; if (!n || n === 'pago') return; st[n] = e.target.value; if ((n === 'data' && !st.pagoTocado && st.freq === 'unico') || n === 'forma') redraw(); });
        api.body.addEventListener('submit', async e => {
          e.preventDefault();
          if (!edit && st.descricao.trim()) {
            const v = parseMoney(st.valor), n = parseInt(st.parcelas, 10);
            const dup = achaDuplicado(st.descricao, st.freq === 'parcelado' && n >= 2 ? [v, v / n] : [v]);
            if (dup) {
              const ok = await confirmDialog({
                title: 'Parece que já foi lançado', confirmLabel: 'Lançar mesmo assim',
                message: `"${dup.descricao}" de ${fmt(dup.valor)}, ${dup.onde}${dup.banco ? ' (' + dup.banco + ')' : ''}. Mesmo nome e mesmo valor. Quer lançar de novo?`,
              });
              if (!ok) return;
            }
          }
          err = salvar(st, edit);
          if (err) { redraw(); return; }
          if (st.freq === 'unico') S.mes = monthKey(st.data);
          lsSet('np:ultimoBanco', st.banco);
          toast(edit ? 'Alterações salvas' : 'Lançamento salvo');
          api.close(); refresh();
        });
        async function excluir() {
          const o = edit.origem;
          const ok = await confirmDialog({
            title: 'Excluir?', danger: true, confirmLabel: 'Excluir',
            message: o === 'fixa' ? 'Esta conta fixa some de todos os meses, inclusive dos passados.' : o === 'parcela' ? 'Todas as parcelas desta compra somem dos meses.' : 'Este lançamento será excluído.',
          });
          if (!ok) return;
          DB.apagar(o === 'fixa' ? 'fixas' : o === 'parcela' ? 'parcelados' : 'lancamentos', edit.ref.id, o === 'fixa' ? 'Conta fixa excluída' : o === 'parcela' ? 'Compra parcelada excluída' : 'Lançamento excluído');
          api.close(); refresh();
        }
      },
    });
  }

  function salvar(st, edit) {
    const valor = parseMoney(st.valor), n = parseInt(st.parcelas, 10);
    if (!st.descricao.trim()) return 'Dê um nome para o lançamento.';
    if (!(valor > 0)) return 'Informe um valor maior que zero.';
    if (!st.data) return 'Informe a data.';
    if (st.freq === 'parcelado' && !(n >= 2 && n <= 120)) return 'Parcelas: informe um número entre 2 e 120.';
    if (st.freq === 'fixo' && st.fim && st.fim < st.data) return 'A data final precisa ser depois do primeiro vencimento.';
    const me = DB.user.nome;
    const comum = { descricao: st.descricao.trim(), categoria: st.categoria || null, banco: st.banco, pessoa: st.pessoa, obs: st.obs.trim() || null };
    if (st.freq === 'unico') {
      const row = Object.assign({ tipo: st.tipo, valor, data: st.data, forma: st.tipo === 'saida' ? st.forma : null }, comum);
      const pago = st.pagoTocado ? st.pago : pagoPadrao(st);
      if (!pago || (edit && edit.ref.pago === false)) row.pago = pago;
      const fv = st.tipo === 'saida' && st.forma === 'Crédito' ? faturaVenc(st.banco, st.pessoa, st.data) : null;
      if (fv) row.fatura = fv; else if (edit && edit.ref.fatura) row.fatura = null;     // coluna "fatura" só é gravada quando há cartão   // só grava quando foge do padrão (coluna "pago" vem do schema.sql novo)
      if (edit) DB.update('lancamentos', edit.ref.id, row); else DB.insert('lancamentos', Object.assign(row, { criado_por: me }));
    } else if (st.freq === 'fixo') {
      const row = Object.assign({ tipo: st.tipo, valor, inicio: st.data, fim: st.fim || null }, comum);
      if (edit) DB.update('fixas', edit.ref.id, row); else DB.insert('fixas', row);
    } else {
      const row = Object.assign({ valor_total: valor, parcelas: n, primeira: st.data }, comum);
      if (edit) DB.update('parcelados', edit.ref.id, row); else DB.insert('parcelados', row);
    }
    return '';
  }

  /* ---------- modal: detalhe de compra parcelada ---------- */
  function openParcelado(id) {
    const vista = () => {
      const p = DB.find('parcelados', id); if (!p) return html`<p>Compra não encontrada.</p>`;
      const n = +p.parcelas, pagas = parcelasPagasSet(p);
      let rest = 0; for (let k = 1; k <= n; k++) if (!pagas.has(k)) rest += parcelaValor(p, k);
      return html`
        <div class="detail-top">
          <div class="row-meta">${bancoTag(p.banco)}${pessoaTag(p.pessoa)}${p.categoria ? html`<span class="meta-text">${p.categoria}</span>` : ''}</div>
          <dl class="detail-stats">
            <div><dt>Total</dt><dd>${fmt(p.valor_total)}</dd></div>
            <div><dt>Pagas</dt><dd>${pagas.size} de ${n}</dd></div>
            <div><dt>Falta pagar</dt><dd>${fmt(rest)}</dd></div>
          </dl>
          <div class="bar-track"><span style="width:${Math.round(pagas.size / n * 100)}%"></span></div>
        </div>
        <ul class="rows compact">
          ${Array.from({ length: n }, (_, i) => i + 1).map(k => html`<li class="row${pagas.has(k) ? ' done' : ''}">
            <button type="button" class="check${pagas.has(k) ? ' on' : ''}" data-n="${k}" aria-pressed="${pagas.has(k) ? 'true' : 'false'}" aria-label="Parcela ${k}: ${pagas.has(k) ? 'marcar como pendente' : 'marcar como paga'}">${icon('check', 14)}</button>
            <div class="row-body static"><span class="row-title">Parcela ${k} de ${n}</span><span class="row-meta"><span class="meta-text">${monthShort(parcelaMes(p, k))}, dia ${+p.primeira.slice(8, 10)}</span></span></div>
            <div class="row-amount saida"><strong>${fmt(parcelaValor(p, k))}</strong></div>
          </li>`)}
        </ul>
        <div class="modal-actions"><button type="button" class="btn ghost" data-edit>Editar compra</button></div>`;
    };
    openModal({
      title: (DB.find('parcelados', id) || {}).descricao || 'Compra parcelada', body: vista(), wide: true,
      onMount(api) {
        api.body.addEventListener('click', e => {
          const c = e.target.closest('[data-n]');
          if (c) {
            const k = +c.dataset.n, ex = DB.all('parcelas_pagas').find(x => x.parcelado_id === id && x.numero === k);
            if (ex) DB.remove('parcelas_pagas', ex.id); else DB.insert('parcelas_pagas', { parcelado_id: id, numero: k });
            api.body.innerHTML = String(vista()); refresh(); return;
          }
          if (e.target.closest('[data-edit]')) { const p = DB.find('parcelados', id); api.close(); if (p) openEntry({ edit: { origem: 'parcela', ref: p } }); }
        });
      },
    });
  }

  /* ---------- modais: cofres ---------- */
  function openCofreForm() {
    const me = DB.user.nome;
    const st = { nome: '', meta: '', inicial: '', banco: lsGet('np:ultimoBanco') || K.BANCOS[0], pessoa: 'Casal' };
    let err = '';
    const form = () => html`<form class="form" novalidate>
      <div class="field"><label class="label" for="c-nome">Nome do cofre</label><input id="c-nome" name="nome" value="${st.nome}" maxlength="60" placeholder="Ex.: Reserva de emergência" autocomplete="off"></div>
      <div class="grid2">
        <div class="field"><label class="label" for="c-meta">Meta (opcional)</label><input id="c-meta" name="meta" value="${st.meta}" data-num="money" maxlength="13" inputmode="decimal" placeholder="0,00" autocomplete="off"></div>
        <div class="field"><label class="label" for="c-ini">Já tem guardado?</label><input id="c-ini" name="inicial" value="${st.inicial}" data-num="money" maxlength="13" inputmode="decimal" placeholder="0,00" autocomplete="off"></div>
      </div>
      <div class="field"><span class="label">Banco</span><div class="chips" role="group" aria-label="Banco">${K.BANCOS.map(b => html`<button type="button" class="chip${st.banco === b ? ' on' : ''}" data-set="banco" data-v="${b}" aria-pressed="${st.banco === b ? 'true' : 'false'}">${bancoTag(b)}</button>`)}</div></div>
      <div class="field"><span class="label">De quem é</span><div class="chips" role="group" aria-label="Pessoa">${K.PESSOAS.map(p => html`<button type="button" class="chip${st.pessoa === p ? ' on' : ''}" data-set="pessoa" data-v="${p}" aria-pressed="${st.pessoa === p ? 'true' : 'false'}">${pessoaTag(p)}</button>`)}</div></div>
      ${err ? html`<p class="form-error" role="alert">${err}</p>` : ''}
      <div class="modal-actions"><button type="submit" class="btn primary push-right">Criar cofre</button></div>
    </form>`;
    openModal({
      title: 'Novo cofre', body: form(), focus: true,
      onMount(api) {
        const redraw = () => { api.body.innerHTML = String(form()); };
        api.body.addEventListener('click', e => { const b = e.target.closest('[data-set]'); if (b) { st[b.dataset.set] = b.dataset.v; err = ''; redraw(); } });
        api.body.addEventListener('input', e => { if (e.target.name) st[e.target.name] = e.target.value; });
        api.body.addEventListener('submit', e => {
          e.preventDefault();
          if (!st.nome.trim()) { err = 'Dê um nome ao cofre.'; redraw(); return; }
          const c = { nome: st.nome.trim(), meta: parseMoney(st.meta) || null, banco: st.banco, pessoa: st.pessoa };
          DB.insert('cofres', c).then(row => {
            const ini = parseMoney(st.inicial);
            if (ini > 0) DB.insert('cofre_movs', { cofre_id: row.id, valor: ini, data: today(), nota: 'Saldo inicial', criado_por: me });
          });
          toast('Cofre criado'); api.close(); refresh();
        });
      },
    });
  }

  function openMov(cofreId, sinal) {
    const c = DB.find('cofres', cofreId); if (!c) return;
    const st = { valor: '', data: today(), nota: '' };
    let err = '';
    const guardar = sinal > 0;
    const form = () => html`<form class="form" novalidate>
      <div class="grid2">
        <div class="field"><label class="label" for="m-valor">Valor</label><input id="m-valor" name="valor" value="${st.valor}" data-num="money" maxlength="13" inputmode="decimal" placeholder="0,00" autocomplete="off"></div>
        <div class="field"><label class="label" for="m-data">Data</label><input id="m-data" name="data" type="date" value="${st.data}"></div>
      </div>
      <div class="field"><label class="label" for="m-nota">Anotação (opcional)</label><input id="m-nota" name="nota" value="${st.nota}" maxlength="80" autocomplete="off" placeholder="${guardar ? 'Ex.: Sobra do mês' : 'Ex.: Conserto do carro'}"></div>
      ${err ? html`<p class="form-error" role="alert">${err}</p>` : ''}
      <div class="modal-actions"><button type="submit" class="btn primary push-right">${guardar ? 'Guardar' : 'Retirar'}</button></div>
    </form>`;
    openModal({
      title: `${guardar ? 'Guardar em' : 'Retirar de'} ${c.nome}`, body: form(), small: true, focus: true,
      onMount(api) {
        api.body.addEventListener('input', e => { if (e.target.name) st[e.target.name] = e.target.value; });
        api.body.addEventListener('submit', e => {
          e.preventDefault();
          const v = parseMoney(st.valor);
          if (!(v > 0)) { err = 'Informe um valor maior que zero.'; api.body.innerHTML = String(form()); return; }
          if (!st.data) { err = 'Informe a data.'; api.body.innerHTML = String(form()); return; }
          DB.insert('cofre_movs', { cofre_id: cofreId, valor: guardar ? v : -v, data: st.data, nota: st.nota.trim() || null, criado_por: DB.user.nome });
          toast(guardar ? 'Valor guardado' : 'Retirada registrada'); api.close(); refresh();
        });
      },
    });
  }

  function openCofre(id) {
    const vista = () => {
      const c = DB.find('cofres', id); if (!c) return html`<p>Cofre não encontrado.</p>`;
      const movs = DB.all('cofre_movs').filter(m => m.cofre_id === id).sort((a, b) => b.data.localeCompare(a.data) || String(b.criado_em || '').localeCompare(String(a.criado_em || '')));
      const s = saldoCofre(c), meta = +c.meta || 0;
      return html`
        <div class="detail-top">
          <div class="row-meta">${bancoTag(c.banco)}${pessoaTag(c.pessoa)}</div>
          <dl class="detail-stats">
            <div><dt>Guardado</dt><dd>${fmt(s)}</dd></div>
            ${meta ? html`<div><dt>Meta</dt><dd>${fmt(meta)}</dd></div><div><dt>Falta</dt><dd>${fmt(Math.max(0, meta - s))}</dd></div>` : ''}
          </dl>
          ${meta ? html`<div class="bar-track"><span style="width:${Math.max(0, Math.min(100, s / meta * 100)).toFixed(1)}%"></span></div>` : ''}
          <div class="mini-actions left">
            <button type="button" class="btn primary small" data-sinal="1">${icon('plus', 14)}Guardar</button>
            <button type="button" class="btn ghost small" data-sinal="-1">${icon('minus', 14)}Retirar</button>
          </div>
        </div>
        ${movs.length ? html`<ul class="rows compact">${movs.map(m => html`<li class="row">
          <span class="check static ${+m.valor >= 0 ? 'entrada' : 'saida'}" aria-hidden="true">${icon(+m.valor >= 0 ? 'up' : 'down', 14)}</span>
          <div class="row-body static"><span class="row-title">${m.nota || (+m.valor >= 0 ? 'Guardou' : 'Retirou')}</span><span class="row-meta"><span class="meta-text">${dateLabel(m.data)}</span>${m.criado_por ? pessoaTag(m.criado_por) : ''}</span></div>
          <div class="row-amount ${+m.valor >= 0 ? 'entrada' : 'saida'}"><strong>${+m.valor >= 0 ? '+' : '−'} ${fmt(Math.abs(m.valor))}</strong></div>
          <button type="button" class="icon-btn" data-delmov="${m.id}" aria-label="Excluir movimentação">${icon('trash', 16)}</button>
        </li>`)}</ul>` : html`<div class="empty small"><p>Nenhuma movimentação ainda.</p></div>`}
        <div class="modal-actions"><button type="button" class="btn danger-ghost" data-delcofre>${icon('trash', 16)}Excluir cofre</button></div>`;
    };
    const c0 = DB.find('cofres', id);
    openModal({
      title: c0 ? c0.nome : 'Cofre', body: vista(), wide: true,
      onMount(api) {
        api.body.addEventListener('click', async e => {
          const s = e.target.closest('[data-sinal]');
          if (s) { api.close(); openMov(id, +s.dataset.sinal); return; }
          const d = e.target.closest('[data-delmov]');
          if (d) { DB.apagar('cofre_movs', d.dataset.delmov, 'Movimentação apagada'); api.body.innerHTML = String(vista()); refresh(); return; }
          if (e.target.closest('[data-delcofre]')) {
            const ok = await confirmDialog({ title: 'Excluir cofre?', message: 'O cofre e todo o histórico dele serão apagados.', confirmLabel: 'Excluir', danger: true });
            if (ok) { DB.apagar('cofres', id, 'Cofre excluído'); api.close(); refresh(); }
          }
        });
      },
    });
  }

  global.Financas = { itensFatura, faturasDoMes, caixaInfo, cicloTexto, faturaVenc, ehCredito, doisCards, parcelaValor, mes: () => S.mes, registrar: its => { ITENS = new Map(its.map(i => [i.key, i])); }, refresh: () => refresh(), splitHtml, achaDuplicado, similares, categoriaDe, cardProjecao, listaBarras, serie, chartMeses, chaveNome, mostrarMes: mk => { S.mes = mk; refresh(); }, render, heroHtml, resumo, itensDoMes, proximos, openEntry, rowItem, togglePago, openItem, saldoCofre };
})(window);
