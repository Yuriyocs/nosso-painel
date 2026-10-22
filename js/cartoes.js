/* Cartões: visual de cartão com bandeira, fatura do mês, limite e bancos personalizados. */
(function (global) {
  'use strict';
  const U = global.UI, DB = global.DB;
  const { html, icon, fmt, parseMoney, moneyInput, today, monthKey, addMonthsKey, monthLabel, monthShort, dateInMonth, diffDays, K, bancoTag, pessoaTag, openModal, confirmDialog, toast, on } = U;
  const F = () => global.Financas;

  const aberto = new Set(); // cartões com a lista de lançamentos aberta

  const cartoes = () => DB.all('cartoes').slice().sort((a, b) => (a.pessoa && a.pessoa !== 'Casal' ? 0 : 1) - (b.pessoa && b.pessoa !== 'Casal' ? 0 : 1) || a.banco.localeCompare(b.banco) || String(a.final || '').localeCompare(String(b.final || '')));
  const noCredito = i => i.origem === 'parcela' || i.forma === 'Crédito';
  function pertence(c, i) { return noCredito(i) && (i.banco || 'Outro') === c.banco && (!c.pessoa || c.pessoa === 'Casal' || i.pessoa === c.pessoa || i.pessoa === 'Casal'); }
  function atribuir(lista, itens) {
    const out = new Map(lista.map(c => [c.id, []]));
    itens.forEach(i => { const c = lista.find(x => pertence(x, i)); if (c) out.get(c.id).push(i); });
    return out;
  }
  const totalFatura = its => its.reduce((a, i) => a + (i.tipo === 'entrada' ? -i.valor : i.valor), 0);

  function faturaDe(c, mk, its) {
    const total = totalFatura(its), abertos = its.filter(i => !i.pago);
    const venc = c.vencimento ? dateInMonth(mk, +c.vencimento) : null;
    const paga = its.length > 0 && !abertos.length;
    let status = 'vazia', texto = 'Sem lançamentos';
    if (its.length) {
      if (paga) { status = 'paga'; texto = 'Fatura paga'; }
      else if (venc) {
        const d = diffDays(venc, today());
        if (d < 0) { status = 'atrasada'; texto = 'Venceu há ' + (-d) + (d === -1 ? ' dia' : ' dias'); }
        else if (d === 0) { status = 'hoje'; texto = 'Vence hoje'; }
        else if (d <= 7) { status = 'proxima'; texto = 'Vence em ' + d + (d === 1 ? ' dia' : ' dias'); }
        else { status = 'aberta'; texto = 'Vence dia ' + String(c.vencimento).padStart(2, '0'); }
      } else { status = 'aberta'; texto = 'Em aberto'; }
    }
    return { total, venc, paga, status, texto, abertos };
  }

  /* quanto do limite está comprometido: compras no crédito ainda não pagas + parcelas que faltam */
  function usoLimite(c) {
    let uso = 0;
    DB.all('lancamentos').forEach(l => { if (l.tipo === 'saida' && l.forma === 'Crédito' && l.pago === false && pertence(c, { origem: 'lanc', forma: 'Crédito', banco: l.banco, pessoa: l.pessoa })) uso += +l.valor; });
    const pagas = new Set(DB.all('parcelas_pagas').map(x => x.parcelado_id + '|' + x.numero));
    DB.all('parcelados').forEach(p => {
      if (!pertence(c, { origem: 'parcela', banco: p.banco, pessoa: p.pessoa })) return;
      for (let k = 1; k <= +p.parcelas; k++) if (!pagas.has(p.id + '|' + k)) uso += global.Financas.parcelaValor(p, k);
    });
    return uso;
  }

  function luminosa(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return false;
    const n = parseInt(m[1], 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    return (0.299 * r + 0.587 * g + 0.114 * b) > 170;
  }
  const rotuloBandeira = b => b === 'American Express' ? 'AMEX' : b === 'Mastercard' ? 'Mastercard' : b ? b.toUpperCase() : '';

  function visual(c) {
    const cor = c.cor || K.BANCO_COR[c.banco] || '#7B8794';
    return html`<div class="cc${luminosa(cor) ? ' clara' : ''}" style="--cc:${cor}" role="img" aria-label="Cartão ${c.banco}${c.bandeira ? ' ' + c.bandeira : ''}${c.final ? ' final ' + c.final : ''}">
      <div class="cc-top"><span class="cc-bank">${c.banco}</span>${c.bandeira ? html`<span class="cc-brand">${rotuloBandeira(c.bandeira)}</span>` : ''}</div>
      <span class="cc-chip" aria-hidden="true"></span>
      <div class="cc-num">•••• •••• •••• ${c.final || '••••'}</div>
      <div class="cc-bot"><span class="cc-name">${c.apelido || (c.pessoa && c.pessoa !== 'Casal' ? c.pessoa : K.NOMES.join(' & '))}</span>${c.vencimento ? html`<span class="cc-venc">vence dia ${String(c.vencimento).padStart(2, '0')}</span>` : ''}</div>
    </div>`;
  }

  function caixa(c, mk, its) {
    const f = faturaDe(c, mk, its), uso = c.limite > 0 ? usoLimite(c) : 0, lim = +c.limite || 0, pctUso = lim ? Math.min(100, uso / lim * 100) : 0;
    const prox = [1, 2, 3].map(n => { const m = addMonthsKey(mk, n); return [m, totalFatura(F().itensDoMes(m).filter(i => pertence(c, i)))]; }).filter(([, v]) => v > 0);
    return html`<article class="cartao-box">
      <button type="button" class="cc-btn" data-act="fin:cartao-edit" data-id="${c.id}" aria-label="Editar cartão ${c.banco}">${visual(c)}</button>
      <div class="fat-card">
        <div class="fat-head"><div><span class="muted">Fatura que vence em ${monthLabel(mk).split(' de ')[0]}</span><strong class="fat-total">${fmt(f.total)}</strong></div>
          <span class="status ${f.status}">${f.texto}</span></div>
        ${lim ? html`<div class="lim"><div class="lim-line"><span>Limite usado ${fmt(uso)}</span><span class="muted">de ${fmt(lim)}</span></div>
          <div class="obar ${pctUso >= 90 ? 'over' : pctUso >= 70 ? 'warn' : 'ok'}"><span style="width:${pctUso.toFixed(1)}%"></span></div>
          <span class="muted small-t">Disponível: ${fmt(Math.max(0, lim - uso))}</span></div>` : ''}
        ${prox.length ? html`<p class="card-note prox">Próximas faturas: ${prox.map(([m, v]) => html`<b>${monthShort(m).split('/')[0]}</b> ${fmt(v)}`).map((x, i) => i ? html` · ${x}` : x)}</p>` : ''}
        <div class="fat-actions">
          ${its.length ? html`<button type="button" class="btn ghost small" data-act="fin:cartao-ver" data-id="${c.id}" aria-expanded="${aberto.has(c.id) ? 'true' : 'false'}">${aberto.has(c.id) ? 'Esconder' : 'Ver'} lançamentos (${its.length})</button>
          <button type="button" class="btn ${f.paga ? 'ghost' : 'primary'} small" data-act="fin:cartao-paga" data-id="${c.id}">${icon('check', 16)}${f.paga ? 'Reabrir fatura' : 'Marcar como paga'}</button>` : ''}
        </div>
        ${aberto.has(c.id) && its.length ? html`<ul class="rows compact fat-list">${its.slice().sort((a, b) => a.data.localeCompare(b.data)).map(i => F().rowItem(i))}</ul>` : ''}
      </div>
    </article>`;
  }

  function view() {
    const mk = F().mes(), atual = mk === monthKey(today());
    const lista = cartoes(), todos = F().itensDoMes(mk);
    F().registrar(todos);
    const por = atribuir(lista, todos);
    const faturas = lista.map(c => ({ c, its: por.get(c.id), f: faturaDe(c, mk, por.get(c.id)) }));
    const totalMes = faturas.reduce((a, x) => a + x.f.total, 0);
    const aPagar = faturas.reduce((a, x) => a + (x.f.paga ? 0 : x.f.total), 0);
    const semCartao = [...new Set(todos.filter(noCredito).filter(i => i.tipo === 'saida' && !lista.some(c => pertence(c, i))).map(i => i.banco || 'Outro'))];
    const meses = [0, 1, 2, 3, 4, 5].map(n => { const m = addMonthsKey(mk, n), its = n ? F().itensDoMes(m) : todos; return [m, lista.reduce((a, c) => a + totalFatura(its.filter(i => pertence(c, i))), 0)]; });
    const maxM = Math.max(1, ...meses.map(([, v]) => v));

    return html`
      <div class="monthbar">
        <button type="button" class="icon-btn" data-act="fin:prev" aria-label="Mês anterior">${icon('chevL')}</button>
        <h2 class="monthname" aria-live="polite">${monthLabel(mk)}</h2>
        <button type="button" class="icon-btn" data-act="fin:next" aria-label="Próximo mês">${icon('chevR')}</button>
        ${!atual ? html`<button type="button" class="btn ghost small" data-act="fin:hoje">Mês atual</button>` : ''}
        <button type="button" class="btn ghost small push-right" data-act="fin:fatura">${icon('upload', 16)}Importar fatura</button>
        <button type="button" class="btn ghost small" data-act="fin:bancos">${icon('wallet', 16)}Bancos</button>
        <button type="button" class="btn primary small" data-act="fin:cartao-novo">${icon('plus', 16)}Novo cartão</button>
      </div>

      ${lista.length ? html`<div class="cols"><div class="col-main">
        <div class="cartoes-grid">${faturas.map(x => caixa(x.c, mk, x.its))}</div>
        ${semCartao.length ? html`<p class="card-note sem-cartao">Há compras no crédito em ${semCartao.join(', ')} sem um cartão cadastrado. <button type="button" class="link-btn" data-act="fin:cartao-novo" data-banco="${semCartao[0]}">Cadastrar agora</button></p>` : ''}
      </div>
      <aside class="side" aria-label="Resumo das faturas">
        <section class="card">
          <div class="card-head"><h3>Faturas de ${monthLabel(mk).split(' de ')[0]}</h3></div>
          <p class="side-big">${fmt(totalMes)}</p>
          <p class="card-note" style="margin-top:0">${aPagar > 0 ? html`Ainda falta pagar <b>${fmt(aPagar)}</b>.` : totalMes > 0 ? 'Todas as faturas do mês estão pagas.' : 'Nenhuma fatura neste mês.'}</p>
          <ul class="top-list">${faturas.map(x => html`<li><span class="top-name">${bancoTag(x.c.banco)}${x.c.final ? html` <small>final ${x.c.final}</small>` : ''}</span><strong>${fmt(x.f.total)}</strong></li>`)}</ul>
        </section>
        <section class="card">
          <div class="card-head"><h3>Faturas dos próximos meses</h3></div>
          <ul class="bars out">${meses.map(([m, v]) => html`<li><div class="bar-line"><span class="bar-name">${monthLabel(m).split(' de ')[0].replace(/^./, ch => ch.toUpperCase())}${m === mk ? ' (selecionado)' : ''}</span><span class="bar-val">${fmt(v)}</span></div>
            <div class="bar-track"><span style="width:${(Math.max(0, v) / maxM * 100).toFixed(1)}%"></span></div></li>`)}</ul>
          <p class="card-note">Soma o que já está lançado no crédito, incluindo as parcelas dos meses seguintes.</p>
        </section>
      </aside></div>`
      : html`<div class="empty"><h3>Cadastre seus cartões</h3>
          <p>Cada cartão mostra a fatura do mês, o limite usado e quando vence. As compras no crédito de cada banco entram sozinhas.</p>
          <div class="empty-actions"><button type="button" class="btn primary" data-act="fin:cartao-novo">Cadastrar cartão</button>
          ${semCartao.map(b => html`<button type="button" class="btn ghost" data-act="fin:cartao-novo" data-banco="${b}">${bancoTag(b)}</button>`)}</div></div>`}
`;
  }

  /* ---------- cartão: cadastro ---------- */
  const PALETA = ['#8A05BE', '#EC7000', '#CC092F', '#E0525B', '#0B6EFD', '#00875A', '#111827', '#F2B705', '#D6318F', '#5F7A6E'];

  function formCartao(c, bancoInicial) {
    const edit = !!c, st = c || { banco: bancoInicial || K.BANCOS[0], bandeira: '', final: '', apelido: '', vencimento: '', limite: '', pessoa: K.PESSOAS[0] };
    const opcoes = K.BANCOS.filter(b => b !== 'Dinheiro');
    openModal({
      title: edit ? 'Editar cartão' : 'Novo cartão', focus: !edit,
      body: html`<form class="form" novalidate>
        <div class="cc-preview" id="cc-prev"></div>
        <div class="field"><label class="label" for="cc-banco">Banco</label>
          <select id="cc-banco" name="banco">${opcoes.map(b => html`<option value="${b}" ${st.banco === b ? 'selected' : ''}>${b}</option>`)}<option value="__novo">＋ Outro banco...</option></select></div>
        <div class="field novo-banco" hidden>
          <label class="label" for="cc-nb">Nome do banco</label><input id="cc-nb" name="nb" maxlength="30" placeholder="Ex.: Inter, C6, Mercado Pago" autocomplete="off">
          <span class="label" style="margin-top:10px">Cor</span>
          <div class="swatches" role="group" aria-label="Cor do banco">${PALETA.map((p, i) => html`<button type="button" class="sw${i === 0 ? ' on' : ''}" data-cor="${p}" style="background:${p}" aria-label="Cor ${i + 1}" aria-pressed="${i === 0 ? 'true' : 'false'}"></button>`)}<input type="color" name="corlivre" value="#8A05BE" aria-label="Outra cor"></div>
        </div>
        <div class="field"><label class="label" for="cc-band">Bandeira</label>
          <select id="cc-band" name="bandeira"><option value="">Não informar</option>${K.BANDEIRAS.map(b => html`<option value="${b}" ${st.bandeira === b ? 'selected' : ''}>${b}</option>`)}</select></div>
        <div class="grid-2">
          <div class="field"><label class="label" for="cc-final">Final do cartão</label><input id="cc-final" name="final" data-num="int" inputmode="numeric" maxlength="4" placeholder="1234" value="${st.final || ''}" autocomplete="off"></div>
          <div class="field"><label class="label" for="cc-venc">Dia do vencimento</label><input id="cc-venc" name="vencimento" data-num="int" inputmode="numeric" maxlength="2" placeholder="Ex.: 10" value="${st.vencimento || ''}" autocomplete="off"></div>
        </div>
        <div class="field"><label class="label" for="cc-fech">Dia do fechamento (opcional)</label><input id="cc-fech" name="fechamento" data-num="int" inputmode="numeric" maxlength="2" placeholder="Ex.: 24" value="${st.fechamento || ''}" autocomplete="off">
          <p class="hint">É o último dia que a compra entra na fatura atual (está no app do banco). Compras depois dele vão para a fatura seguinte. Sem informar, o painel assume 7 dias antes do vencimento.</p></div>
        <div class="grid-2">
          <div class="field"><label class="label" for="cc-lim">Limite (opcional)</label><input id="cc-lim" name="limite" data-num="money" maxlength="13" inputmode="decimal" placeholder="0,00" value="${st.limite ? moneyInput(st.limite) : ''}" autocomplete="off"></div>
          <div class="field"><label class="label" for="cc-pes">De quem</label><select id="cc-pes" name="pessoa">${K.PESSOAS.map(p => html`<option value="${p}" ${st.pessoa === p ? 'selected' : ''}>${p}</option>`)}</select></div>
        </div>
        <div class="field"><label class="label" for="cc-ap">Apelido (opcional)</label><input id="cc-ap" name="apelido" maxlength="30" placeholder="Ex.: Cartão da casa" value="${st.apelido || ''}" autocomplete="off"></div>
        <p class="hint">As compras no crédito desse banco (da pessoa escolhida) entram automaticamente na fatura do cartão.</p>
        <p class="form-error" role="alert" hidden></p>
        <div class="modal-actions">${edit ? html`<button type="button" class="btn danger-ghost" data-cc-del>Excluir cartão</button>` : ''}<button type="submit" class="btn primary">Salvar</button></div>
      </form>`,
      onMount(api) {
        const f = api.el.querySelector('form'), prev = api.el.querySelector('#cc-prev'), nb = api.el.querySelector('.novo-banco');
        let corNova = PALETA[0];
        const atual = () => {
          const novo = f.banco.value === '__novo';
          prev.innerHTML = String(visual({ banco: novo ? (f.nb.value.trim() || 'Novo banco') : f.banco.value, cor: novo ? corNova : null, bandeira: f.bandeira.value, final: f.final.value.replace(/\D/g, '').slice(0, 4), apelido: f.apelido.value.trim(), vencimento: f.vencimento.value.replace(/\D/g, ''), pessoa: f.pessoa.value }));
          nb.hidden = !novo;
        };
        f.addEventListener('input', atual); f.addEventListener('change', atual); atual();
        api.el.addEventListener('click', async e => {
          const sw = e.target.closest('.sw');
          if (sw) { corNova = sw.dataset.cor; f.querySelectorAll('.sw').forEach(x => { x.classList.toggle('on', x === sw); x.setAttribute('aria-pressed', x === sw ? 'true' : 'false'); }); atual(); return; }
          if (e.target.closest('[data-cc-del]')) {
            const ok = await confirmDialog({ title: 'Excluir este cartão?', message: 'Os lançamentos continuam onde estão; só o cartão e a visão da fatura saem.', confirmLabel: 'Excluir', danger: true });
            if (ok) { await DB.apagar('cartoes', c.id, 'Cartão excluído'); api.close(); }
          }
        });
        f.corlivre.addEventListener('input', () => { corNova = f.corlivre.value; f.querySelectorAll('.sw').forEach(x => { x.classList.remove('on'); x.setAttribute('aria-pressed', 'false'); }); atual(); });
        f.addEventListener('submit', async e => {
          e.preventDefault();
          const err = f.querySelector('.form-error'), falha = t => { err.hidden = false; err.textContent = t; };
          let banco = f.banco.value;
          if (banco === '__novo') {
            banco = f.nb.value.trim();
            if (!banco) return falha('Digite o nome do banco.');
            if (K.BANCOS.some(b => b.toLowerCase() === banco.toLowerCase())) return falha('Esse banco já existe. Escolha ele na lista.');
          }
          const venc = f.vencimento.value.replace(/\D/g, '');
          if (venc && (+venc < 1 || +venc > 31)) return falha('O dia do vencimento vai de 1 a 31.');
          const fech = f.fechamento.value.replace(/\D/g, '');
          if (fech && (+fech < 1 || +fech > 31)) return falha('O dia do fechamento vai de 1 a 31.');
          const final = f.final.value.replace(/\D/g, '');
          if (final && final.length !== 4) return falha('O final do cartão tem 4 números.');
          const lim = f.limite.value.trim() ? parseMoney(f.limite.value) : 0;
          if (f.limite.value.trim() && !(lim > 0)) return falha('Confira o valor do limite.');
          if (f.banco.value === '__novo') await DB.insert('bancos', { nome: banco, cor: corNova });
          const row = { banco, bandeira: f.bandeira.value || null, final: final || null, apelido: f.apelido.value.trim() || null, vencimento: venc ? +venc : null, limite: lim || null, pessoa: f.pessoa.value };
          if (fech) row.fechamento = +fech; else if (edit && c.fechamento) row.fechamento = null;     // coluna só é gravada quando usada
          if (edit) await DB.update('cartoes', c.id, row); else await DB.insert('cartoes', row);
          api.close(); toast(edit ? 'Cartão atualizado' : 'Cartão cadastrado');
        });
      },
    });
  }

  /* ---------- bancos ---------- */
  function usos(nome) {
    return ['lancamentos', 'fixas', 'parcelados', 'cofres', 'cartoes'].reduce((a, t) => a + DB.all(t).filter(x => x.banco === nome).length, 0);
  }
  function gerenciarBancos() {
    const corpo = () => html`<ul class="banco-list">${K.BANCOS.filter(b => b !== 'Dinheiro' && b !== 'Outro').map(b => {
      const custom = !K.BANCOS_BASE.includes(b), n = usos(b);
      return html`<li><span class="bk-dot" style="background:${K.BANCO_COR[b] || '#7B8794'}"></span><span class="bk-nome">${b}${custom ? '' : html` <small>padrão</small>`}</span>
        <label class="bk-cor"><span class="sr-only">Cor de ${b}</span><input type="color" value="${K.BANCO_COR[b] || '#7B8794'}" data-bk-cor="${b}"></label>
        ${custom ? html`<button type="button" class="icon-btn" data-bk-del="${b}" aria-label="Excluir ${b}">${icon('trash', 18)}</button>` : html`<span class="bk-sp"></span>`}</li>`;
    })}</ul>
    <form class="form bk-novo" data-bk-form novalidate>
      <span class="label">Adicionar banco</span>
      <div class="input-row"><input name="nome" maxlength="30" placeholder="Nome do banco" aria-label="Nome do banco" autocomplete="off"><input type="color" name="cor" value="#0B6EFD" aria-label="Cor do banco"><button type="submit" class="btn primary">Adicionar</button></div>
      <p class="form-error" role="alert" hidden></p>
    </form>`;
    openModal({
      title: 'Bancos', small: true, body: corpo(),
      onMount(api) {
        const redo = () => { api.body.innerHTML = String(corpo()); };
        api.body.addEventListener('change', async e => {
          const i = e.target.closest('[data-bk-cor]'); if (!i) return;
          const nome = i.dataset.bkCor, ex = DB.all('bancos').find(b => b.nome === nome);
          if (ex) await DB.update('bancos', ex.id, { cor: i.value }); else await DB.insert('bancos', { nome, cor: i.value });
          redo();
        });
        api.body.addEventListener('click', async e => {
          const d = e.target.closest('[data-bk-del]'); if (!d) return;
          const nome = d.dataset.bkDel, n = usos(nome);
          if (n > 0) { toast(`${nome} ainda tem ${n} registro${n > 1 ? 's' : ''} ligado${n > 1 ? 's' : ''}. Troque o banco deles antes de excluir.`, 'erro'); return; }
          const ex = DB.all('bancos').find(b => b.nome === nome); if (ex) { await DB.apagar('bancos', ex.id, 'Banco excluído'); redo(); }
        });
        api.body.addEventListener('submit', async e => {
          const f = e.target.closest('[data-bk-form]'); if (!f) return;
          e.preventDefault();
          const nome = f.nome.value.trim(), err = f.querySelector('.form-error');
          if (!nome) { err.hidden = false; err.textContent = 'Digite o nome do banco.'; return; }
          if (K.BANCOS.some(b => b.toLowerCase() === nome.toLowerCase())) { err.hidden = false; err.textContent = 'Esse banco já existe.'; return; }
          await DB.insert('bancos', { nome, cor: f.cor.value }); redo(); toast('Banco adicionado');
        });
      },
    });
  }

  /* ---------- ações ---------- */
  on('fin:cartao-novo', el => formCartao(null, el && el.dataset && el.dataset.banco));
  on('fin:cartao-edit', el => { const c = DB.find('cartoes', el.dataset.id); if (c) formCartao(c); });
  on('fin:bancos', () => gerenciarBancos());
  on('fin:cartao-ver', el => { const id = el.dataset.id; if (aberto.has(id)) aberto.delete(id); else aberto.add(id); F().refresh(); });
  on('fin:cartao-paga', el => {
    const c = DB.find('cartoes', el.dataset.id); if (!c) return;
    const mk = F().mes(), todos = F().itensDoMes(mk), lista = cartoes();
    const its = atribuir(lista, todos).get(c.id) || [];
    const abertos = its.filter(i => !i.pago), reabrir = !abertos.length;
    const alvo = reabrir ? its.filter(i => i.pago) : abertos;
    DB.lote(() => alvo.forEach(i => F().togglePago(i)), 'financas', `${reabrir ? 'reabriu' : 'marcou como paga'} a fatura ${c.banco}${c.final ? ' final ' + c.final : ''} de ${monthLabel(mk)}`);
    toast(reabrir ? 'Fatura reaberta' : 'Fatura marcada como paga', '', { label: 'Desfazer', fn: () => DB.lote(() => alvo.forEach(i => { const atual = F().itensDoMes(mk).find(x => x.key === i.key); if (atual && atual.pago !== i.pago) F().togglePago(atual); }), 'financas', `desfez a fatura ${c.banco}`) });
  });

  global.Cartoes = { view, cartoes, pertence };
})(window);
