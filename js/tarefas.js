/* Tarefas do dia a dia. */
(function (global) {
  'use strict';
  const U = global.UI, DB = global.DB;
  const { html, icon, today, addDays, addMonthsDate, ymd, dateLabel, K, pessoaTag, openModal, confirmDialog, toast, on, Forms, Inputs, lsGet, lsSet } = U;

  const S = { quem: lsGet('np:tar:quem') || 'todas', para: null, quando: 'hoje', data: '', conc: false, prio: 'normal', repete: 'nao', mais: false };
  const CUR = { root: null };
  const refresh = () => { if (CUR.root && U.route.nome === 'tarefas') render(CUR.root); };

  const PRIO = { alta: 0, normal: 1, baixa: 2 };
  const REPETE = { nao: 'Não repete', diaria: 'Todo dia', semanal: 'Toda semana', mensal: 'Todo mês' };

  function filtradas() {
    return DB.all('tarefas').filter(t => S.quem === 'todas' || t.responsavel === S.quem || t.responsavel === 'Ambos');
  }
  const byPrazo = (a, b) => (a.prazo || '').localeCompare(b.prazo || '') || PRIO[a.prioridade] - PRIO[b.prioridade] || String(a.criado_em || '').localeCompare(String(b.criado_em || ''));
  const byPrio = (a, b) => PRIO[a.prioridade] - PRIO[b.prioridade] || String(a.criado_em || '').localeCompare(String(b.criado_em || ''));
  const feitaHoje = t => t.feita && t.feita_em && ymd(new Date(t.feita_em)) === today();

  function secoes(lista) {
    const t0 = today(), abertas = lista.filter(t => !t.feita);
    return {
      atrasadas: abertas.filter(t => t.prazo && t.prazo < t0).sort(byPrazo),
      hoje: abertas.filter(t => t.prazo === t0).sort(byPrio),
      proximas: abertas.filter(t => t.prazo && t.prazo > t0).sort(byPrazo),
      sem: abertas.filter(t => !t.prazo).sort(byPrio),
      feitas: lista.filter(t => t.feita).sort((a, b) => String(b.feita_em || '').localeCompare(String(a.feita_em || ''))).slice(0, 15),
    };
  }

  function rowHtml(t) {
    const atrasada = !t.feita && t.prazo && t.prazo < today();
    return html`<li class="row${t.feita ? ' done' : ''}">
      <button type="button" class="check${t.feita ? ' on' : ''}" data-act="tar:toggle" data-id="${t.id}" aria-pressed="${t.feita ? 'true' : 'false'}" aria-label="${t.feita ? 'Reabrir tarefa' : 'Concluir tarefa'}">${icon('check', 14)}</button>
      <button type="button" class="row-body" data-act="tar:edit" data-id="${t.id}">
        <span class="row-title">${t.titulo}</span>
        <span class="row-meta">
          ${pessoaTag(t.responsavel)}
          ${t.prazo ? html`<span class="meta-text${atrasada ? ' late' : ''}">${atrasada ? 'venceu ' : ''}${dateLabel(t.prazo)}</span>` : ''}
          ${t.prioridade === 'alta' ? html`<span class="badge alert">${icon('flag', 12)}Alta</span>` : ''}
          ${t.repete && t.repete !== 'nao' ? html`<span class="badge">${icon('repeat', 12)}${REPETE[t.repete]}</span>` : ''}
        </span>
      </button>
    </li>`;
  }

  function bloco(titulo, lista, cls) {
    if (!lista.length) return '';
    return html`<section class="section ${cls || ''}"><div class="section-head"><h3>${titulo}</h3><span class="count">${lista.length}</span></div><ul class="rows">${lista.map(rowHtml)}</ul></section>`;
  }

  function render(root) {
    CUR.root = root;
    if (!S.para) S.para = K.RESPONSAVEIS.includes(DB.user.nome) ? DB.user.nome : K.RESPONSAVEIS[0];
    const qa = root.querySelector('#qa-input');
    const keep = qa ? { v: qa.value, f: document.activeElement === qa } : null;

    const lista = filtradas(), sc = secoes(lista);
    const abertasHoje = sc.atrasadas.length + sc.hoje.length;
    const feitasHoje = lista.filter(feitaHoje).length;
    const totalHoje = abertasHoje + feitasHoje;
    const vazio = !lista.length;

    root.innerHTML = String(html`<section class="page">
      <header class="page-head">
        <h1>Tarefas</h1>
        ${totalHoje > 0 ? html`<p class="page-sub">${feitasHoje} de ${totalHoje} feitas hoje</p>` : ''}
      </header>

      <div class="kpis" aria-label="Resumo">
        ${[['Atrasadas', sc.atrasadas.length, sc.atrasadas.length ? 'bad' : ''], ['Para hoje', sc.hoje.length, ''], ['Próximos 7 dias', sc.proximas.filter(t => t.prazo <= addDays(today(), 7)).length, ''], ['Feitas na semana', lista.filter(t => t.feita && t.feita_em && ymd(new Date(t.feita_em)) >= addDays(today(), -6)).length, 'good']].map(([n, v, c]) => html`<div class="kpi ${c}"><strong>${v}</strong><span>${n}</span></div>`)}
      </div>

      <form class="taskform" data-form="tar:add" autocomplete="off">
        <div class="tf-head"><span class="tf-badge">${icon('plus', 14)}</span><h2>Nova tarefa</h2></div>
        <input id="qa-input" name="titulo" maxlength="140" placeholder="O que precisa ser feito?" aria-label="Descrição da tarefa">
        <div class="tf-grid">
          <div class="tf-field" role="group" aria-label="Quem vai fazer">
            <span class="tf-label">1. Quem vai fazer</span>
            <div class="chips small">${K.RESPONSAVEIS.map(n => html`<button type="button" class="chip${S.para === n ? ' on' : ''}" data-act="tar:para" data-v="${n}" aria-pressed="${S.para === n ? 'true' : 'false'}">${n === 'Ambos' ? 'Os dois' : n}</button>`)}</div>
          </div>
          <div class="tf-field" role="group" aria-label="Para quando">
            <span class="tf-label">2. Para quando</span>
            <div class="chips small">
              ${[['hoje', 'Hoje'], ['amanha', 'Amanhã'], ['sem', 'Sem data'], ['data', S.data && S.quando === 'data' ? dateLabel(S.data) : 'Outro dia']].map(([id, nome]) => html`<button type="button" class="chip${S.quando === id ? ' on' : ''}" data-act="tar:quando" data-v="${id}" aria-pressed="${S.quando === id ? 'true' : 'false'}">${id === 'data' ? icon('calendar', 14) : ''}${nome}</button>`)}
              ${S.quando === 'data' ? html`<input type="date" id="qa-data" class="date-mini" data-input="tar:data" data-on="change" value="${S.data}" min="${today()}" aria-label="Data da tarefa">` : ''}
            </div>
          </div>
        </div>
        <div class="tf-more">
          <button type="button" class="link-btn" data-act="tar:mais" aria-expanded="${S.mais ? 'true' : 'false'}">${S.mais ? 'Menos opções' : 'Mais opções (prioridade e repetição)'}</button>
          ${S.mais ? html`<div class="tf-grid">
            <div class="tf-field" role="group" aria-label="Prioridade"><span class="tf-label">Prioridade</span>
              <div class="chips small">${[['normal', 'Normal'], ['alta', 'Alta']].map(([v, n]) => html`<button type="button" class="chip${S.prio === v ? ' on' : ''}" data-act="tar:prio" data-v="${v}" aria-pressed="${S.prio === v ? 'true' : 'false'}">${v === 'alta' ? icon('flag', 13) : ''}${n}</button>`)}</div></div>
            <div class="tf-field" role="group" aria-label="Repetir"><span class="tf-label">Repetir</span>
              <div class="chips small">${Object.entries(REPETE).map(([v, n]) => html`<button type="button" class="chip${S.repete === v ? ' on' : ''}" data-act="tar:repete" data-v="${v}" aria-pressed="${S.repete === v ? 'true' : 'false'}">${n}</button>`)}</div></div>
          </div>${S.repete !== 'nao' && S.quando === 'sem' ? html`<p class="hint">Para repetir, a tarefa precisa de uma data.</p>` : ''}` : ''}
        </div>
        <div class="tf-foot">
          <p class="tf-resumo">Vai para <b>${S.para === 'Ambos' ? 'os dois' : S.para}</b>, <b>${S.quando === 'hoje' ? 'hoje' : S.quando === 'amanha' ? 'amanhã' : S.quando === 'data' ? (S.data ? dateLabel(S.data) : 'data a escolher') : 'sem data'}</b>${S.prio === 'alta' ? ', prioridade alta' : ''}${S.repete !== 'nao' ? ', ' + REPETE[S.repete].toLowerCase() : ''}.</p>
          <button type="submit" class="btn primary">${icon('plus', 16)}Adicionar tarefa</button>
        </div>
      </form>

      <div class="viewbar">
        <span class="tf-label">Ver tarefas de</span>
        <div class="chips small" role="group" aria-label="Filtrar a lista por pessoa">
          ${['todas', ...K.NOMES].map(n => html`<button type="button" class="chip${S.quem === n ? ' on' : ''}" data-act="tar:quem" data-v="${n}" aria-pressed="${S.quem === n ? 'true' : 'false'}">${n === 'todas' ? 'Todas' : n}</button>`)}
        </div>
      </div>

      ${vazio ? html`<div class="empty"><h3>Nenhuma tarefa por aqui</h3><p>Digite acima o que precisa ser feito e aperte Enter. Dá para repetir tarefas toda semana ou todo mês.</p></div>` : html`
        <div class="board">
        ${bloco('Atrasadas', sc.atrasadas, 'late')}
        ${bloco('Hoje', sc.hoje)}
        ${bloco('Próximas', sc.proximas)}
        ${bloco('Sem data', sc.sem)}
        ${!sc.atrasadas.length && !sc.hoje.length && !sc.proximas.length && !sc.sem.length ? html`<div class="empty small"><h3>Tudo em dia</h3><p>Nenhuma tarefa pendente.</p></div>` : ''}
        ${sc.feitas.length ? html`<section class="section">
          <div class="section-head"><h3>Concluídas</h3>
            <button type="button" class="btn ghost small" data-act="tar:conc" aria-expanded="${S.conc ? 'true' : 'false'}">${S.conc ? 'Ocultar' : 'Mostrar ' + sc.feitas.length}</button></div>
          ${S.conc ? html`<ul class="rows">${sc.feitas.map(rowHtml)}</ul>` : ''}
        </section>` : ''}
        </div>`}
    </section>`);

    if (keep) {
      const novo = root.querySelector('#qa-input');
      if (novo) { novo.value = keep.v; if (keep.f) { novo.focus(); novo.setSelectionRange(keep.v.length, keep.v.length); } }
    }
  }

  /* ---------- ações ---------- */
  Forms['tar:add'] = f => {
    const input = f.querySelector('[name=titulo]');
    const titulo = input.value.trim(); if (!titulo) { input.focus(); return; }
    if (S.quando === 'data' && !S.data) {
      toast('Escolha a data da tarefa.', 'erro');
      const d = document.getElementById('qa-data'); if (d) { d.focus(); if (d.showPicker) { try { d.showPicker(); } catch (e) { /* ignora */ } } }
      return;
    }
    const prazo = S.quando === 'hoje' ? today() : S.quando === 'amanha' ? addDays(today(), 1) : S.quando === 'data' ? S.data : null;
    if (S.repete !== 'nao' && !prazo) { toast('Para repetir, escolha uma data (hoje, amanhã ou outro dia).', 'erro'); return; }
    DB.insert('tarefas', { titulo, responsavel: S.para, prazo, prioridade: S.prio, repete: S.repete, obs: null, feita: false, feita_em: null, feita_por: null, criado_por: DB.user.nome, criado_em: new Date().toISOString() });
    input.value = ''; S.prio = 'normal'; S.repete = 'nao'; toast('Tarefa adicionada'); refresh(); const n = document.getElementById('qa-input'); if (n) n.focus();
  };
  on('tar:mais', () => { S.mais = !S.mais; refresh(); });
  on('tar:prio', el => { S.prio = el.dataset.v; refresh(); });
  on('tar:repete', el => { S.repete = el.dataset.v; refresh(); });
  on('tar:para', el => { S.para = el.dataset.v; refresh(); });
  on('tar:quando', el => {
    S.quando = el.dataset.v; refresh();
    if (S.quando === 'data' && !S.data) {
      const d = document.getElementById('qa-data'); if (d) { d.focus(); if (d.showPicker) { try { d.showPicker(); } catch (e) { /* ignora */ } } }
    }
  });
  Inputs['tar:data'] = el => { S.data = el.value; refresh(); };
  on('tar:quem', el => { S.quem = el.dataset.v; lsSet('np:tar:quem', S.quem); refresh(); });
  on('tar:conc', () => { S.conc = !S.conc; refresh(); });
  on('tar:edit', el => openTarefa(el.dataset.id));

  function proximaData(prazo, repete) {
    const t0 = today();
    const passo = d => repete === 'diaria' ? addDays(d, 1) : repete === 'semanal' ? addDays(d, 7) : addMonthsDate(d, 1);
    let n = passo(prazo), guarda = 0;
    while (n <= t0 && guarda++ < 400) n = passo(n);
    return n;
  }
  on('tar:toggle', el => {
    const t = DB.find('tarefas', el.dataset.id); if (!t) return;
    const feita = !t.feita;
    DB.update('tarefas', t.id, { feita, feita_em: feita ? new Date().toISOString() : null, feita_por: feita ? DB.user.nome : null });
    if (feita && t.repete && t.repete !== 'nao' && t.prazo) {
      const prox = proximaData(t.prazo, t.repete);
      DB.insert('tarefas', { titulo: t.titulo, responsavel: t.responsavel, prazo: prox, prioridade: t.prioridade, repete: t.repete, obs: t.obs || null, feita: false, feita_em: null, feita_por: null, criado_por: DB.user.nome, criado_em: new Date().toISOString() });
      toast('Próxima vez: ' + dateLabel(prox));
    }
  });

  function openTarefa(id) {
    const t = DB.find('tarefas', id); if (!t) return;
    const st = { titulo: t.titulo, responsavel: t.responsavel || K.RESPONSAVEIS[0], prazo: t.prazo || '', prioridade: t.prioridade || 'normal', repete: t.repete || 'nao', obs: t.obs || '' };
    let err = '';
    const seg = (campo, valor, rotulo) => html`<button type="button" class="seg-btn${st[campo] === valor ? ' on' : ''}" data-set="${campo}" data-v="${valor}" aria-pressed="${st[campo] === valor ? 'true' : 'false'}">${rotulo}</button>`;
    const form = () => html`<form class="form" novalidate>
      <div class="field"><label class="label" for="t-titulo">Tarefa</label><input id="t-titulo" name="titulo" value="${st.titulo}" maxlength="140"></div>
      <div class="field"><span class="label">Quem faz</span>
        <div class="chips" role="group" aria-label="Responsável">${K.RESPONSAVEIS.map(n => html`<button type="button" class="chip${st.responsavel === n ? ' on' : ''}" data-set="responsavel" data-v="${n}" aria-pressed="${st.responsavel === n ? 'true' : 'false'}">${pessoaTag(n)}</button>`)}</div></div>
      <div class="grid2">
        <div class="field"><label class="label" for="t-prazo">Prazo</label>
          <div class="input-row"><input id="t-prazo" name="prazo" type="date" value="${st.prazo}"><button type="button" class="btn ghost small" data-clear ${st.prazo ? '' : 'disabled'}>Limpar</button></div></div>
        <div class="field"><span class="label">Prioridade</span>
          <div class="seg" role="group" aria-label="Prioridade">${seg('prioridade', 'baixa', 'Baixa')}${seg('prioridade', 'normal', 'Normal')}${seg('prioridade', 'alta', 'Alta')}</div></div>
      </div>
      <div class="field"><span class="label">Repetir</span>
        <div class="seg wrap" role="group" aria-label="Repetição">${Object.entries(REPETE).map(([v, r]) => seg('repete', v, r))}</div>
        ${st.repete !== 'nao' && !st.prazo ? html`<p class="hint">Para repetir, escolha um prazo.</p>` : ''}</div>
      <div class="field"><label class="label" for="t-obs">Detalhes (opcional)</label><textarea id="t-obs" name="obs" rows="3" maxlength="500">${st.obs}</textarea></div>
      ${t.feita && t.feita_por ? html`<p class="hint">Concluída por ${t.feita_por}.</p>` : ''}
      ${err ? html`<p class="form-error" role="alert">${err}</p>` : ''}
      <div class="modal-actions">
        <button type="button" class="btn danger-ghost" data-del>${icon('trash', 16)}Excluir</button>
        <button type="submit" class="btn primary push-right">Salvar</button>
      </div>
    </form>`;
    openModal({
      title: 'Editar tarefa', body: form(),
      onMount(api) {
        const redraw = () => { const y = api.body.scrollTop; api.body.innerHTML = String(form()); api.body.scrollTop = y; };
        api.body.addEventListener('click', async e => {
          const b = e.target.closest('[data-set]');
          if (b) { st[b.dataset.set] = b.dataset.v; err = ''; redraw(); return; }
          if (e.target.closest('[data-clear]')) { st.prazo = ''; redraw(); return; }
          if (e.target.closest('[data-del]')) {
            const ok = await confirmDialog({ title: 'Excluir tarefa?', message: 'Esta tarefa será apagada.', confirmLabel: 'Excluir', danger: true });
            if (ok) { DB.apagar('tarefas', id, 'Tarefa excluída'); api.close(); refresh(); }
          }
        });
        api.body.addEventListener('input', e => {
          if (!e.target.name) return; st[e.target.name] = e.target.value;
          if (e.target.name === 'prazo') { const c = api.body.querySelector('[data-clear]'); if (c) c.disabled = !st.prazo; }
        });
        api.body.addEventListener('submit', e => {
          e.preventDefault();
          if (!st.titulo.trim()) { err = 'Escreva o que precisa ser feito.'; redraw(); return; }
          if (st.repete !== 'nao' && !st.prazo) { err = 'Para repetir a tarefa, escolha um prazo.'; redraw(); return; }
          DB.update('tarefas', id, { titulo: st.titulo.trim(), responsavel: st.responsavel, prazo: st.prazo || null, prioridade: st.prioridade, repete: st.repete, obs: st.obs.trim() || null });
          toast('Tarefa salva'); api.close(); refresh();
        });
      },
    });
  }

  /* usado na tela inicial */
  function pendentesHoje() {
    const sc = secoes(DB.all('tarefas'));
    const lista = DB.all('tarefas');
    const feitas = lista.filter(feitaHoje).length;
    return { lista: sc.atrasadas.concat(sc.hoje), feitas, total: sc.atrasadas.length + sc.hoje.length + feitas };
  }

  global.Tarefas = { render, rowHtml, pendentesHoje };
})(window);
