/* Importar fatura de cartão (PDF do Bradesco, Itaú e Nubank, ou CSV do Nubank).
   O arquivo é lido no próprio navegador: nada é enviado a lugar nenhum. */
(function (global) {
  'use strict';
  const U = global.UI, DB = global.DB;
  const { html, icon, fmt, K, openModal, closeAllModals, toast, on, lsGet, lsSet, dateLabel, monthKey, addMonthsDate, uid } = U;

  /* ---------- leitura do arquivo ---------- */
  let pdfPronto = null;
  function carregarPdfJs() {
    if (global.pdfjsLib) return Promise.resolve(global.pdfjsLib);
    if (pdfPronto) return pdfPronto;
    pdfPronto = new Promise((ok, falha) => {
      const sc = document.createElement('script');
      sc.src = 'js/vendor/pdf.min.js';
      sc.onload = () => { global.pdfjsLib.GlobalWorkerOptions.workerSrc = 'js/vendor/pdf.worker.min.js'; ok(global.pdfjsLib); };
      sc.onerror = () => { pdfPronto = null; falha(new Error('Não consegui carregar o leitor de PDF.')); };
      document.head.appendChild(sc);
    });
    return pdfPronto;
  }
  async function lerArquivo(arquivo) {
    if (/\.csv$/i.test(arquivo.name) || /csv|text\/plain/.test(arquivo.type)) return global.FaturaParser.parseCsv(await arquivo.text(), arquivo.name);
    const lib = await carregarPdfJs();
    const doc = await lib.getDocument({ data: new Uint8Array(await arquivo.arrayBuffer()) }).promise;
    const pages = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const tc = await (await doc.getPage(n)).getTextContent();
      pages.push(tc.items.map(i => ({ str: i.str, x: i.transform[4], y: i.transform[5] })));
    }
    return global.FaturaParser.parsePdf(pages);
  }

  /* ---------- categoria sugerida pelo nome ---------- */
  const REGRAS = [
    [/uber|99 ?ride|99ride|\*99|taxi|jetshr|jet patinetes|urentcar/, 'Transporte'],
    [/supermerc|atacad|carrefour|assai|hortifruti|padaria|acougue|\bsuper\b|mercad|padar/, 'Mercado'],
    [/\bifd\b|ifood|restaur|lanch|pizza|burger|cafe|cacau|doce/, 'Alimentação'],
    [/petlove|\bpet|racao/, 'Pets'],
    [/farm|drog|clinic|hospital|saude|wellhub|gympass|academia|laser/, 'Saúde'],
    [/udemy|curso|escola|faculdade|alura|duolingo/, 'Educação'],
    [/google|netflix|spotify|prime|disney|hbo|youtube|apple|icloud|kindle|membership/, 'Assinaturas'],
    [/\bvivo\b|claro|\btim\b|energia|enel|cesan|escelsa|internet|\bedp\b|cpfl|sabesp/, 'Contas (luz, água, internet)'],
    [/gol linhas|latam|azul|booking|hotel|airbnb/, 'Viagem'],
    [/shopee|shpp|amazo|mercadolivre|amazon|magalu|aliexpress|shein|americanas|eletro|wepink/, 'Compras'],
    [/\biof\b|juros|anuidade|tarifa|seguro/, 'Cartão de crédito'],
  ];
  const sugerirCategoria = desc => { const n = U.norm(desc), r = REGRAS.find(([re]) => re.test(n)); return r ? r[1] : 'Outros'; };

  /* ---------- estado ---------- */
  const rotuloRow = r => r.desc + (r.parcela ? ` (parcela ${r.parcela.p}/${r.parcela.n})` : '');
  const dataRow = (r, st) => (st.dataModo === 'compra' && r.dataCompra) ? r.dataCompra : st.venc;
  const viraParcelado = (r, st) => !r.credito && r.parcela && st.futuras;
  const futuras = r => r.parcela ? r.parcela.n - r.parcela.p : 0;

  function montar(fat, st) {
    return fat.itens.map((it, i) => ({
      i, sel: true, desc: it.desc, valor: it.valor, credito: it.credito, parcela: it.parcela, dm: it.dm,
      dataCompra: it.data, fixa: !!it.dataFixa, pagamento: !!it.credito && /\b(pagto|pgto|pagamento|pag\.)/i.test(it.desc),
      categoria: it.credito ? '' : (global.Financas.categoriaDe(it.desc) || sugerirCategoria(it.desc)), pessoa: st.pessoa, tocado: false, dup: null,
    }));
  }

  /* igual (já lançado: não lança) ou parecido (outro mês: só avisa) */
  function classificar(r, st) {
    if (r.credito) return null;
    const mk = monthKey(dataRow(r, st));
    const ms = global.Financas.similares(r.desc, r.valor);
    let soft = null;
    for (const m of ms) {
      const x = m.ref;
      if (m.tipo === 'parcelado') {
        if (r.parcela) return { nivel: 'igual', texto: 'já existe como compra parcelada' };
        soft = soft || { nivel: 'parecido', texto: 'parecido com uma compra parcelada' };
      } else if (m.tipo === 'fixa') {
        const ativa = mk >= monthKey(x.inicio) && (!x.fim || mk <= monthKey(x.fim));
        if (ativa) return { nivel: 'igual', texto: 'já existe como conta fixa' };
        soft = soft || { nivel: 'parecido', texto: 'parecido com uma conta fixa' };
      } else if (monthKey(x.data) === mk || x.data === r.dataCompra) {
        return { nivel: 'igual', texto: `já lançado em ${dateLabel(x.data)}` };
      } else soft = soft || { nivel: 'parecido', texto: `parecido: lançado em ${dateLabel(x.data)}` };
    }
    return soft;
  }
  function marcarDuplicados(st) {
    st.rows.forEach(r => {
      r.dup = classificar(r, st);
      r.sel = r.pagamento ? false : (r.tocado ? r.sel : !r.credito && !(r.dup && r.dup.nivel === 'igual'));
    });
  }

  /* ---------- telas ---------- */
  function telaEscolher(erro, lendo) {
    return html`<div class="fat-pick">
      <p class="hint">Escolha a <b>fatura do cartão</b> (PDF do Bradesco, Itaú ou Nubank, ou o CSV do Nubank) ou o <b>extrato da conta</b> (PDF do Itaú ou do Santander); o painel reconhece sozinho qual é. O painel lê tudo aqui no seu aparelho (nada é enviado a lugar nenhum), mostra os lançamentos para você conferir e só lança o que você marcar.</p>
      <label class="dropzone${lendo ? ' busy' : ''}" for="fat-file">
        ${icon('upload', 28)}
        <strong>${lendo ? 'Lendo a fatura...' : 'Toque para escolher o arquivo'}</strong>
        <span>${lendo ? 'Só um instante' : 'PDF ou CSV, ou arraste para cá'}</span>
        <input id="fat-file" type="file" accept="application/pdf,.pdf,.csv,text/csv" ${lendo ? 'disabled' : ''}>
      </label>
      ${erro ? html`<p class="form-error" role="alert">${erro}</p>` : ''}
    </div>`;
  }

  function telaRevisao(st) {
    const { fat, rows } = st;
    const compras = rows.filter(r => !r.credito);
    const sel = rows.filter(r => r.sel);
    const totalSai = sel.filter(r => !r.credito).reduce((a, r) => a + r.valor, 0);
    const totalEnt = sel.filter(r => r.credito).reduce((a, r) => a + r.valor, 0);
    const somaFat = compras.reduce((a, r) => a + r.valor, 0);
    const confere = fat.total != null && Math.abs(somaFat - fat.total) < 0.005;
    const nIgual = rows.filter(r => r.dup && r.dup.nivel === 'igual').length;
    const nParec = rows.filter(r => r.dup && r.dup.nivel === 'parecido').length;
    const comFut = sel.filter(r => viraParcelado(r, st) && futuras(r) > 0);
    const totFut = comFut.reduce((a, r) => a + r.valor * futuras(r), 0);
    const nFut = comFut.reduce((a, r) => a + futuras(r), 0);
    const nParcelados = rows.filter(r => !r.credito && r.parcela).length;
    const multiMes = !st.venc || new Set(sel.filter(r => !viraParcelado(r, st)).map(r => monthKey(dataRow(r, st)))).size > 1;

    return html`
      <div class="fat-resumo">
        <div class="fat-resumo-top">
          <strong>Fatura ${st.banco}</strong>
          <span>${fat.cartao ? `cartão final ${fat.cartao}` : ''}</span>
        </div>
        <div class="fat-resumo-val">${fmt(somaFat)}</div>
        <p class="fat-check ${fat.total == null ? '' : confere ? 'ok' : 'warn'}">${
          fat.total == null ? `${compras.length} compras lidas`
            : confere ? html`${icon('check', 14)} ${compras.length} compras lidas. A soma bate com o total da fatura (${fmt(fat.total)}).`
              : `A soma lida (${fmt(somaFat)}) é diferente do total da fatura (${fmt(fat.total)}). Confira se não ficou nada de fora.`}</p>
      </div>

      <div class="grid2">
        <div class="field"><label class="label" for="fat-venc">Vencimento da fatura</label>
          <input id="fat-venc" type="date" data-g="venc" value="${st.venc || ''}" required></div>
        <div class="field"><label class="label" for="fat-banco">Banco</label>
          <select id="fat-banco" data-g="banco">${K.BANCOS.map(b => html`<option value="${b}" ${st.banco === b ? 'selected' : ''}>${b}</option>`)}</select></div>
      </div>
      <div class="field"><span class="label">De quem é esta fatura</span>
        <div class="chips" role="group" aria-label="Pessoa">${K.PESSOAS.map(p => html`<button type="button" class="chip${st.pessoa === p ? ' on' : ''}" data-g="pessoa" data-v="${p}" aria-pressed="${st.pessoa === p}">${p}</button>`)}</div></div>
      ${st.fat.aberta ? html`<p class="hint">Esta é uma <b>fatura em aberto</b> (ainda pode mudar até fechar). ${st.vencEstimado ? 'O vencimento foi calculado pelo cartão cadastrado: confira.' : 'Informe o vencimento da fatura.'} Quando a fatura fechar, importe a versão final: o que já foi lançado vem marcado e não duplica.</p>` : ''}
      <p class="hint">Cada compra entra no <b>mês em que foi feita</b> (é o gasto daquele mês). A fatura vence em <b>${st.venc ? dateLabel(st.venc) : 'o vencimento'}</b>: é quando o dinheiro sai da conta, e o painel já concilia isso sozinho.</p>

      ${nParcelados ? html`<label class="fat-toggle"><input type="checkbox" data-g="futuras" ${st.futuras ? 'checked' : ''}>
        <span><b>Criar as parcelas dos próximos meses</b><br><small>${st.futuras
          ? (nFut ? `${nParcelados} compras parceladas. Entram ${nFut} parcelas futuras (${fmt(totFut)}) nos meses seguintes, já contando como "falta pagar".` : `${nParcelados} compras parceladas, nenhuma com parcela restante.`)
          : 'Desligado: cada parcela entra só como um lançamento deste mês.'}</small></span></label>` : ''}

      ${nIgual ? html`<p class="fat-dup-note">${icon('flag', 16)}<span><b>${nIgual}</b> ${nIgual === 1 ? 'item já está lançado' : 'itens já estão lançados'} (mesmo nome e valor) e ${nIgual === 1 ? 'veio desmarcado' : 'vieram desmarcados'}. Marque só se for outra compra.</span></p>` : ''}
      ${nParec ? html`<p class="hint">${nParec} ${nParec === 1 ? 'item parece' : 'itens parecem'} com algo de outro mês (assinaturas, por exemplo). ${nParec === 1 ? 'Ficou marcado' : 'Ficaram marcados'}, pois é outra data.</p>` : ''}

      <div class="fat-bar">
        <button type="button" class="btn ghost small" data-all="1">Marcar todos</button>
        <button type="button" class="btn ghost small" data-all="0">Desmarcar todos</button>
        <span class="fat-count">${sel.length} de ${rows.length}</span>
      </div>

      <ul class="fat-list">${rows.map(r => html`<li class="fat-row${r.sel ? '' : ' off'}${r.dup && r.dup.nivel === 'igual' ? ' dup' : ''}">
        <label class="fat-check-wrap"><input type="checkbox" data-i="${r.i}" data-f="sel" ${r.sel ? 'checked' : ''} ${r.pagamento ? 'disabled' : ''} aria-label="Lançar ${r.desc}"></label>
        <div class="fat-main">
          <input class="fat-desc" data-i="${r.i}" data-f="desc" value="${r.desc}" maxlength="80" aria-label="Nome">
          <div class="fat-meta">
            <span>${r.dm}</span>
            ${r.parcela ? html`<span class="badge">parcela ${r.parcela.p}/${r.parcela.n}${viraParcelado(r, st) && futuras(r) ? ` · +${futuras(r)} futuras` : ''}</span>` : ''}
            ${r.pagamento ? html`<span class="badge warn">pagamento da fatura anterior</span>` : r.credito ? html`<span class="badge in">crédito / estorno</span>` : ''}
            ${r.pagamento ? html`<span class="fat-aviso">Não entra nos cálculos: o pagamento já aparece como a saída da fatura anterior.</span>` : ''}
            ${r.dup ? html`<span class="badge ${r.dup.nivel === 'igual' ? 'warn' : ''}">${r.dup.texto}</span>` : ''}
          </div>
          ${!r.credito ? html`<div class="fat-sel">
            <select data-i="${r.i}" data-f="categoria" aria-label="Categoria">${K.CAT_SAIDA.map(c => html`<option value="${c}" ${r.categoria === c ? 'selected' : ''}>${c}</option>`)}</select>
            <select data-i="${r.i}" data-f="pessoa" aria-label="Pessoa">${K.PESSOAS.map(p => html`<option value="${p}" ${r.pessoa === p ? 'selected' : ''}>${p}</option>`)}</select>
          </div>` : ''}
        </div>
        <div class="fat-val ${r.credito ? 'entrada' : 'saida'}">${r.credito ? '+' : '−'}${fmt(r.valor)}</div>
      </li>`)}</ul>

      ${multiMes && st.venc ? html`<p class="hint">Atenção: os lançamentos vão se espalhar por mais de um mês.</p>` : ''}
      ${!st.venc ? html`<p class="form-error" role="alert">Informe o vencimento da fatura para poder lançar.</p>` : ''}
      <div class="modal-actions fat-actions">
        <button type="button" class="btn ghost" data-troca>Outro arquivo</button>
        <button type="button" class="btn primary push-right" data-ok ${sel.length && st.venc ? '' : 'disabled'}>Lançar ${sel.length} ${sel.length === 1 ? 'item' : 'itens'}${totalSai ? ` · ${fmt(totalSai)}` : ''}</button>
      </div>
      ${totalEnt ? html`<p class="hint">Créditos marcados entram como <b>entrada</b> (${fmt(totalEnt)}).</p>` : ''}`;
  }

  /* data (dentro do mês das compras da fatura) usada nas parcelas: cai no mês do ciclo, não no do vencimento */
  function dataCiclo(st) {
    const cs = DB.all('cartoes').filter(c => c.banco === st.banco && c.vencimento);
    const c = cs.find(x => x.pessoa === st.pessoa) || cs[0] || null;
    const fech = st.fat && st.fat.fecha ? +st.fat.fecha.slice(8, 10) : (c && +c.fechamento) || 0;
    if (!fech || !st.venc) return st.venc;
    const mk = +st.venc.slice(8, 10) <= fech ? U.addMonthsKey(monthKey(st.venc), -1) : monthKey(st.venc);
    return U.dateInMonth(mk, fech);
  }

  /* ---------- abrir ---------- */
  function abrir() {
    closeAllModals();
    const me = DB.user && DB.user.nome;
    const st = { fat: null, rows: [], banco: 'Bradesco', venc: '', dataModo: 'compra', futuras: lsGet('np:fatura:futuras') !== '0', pessoa: K.PESSOAS.includes(me) ? me : K.PESSOAS[0] };
    openModal({
      title: 'Importar fatura ou extrato', wide: true, body: telaEscolher(),
      onMount(api) {
        const desenhar = () => { const y = api.body.scrollTop; api.body.innerHTML = String(telaRevisao(st)); api.body.scrollTop = y; };
        const escolher = (erro, lendo) => { api.body.innerHTML = String(telaEscolher(erro, lendo)); };

        async function receber(arquivo) {
          if (!arquivo) return;
          if (!/\.(pdf|csv)$/i.test(arquivo.name) && !/pdf|csv/.test(arquivo.type)) { escolher('Esse arquivo não é um PDF nem um CSV.'); return; }
          escolher('', true);
          try {
            const fat = await lerArquivo(arquivo);
            if (!fat.itens.length) { escolher('Não encontrei lançamentos nesse arquivo. Hoje eu leio faturas de cartão (Bradesco, Itaú e Nubank) e extratos de conta (Itaú e Santander). Se for de outro banco, me mande um exemplo que eu adapto.'); return; }
            if (fat.tipo === 'extrato') { global.Extrato.revisar(fat, api, () => escolher()); return; }
            st.fat = fat; st.banco = fat.banco || st.banco; st.venc = fat.venc || '';
            const t = U.norm(fat.titular || ''), nome = K.NOMES.find(n => t.includes(U.norm(n)));
            if (nome) st.pessoa = nome;
            if (!st.venc && fat.aberta) { st.venc = global.Financas.faturaVenc(st.banco, st.pessoa, U.today()) || ''; st.vencEstimado = !!st.venc; }
            if (st.venc) fat.itens.forEach(it => { if (!it.dataFixa && it.dm) it.data = global.FaturaParser.ano(it.dm, st.venc); });
            st.rows = montar(fat, st);
            marcarDuplicados(st); desenhar();
          } catch (e) {
            console.error(e); escolher('Não consegui ler esse arquivo. Se o PDF tem senha, abra, salve sem senha e tente de novo.');
          }
        }

        api.body.addEventListener('change', e => {
          const t = e.target;
          if (t.id === 'fat-file') { receber(t.files[0]); return; }
          if (t.dataset.g === 'banco') { st.banco = t.value; desenhar(); return; }
          if (t.dataset.g === 'venc') {
            st.venc = t.value;
            st.rows.forEach(r => { if (!r.fixa && r.dm && st.venc) r.dataCompra = global.FaturaParser.ano(r.dm, st.venc); });
            marcarDuplicados(st); desenhar(); return;
          }
          if (t.dataset.g === 'futuras') { st.futuras = t.checked; lsSet('np:fatura:futuras', st.futuras ? '1' : '0'); marcarDuplicados(st); desenhar(); return; }
          if (t.dataset.i != null) {
            const r = st.rows[+t.dataset.i], f = t.dataset.f;
            if (f === 'sel') { r.sel = t.checked; r.tocado = true; desenhar(); return; }
            if (f === 'desc') {
              r.desc = t.value.trim() || r.desc;
              r.dup = classificar(r, st);
              const li = t.closest('.fat-row');       // só esta linha, para não perder o clique no botão
              li.classList.toggle('dup', !!r.dup && r.dup.nivel === 'igual');
              li.querySelector('.fat-meta .badge.dupx')?.remove();
              if (r.dup) li.querySelector('.fat-meta').insertAdjacentHTML('beforeend', String(html`<span class="badge dupx ${r.dup.nivel === 'igual' ? 'warn' : ''}">${r.dup.texto}</span>`));
              return;
            }
            r[f] = t.value;
          }
        });
        api.body.addEventListener('click', e => {
          const g = e.target.closest('[data-g]');
          if (g && g.dataset.v) {
            st[g.dataset.g] = g.dataset.v;
            if (g.dataset.g === 'dataModo') { lsSet('np:fatura:data', st.dataModo); marcarDuplicados(st); }
            if (g.dataset.g === 'pessoa') st.rows.forEach(r => { r.pessoa = st.pessoa; });
            desenhar(); return;
          }
          const all = e.target.closest('[data-all]');
          if (all) { st.rows.forEach(r => { r.sel = !r.pagamento && all.dataset.all === '1'; r.tocado = true; }); desenhar(); return; }
          if (e.target.closest('[data-troca]')) { escolher(); return; }
          if (e.target.closest('[data-ok]')) lancar(st, api);
        });
        api.body.addEventListener('dragover', e => { if (e.target.closest('.dropzone')) { e.preventDefault(); e.target.closest('.dropzone').classList.add('over'); } });
        api.body.addEventListener('dragleave', e => { const d = e.target.closest('.dropzone'); if (d) d.classList.remove('over'); });
        api.body.addEventListener('drop', e => { if (e.target.closest('.dropzone')) { e.preventDefault(); receber(e.dataTransfer.files[0]); } });
      },
    });
  }

  async function lancar(st, api) {
    const sel = st.rows.filter(r => r.sel);
    if (!sel.length || !st.venc) return;
    const me = DB.user.nome;
    const obsBase = `Fatura ${st.banco}${st.fat.cartao ? ' final ' + st.fat.cartao : ''}, venc. ${dateLabel(st.venc)}`;
    let nLanc = 0, nParc = 0, nFut = 0, primeira = null;
    const promessas = [], pagas = [];
    sel.forEach(r => {
      if (viraParcelado(r, st) && r.parcela.n >= 2) {
        /* compra parcelada: cria todas as parcelas (as já pagas ficam marcadas, as futuras ficam a pagar) */
        const id = uid(), { p, n } = r.parcela;
        promessas.push(DB.insert('parcelados', {
          id, descricao: r.desc, valor_total: Math.round(r.valor * n * 100) / 100, parcelas: n, primeira: addMonthsDate(dataCiclo(st), -(p - 1)),
          categoria: r.categoria || null, banco: st.banco, pessoa: r.pessoa, obs: `${obsBase}. Importada na parcela ${p}/${n}.`,
        }, { silent: true }));
        for (let k = 1; k <= p; k++) pagas.push({ parcelado_id: id, numero: k });
        nParc++; nFut += n - p;
        return;
      }
      const data = dataRow(r, st);
      if (!primeira || data < primeira) primeira = data;
      promessas.push(DB.insert('lancamentos', Object.assign(st.venc > U.today() ? { pago: false } : {}, data !== st.venc ? { fatura: st.venc } : {}, {      // fatura que ainda não venceu fica "a pagar"
        tipo: r.credito ? 'entrada' : 'saida', descricao: rotuloRow(r), valor: r.valor, data,
        forma: 'Crédito', categoria: r.credito ? null : (r.categoria || null), banco: st.banco, pessoa: r.pessoa,
        obs: obsBase + (st.dataModo === 'venc' && r.dm ? `, compra em ${r.dm}` : ''), criado_por: me,
      }), { silent: true }));
      nLanc++;
    });
    api.body.querySelector('[data-ok]').disabled = true;
    await Promise.all(promessas);                         // as parcelas pagas dependem da compra já existir
    pagas.forEach(x => DB.insert('parcelas_pagas', x, { silent: true }));
    lsSet('np:ultimoBanco', st.banco);
    /* cartão: guarda o dia de fechamento lido do PDF; se o cartão ainda não existe, cadastra (vencimento e fechamento vêm da fatura) */
    {
      const cs = DB.all('cartoes').filter(c => c.banco === st.banco);
      const c = cs.find(x => x.pessoa === st.pessoa) || cs.find(x => !x.pessoa || x.pessoa === 'Casal') || null;
      const fechDia = st.fat && st.fat.fecha ? +st.fat.fecha.slice(8, 10) : null;
      if (c) {
        const patch = {};
        if (!c.vencimento && st.venc) patch.vencimento = +st.venc.slice(8, 10);
        if (!c.fechamento && fechDia) patch.fechamento = fechDia;
        if (Object.keys(patch).length) DB.update('cartoes', c.id, patch, { silent: true });
      } else if (st.venc && !cs.length) {
        DB.insert('cartoes', Object.assign({ banco: st.banco, final: (st.fat && st.fat.cartao) || null, vencimento: +st.venc.slice(8, 10), pessoa: st.pessoa }, fechDia ? { fechamento: fechDia } : {}), { silent: true });
        toast(`Cartão ${st.banco} cadastrado a partir da fatura (confira em Cartões)`);
      }
    }
    api.close(); closeAllModals();
    global.Financas.mostrarMes(monthKey(st.venc));
    const partes = [];
    if (nLanc) partes.push(`${nLanc} ${nLanc === 1 ? 'lançamento' : 'lançamentos'}`);
    if (nParc) partes.push(`${nParc} ${nParc === 1 ? 'compra parcelada' : 'compras parceladas'}${nFut ? ` (+${nFut} parcelas futuras)` : ''}`);
    toast('Adicionado: ' + partes.join(' e '));
    const totalSel = sel.reduce((a, r) => a + (r.credito ? -r.valor : r.valor), 0);
    DB.log('financas', `importou a fatura ${st.banco}${st.fat.cartao ? ' final ' + st.fat.cartao : ''}: ${partes.join(' e ')} (${fmt(totalSel)})`);
  }

  on('fin:fatura', abrir);
  global.Fatura = { abrir, sugerirCategoria };
})(window);
