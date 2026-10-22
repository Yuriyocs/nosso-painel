/* Importar extrato de conta (Itaú e Santander): entradas e saídas em débito, pix, boleto.
   Roda dentro da janela de "Importar fatura ou extrato": o leitor reconhece o tipo do arquivo e chama Extrato.revisar. */
(function (global) {
  'use strict';
  const U = global.UI, DB = global.DB;
  const { html, icon, fmt, K, toast, dateLabel, monthKey, addMonthsKey } = U;

  const INVEST = /cofrinho|aplicacao|resgate|rend pago|aplic aut|rendimento/;
  const FATURA = /fatura paga|pagamento de fatura|pgto fatura|pagto fatura|fatura cartao|pgto cartao/;

  /* "PIX QRS RD SAUDE21/10" -> "Pix · RD SAUDE" */
  function limpar(d) {
    let s = String(d).replace(/\s+/g, ' ').trim();
    s = s.replace(/([A-Za-z])\d{2}\/\d{2}$/, '$1').replace(/\s*\d{2}\/\d{2}$/, '').replace(/([A-Za-z])\d{4}$/, '$1');
    s = s.replace(/^PIX (QRS|TRANSF) /i, 'Pix · ').replace(/^(PAY|RSHOP) /i, 'Débito · ').replace(/^PAGTO /i, '');
    return s.trim() || String(d).trim();
  }
  const formaDe = (orig, desc) => /^pix/i.test(orig) || /^pix/i.test(desc) ? 'Pix' : /boleto/i.test(desc) ? 'Boleto' : /^(iof|juros|tarifa)/i.test(desc) ? 'Débito' : /^(pay|rshop)/i.test(orig) ? 'Débito' : 'Transferência';

  /* o que o painel faz com cada movimentação: lança (normal) ou deixa de fora por padrão */
  function tipoDe(r, st) {
    const n = U.norm(r.orig + ' ' + r.desc);
    if (INVEST.test(n)) return { kind: 'invest', texto: 'aplicação / resgate' };
    if (FATURA.test(n)) return { kind: 'fatura', texto: 'pagamento de fatura' };
    if (!r.credito) {
      const bancos = DB.all('cartoes').map(c => c.banco).filter(b => b && b !== st.banco);
      if (bancos.some(b => n.includes(U.norm(b))) || (/\b(pix|boleto)\b/.test(n) && /\b(bradesco|nubank|nu pagamentos|itau click|banco inter|c6 bank)\b/.test(n))) return { kind: 'fatura', texto: 'pagamento de fatura' };
      const F = global.Financas;
      for (const d of [0, -1, 1]) {
        const c = F.caixaInfo(addMonthsKey(monthKey(r.data), d));
        if (c.total > 0 && Math.abs(c.total - r.valor) < 0.011) return { kind: 'fatura', texto: 'pagamento de fatura' };
      }
    }
    if (K.NOMES.some(nm => n.includes(U.norm(nm)))) return { kind: 'interna', texto: 'transferência entre vocês' };
    return { kind: 'normal', texto: '' };
  }

  /* já lançado: mesma data, tipo e valor no mesmo banco (cada lançamento existente vale uma vez) */
  function marcarDuplicados(st) {
    const usados = new Map();
    DB.all('lancamentos').filter(l => l.banco === st.banco && l.forma !== 'Crédito').forEach(l => {
      const k = [l.data, l.tipo, (+l.valor).toFixed(2)].join('|'); usados.set(k, (usados.get(k) || 0) + 1);
    });
    st.rows.forEach(r => {
      const k = [r.data, r.credito ? 'entrada' : 'saida', r.valor.toFixed(2)].join('|'), n = usados.get(k) || 0;
      r.dup = n > 0; if (n > 0) usados.set(k, n - 1);
      if (!r.tocado) r.sel = r.kind === 'normal' && !r.dup;
    });
  }

  function categoriaExtrato(r) {
    const n = U.norm(r.desc), o = U.norm(r.orig);
    if (r.credito) return /salario|adiantamento|vale alimentacao|bonus/.test(n) ? 'Salário' : /rend/.test(n) ? 'Rendimentos' : /dev pix/.test(o) ? 'Reembolso' : '';
    if (/\biof\b|juros/.test(n)) return 'Outros';
    return global.Financas.categoriaDe(r.desc) || global.Fatura.sugerirCategoria(r.desc);
  }
  const dataCompleta = d => `${d.slice(8)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

  function montar(fat, st) {
    const rows = fat.itens.map((it, i) => {
      const desc = limpar(it.desc), r = { i, data: it.data, orig: it.desc, desc, valor: it.valor, credito: it.credito, forma: it.credito ? null : formaDe(it.desc, desc), tocado: false, sel: false, dup: false, pessoa: st.pessoa };
      Object.assign(r, tipoDe(r, st));
      r.categoria = categoriaExtrato(r);
      return r;
    });
    return rows;
  }

  function resumo(st) {
    const sel = st.rows.filter(r => r.sel);
    return {
      sel, ent: sel.filter(r => r.credito).reduce((a, r) => a + r.valor, 0), sai: sel.filter(r => !r.credito).reduce((a, r) => a + r.valor, 0),
      fora: st.rows.filter(r => r.kind !== 'normal').length, dup: st.rows.filter(r => r.dup).length,
    };
  }

  function tela(st) {
    const t = resumo(st), { fat } = st;
    const visiveis = st.rows.filter(r => st.vista === 'lancar' ? r.sel : st.vista === 'fora' ? (r.kind !== 'normal' || r.dup) : true);
    const per = fat.periodo ? `${dataCompleta(fat.periodo[0])} a ${dataCompleta(fat.periodo[1])}` : '';
    return html`
      <div class="fat-resumo">
        <div class="fat-resumo-top"><span>Extrato ${st.banco}</span><span>${per}</span></div>
        <div class="fat-resumo-val">${st.rows.length} movimentações</div>
        <p class="fat-check">${t.fora} ${t.fora === 1 ? 'é' : 'são'} aplicações, transferências entre vocês ou pagamentos de fatura (ficam de fora, para não contar duas vezes)${t.dup ? ` · ${t.dup} já ${t.dup === 1 ? 'lançada' : 'lançadas'}` : ''}.</p>
      </div>
      <div class="grid2">
        <div class="field"><label class="label" for="ext-banco">Banco</label>
          <select id="ext-banco" data-xg="banco">${K.BANCOS.map(b => html`<option value="${b}" ${st.banco === b ? 'selected' : ''}>${b}</option>`)}</select></div>
        <div class="field"><span class="label">De quem é esta conta</span>
          <div class="chips" role="group" aria-label="Pessoa">${K.PESSOAS.map(p => html`<button type="button" class="chip${st.pessoa === p ? ' on' : ''}" data-xg="pessoa" data-xv="${p}" aria-pressed="${st.pessoa === p}">${p}</button>`)}</div></div>
      </div>
      <div class="fat-bar">
        <div class="seg" role="group" aria-label="Mostrar">${[['tudo', 'Tudo'], ['lancar', 'Vão ser lançadas'], ['fora', 'Ficam de fora']].map(([v, n]) => html`<button type="button" class="seg-btn${st.vista === v ? ' on' : ''}" data-xg="vista" data-xv="${v}" aria-pressed="${st.vista === v}">${n}</button>`)}</div>
        <span class="fat-count">${t.sel.length} de ${st.rows.length}</span>
      </div>
      <div class="fat-bar">
        <button type="button" class="btn ghost small" data-xall="1">Marcar todas</button>
        <button type="button" class="btn ghost small" data-xall="0">Desmarcar todas</button>
      </div>
      <ul class="fat-list">${visiveis.map(r => html`<li class="fat-row${r.sel ? '' : ' off'}${r.dup ? ' dup' : ''}">
        <label class="fat-check-wrap"><input type="checkbox" data-xi="${r.i}" data-xf="sel" ${r.sel ? 'checked' : ''} aria-label="Lançar ${r.desc}"></label>
        <div class="fat-main">
          <input class="fat-desc" data-xi="${r.i}" data-xf="desc" value="${r.desc}" maxlength="80" aria-label="Nome">
          <div class="fat-meta">
            <span>${dateLabel(r.data)}</span>
            ${r.forma ? html`<span class="badge">${r.forma}</span>` : ''}
            ${r.texto ? html`<span class="badge warn">${r.texto}</span>` : ''}
            ${r.dup ? html`<span class="badge warn">já lançada</span>` : ''}
          </div>
          ${!r.credito ? html`<div class="fat-sel">
            <select data-xi="${r.i}" data-xf="categoria" aria-label="Categoria">${K.CAT_SAIDA.map(c => html`<option value="${c}" ${r.categoria === c ? 'selected' : ''}>${c}</option>`)}</select>
            <select data-xi="${r.i}" data-xf="pessoa" aria-label="Pessoa">${K.PESSOAS.map(p => html`<option value="${p}" ${r.pessoa === p ? 'selected' : ''}>${p}</option>`)}</select>
          </div>` : ''}
        </div>
        <div class="fat-val ${r.credito ? 'entrada' : 'saida'}">${r.credito ? '+' : '−'}${fmt(r.valor)}</div>
      </li>`)}</ul>
      ${visiveis.length ? '' : html`<p class="hint">Nada nesta visão.</p>`}
      <div class="modal-actions fat-actions">
        <button type="button" class="btn ghost" data-xtroca>Outro arquivo</button>
        <button type="button" class="btn primary push-right" data-xok ${t.sel.length ? '' : 'disabled'}>Lançar ${t.sel.length} ${t.sel.length === 1 ? 'item' : 'itens'}</button>
      </div>
      <p class="hint">Entradas marcadas: <b>${fmt(t.ent)}</b> · saídas marcadas: <b>${fmt(t.sai)}</b>. Pagamentos de fatura ficam de fora porque a fatura do cartão já entra pelo vencimento.</p>`;
  }

  function lancar(st, api) {
    const t = resumo(st), me = DB.user.nome;
    if (!t.sel.length) return;
    api.body.querySelector('[data-xok]').disabled = true;
    const obs = `Extrato ${st.banco}`;
    const ps = t.sel.map(r => DB.insert('lancamentos', {
      tipo: r.credito ? 'entrada' : 'saida', descricao: r.desc, valor: r.valor, data: r.data, forma: r.credito ? null : r.forma,
      categoria: r.categoria || null, banco: st.banco, pessoa: r.pessoa, obs, criado_por: me,
    }, { silent: true }));
    Promise.all(ps).then(() => {
      const ult = t.sel.map(r => r.data).sort().pop();
      api.close(); U.closeAllModals();
      global.Financas.mostrarMes(monthKey(ult));
      toast(`Adicionado: ${t.sel.length} ${t.sel.length === 1 ? 'lançamento' : 'lançamentos'} do extrato ${st.banco}`);
      DB.log('financas', `importou o extrato ${st.banco}: ${t.sel.length} lançamentos (entradas ${fmt(t.ent)}, saídas ${fmt(t.sai)})`);
    });
  }

  function revisar(fat, api, voltar) {
    const t = U.norm(fat.titular || ''), nome = K.NOMES.find(n => t.includes(U.norm(n)));
    const st = { fat, banco: fat.banco, pessoa: nome || (K.PESSOAS.includes(DB.user && DB.user.nome) ? DB.user.nome : K.PESSOAS[0]), rows: [], vista: 'tudo' };
    st.rows = montar(fat, st); marcarDuplicados(st);
    const desenhar = () => { const y = api.body.scrollTop; api.body.innerHTML = String(tela(st)); api.body.scrollTop = y; };
    const reclassificar = () => { st.rows.forEach(r => { Object.assign(r, { kind: 'normal', texto: '' }, tipoDe(r, st)); r.pessoa = st.pessoa; }); marcarDuplicados(st); };
    desenhar();
    const onChange = e => {
      const x = e.target;
      if (x.dataset.xg === 'banco') { st.banco = x.value; reclassificar(); desenhar(); return; }
      if (x.dataset.xi == null) return;
      const r = st.rows[+x.dataset.xi], f = x.dataset.xf;
      if (f === 'sel') { r.sel = x.checked; r.tocado = true; desenhar(); return; }
      if (f === 'desc') { r.desc = x.value.trim() || r.desc; return; }
      r[f] = x.value;
    };
    const onClick = e => {
      const g = e.target.closest('[data-xg]');
      if (g && g.dataset.xv) {
        st[g.dataset.xg] = g.dataset.xv;
        if (g.dataset.xg === 'pessoa') st.rows.forEach(r => { r.pessoa = st.pessoa; });
        desenhar(); return;
      }
      const all = e.target.closest('[data-xall]');
      if (all) { st.rows.forEach(r => { r.sel = all.dataset.xall === '1'; r.tocado = true; }); desenhar(); return; }
      if (e.target.closest('[data-xtroca]')) { api.body.removeEventListener('change', onChange); api.body.removeEventListener('click', onClick); voltar(); return; }
      if (e.target.closest('[data-xok]')) lancar(st, api);
    };
    api.body.addEventListener('change', onChange);
    api.body.addEventListener('click', onClick);
  }

  global.Extrato = { revisar };
})(window);
