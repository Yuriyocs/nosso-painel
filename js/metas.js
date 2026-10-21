/* Metas do casal: com passos, prazo e, se quiserem, ligação com um cofre. */
(function (global) {
  'use strict';
  const U = global.UI, DB = global.DB;
  const { html, icon, fmt, today, diffDays, dateLabel, K, bancoTag, openModal, confirmDialog, toast, on, Forms, lsGet, lsSet } = U;

  const S = { filtro: lsGet('np:metas:filtro') || 'andamento' };
  const CUR = { root: null };
  const refresh = () => { if (CUR.root && U.route.nome === 'metas') render(CUR.root); };

  const cofreDe = m => (m.cofre_id ? DB.find('cofres', m.cofre_id) : null);
  const passosDe = m => DB.all('meta_passos').filter(p => p.meta_id === m.id).sort((a, b) => String(a.criado_em || '').localeCompare(String(b.criado_em || '')));
  const clamp = v => Math.max(0, Math.min(100, v));

  function progresso(m) {
    const c = cofreDe(m);
    if (c && +c.meta > 0) {
      const s = global.Financas.saldoCofre(c);
      return { tipo: 'cofre', pct: clamp(s / +c.meta * 100), texto: `${fmt(s)} de ${fmt(c.meta)}` };
    }
    const ps = passosDe(m);
    if (ps.length) { const f = ps.filter(p => p.feito).length; return { tipo: 'passos', pct: f / ps.length * 100, texto: `${f} de ${ps.length} passos` }; }
    return { tipo: 'nenhum', pct: m.concluida ? 100 : 0, texto: '' };
  }
  function prazoTexto(m) {
    if (!m.prazo) return '';
    if (m.concluida) return '';
    const d = diffDays(m.prazo, today());
    if (d < 0) return `venceu ${dateLabel(m.prazo)}`;
    if (d === 0) return 'prazo é hoje';
    if (d === 1) return 'prazo é amanhã';
    if (d <= 60) return `faltam ${d} dias`;
    return `até ${dateLabel(m.prazo)}`;
  }
  const atrasada = m => !m.concluida && m.prazo && m.prazo < today();
  const porPrazo = (a, b) => (a.prazo || '9999').localeCompare(b.prazo || '9999') || String(a.criado_em || '').localeCompare(String(b.criado_em || ''));

  function rowMeta(m) {
    const pr = progresso(m);
    return html`<li class="row tall${m.concluida ? ' done' : ''}">
      <button type="button" class="check${m.concluida ? ' on' : ''}" data-act="met:toggle" data-id="${m.id}" aria-pressed="${m.concluida ? 'true' : 'false'}" aria-label="${m.concluida ? 'Reabrir meta' : 'Concluir meta'}">${icon('check', 14)}</button>
      <button type="button" class="row-body" data-act="met:abrir" data-id="${m.id}">
        <span class="row-title">${m.titulo}</span>
        <span class="row-meta">${m.categoria ? html`<span class="badge">${m.categoria}</span>` : ''}${prazoTexto(m) ? html`<span class="meta-text${atrasada(m) ? ' late' : ''}">${prazoTexto(m)}</span>` : ''}${pr.texto ? html`<span class="meta-text">${pr.texto}</span>` : ''}</span>
        ${pr.tipo !== 'nenhum' ? html`<span class="bar-track thin"><span style="width:${pr.pct.toFixed(1)}%"></span></span>` : ''}
      </button>
    </li>`;
  }

  function render(root) {
    CUR.root = root;
    const todas = DB.all('metas');
    const and = todas.filter(m => !m.concluida).sort(porPrazo);
    const conc = todas.filter(m => m.concluida).sort((a, b) => String(b.concluida_em || '').localeCompare(String(a.concluida_em || '')));
    const lista = S.filtro === 'concluidas' ? conc : and;
    root.innerHTML = String(html`<section class="page">
      <header class="page-head"><h1>Metas do casal</h1>
        ${and.length ? html`<p class="page-sub">${and.length} em andamento${conc.length ? `, ${conc.length} concluídas` : ''}</p>` : ''}</header>
      <div class="chips" role="group" aria-label="Filtrar metas">
        <button type="button" class="chip${S.filtro === 'andamento' ? ' on' : ''}" data-act="met:filtro" data-v="andamento">Em andamento (${and.length})</button>
        <button type="button" class="chip${S.filtro === 'concluidas' ? ' on' : ''}" data-act="met:filtro" data-v="concluidas">Concluídas (${conc.length})</button>
      </div>
      ${lista.length === 0 ? html`<div class="empty"><h3>${S.filtro === 'concluidas' ? 'Nenhuma meta concluída ainda' : 'Nenhuma meta por enquanto'}</h3><p>${S.filtro === 'concluidas' ? 'Quando vocês concluírem uma meta, ela fica guardada aqui.' : 'Viajar, trocar de carro, montar a reserva... Crie uma meta, quebre em passos e acompanhem juntos.'}</p></div>`
        : html`<ul class="rows grid">${lista.map(rowMeta)}</ul>`}
      <button type="button" class="fab" data-act="met:nova">${icon('plus')}<span>Nova meta</span></button>
    </section>`);
  }

  on('met:filtro', el => { S.filtro = el.dataset.v; lsSet('np:metas:filtro', S.filtro); refresh(); });
  on('met:nova', () => openForm());
  on('met:abrir', el => abrir(el.dataset.id));
  on('met:toggle', el => concluir(el.dataset.id));

  function concluir(id) {
    const m = DB.find('metas', id); if (!m) return;
    const c = !m.concluida;
    DB.update('metas', id, { concluida: c, concluida_em: c ? new Date().toISOString() : null });
    if (c) toast('Meta concluída. Parabéns aos dois!');
  }

  /* ---------- formulário ---------- */
  function openForm(meta) {
    const st = meta
      ? { titulo: meta.titulo, categoria: meta.categoria || '', prazo: meta.prazo || '', cofre_id: meta.cofre_id || '', obs: meta.obs || '' }
      : { titulo: '', categoria: '', prazo: '', cofre_id: '', obs: '' };
    let err = '';
    const cofres = DB.all('cofres').slice().sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    const form = () => html`<form class="form" novalidate>
      <div class="field"><label class="label" for="m-titulo">Qual é a meta?</label><input id="m-titulo" name="titulo" value="${st.titulo}" maxlength="100" placeholder="Ex.: Viagem de fim de ano"></div>
      <div class="grid2">
        <div class="field"><label class="label" for="m-cat">Tipo</label>
          <select id="m-cat" name="categoria"><option value="">Sem tipo</option>${K.CAT_META.map(c => html`<option value="${c}" ${st.categoria === c ? 'selected' : ''}>${c}</option>`)}</select></div>
        <div class="field"><label class="label" for="m-prazo">Prazo (opcional)</label><input id="m-prazo" name="prazo" type="date" value="${st.prazo}"></div>
      </div>
      <div class="field"><label class="label" for="m-cofre">Ligar a um cofre (opcional)</label>
        <select id="m-cofre" name="cofre_id"><option value="">Não ligar</option>${cofres.map(c => html`<option value="${c.id}" ${st.cofre_id === c.id ? 'selected' : ''}>${c.nome}</option>`)}</select>
        <p class="hint">Com um cofre que tenha meta de valor, o progresso acompanha o que vocês guardam em Finanças. Sem cofre, o progresso vem dos passos.</p></div>
      <div class="field"><label class="label" for="m-obs">Anotações (opcional)</label><textarea id="m-obs" name="obs" rows="3" maxlength="500">${st.obs}</textarea></div>
      ${err ? html`<p class="form-error" role="alert">${err}</p>` : ''}
      <div class="modal-actions"><button type="submit" class="btn primary push-right">${meta ? 'Salvar alterações' : 'Criar meta'}</button></div>
    </form>`;
    openModal({
      title: meta ? 'Editar meta' : 'Nova meta', body: form(), focus: !meta,
      onMount(api) {
        api.body.addEventListener('input', e => { if (e.target.name) st[e.target.name] = e.target.value; });
        api.body.addEventListener('change', e => { if (e.target.name) st[e.target.name] = e.target.value; });
        api.body.addEventListener('submit', e => {
          e.preventDefault();
          if (!st.titulo.trim()) { err = 'Dê um nome para a meta.'; api.body.innerHTML = String(form()); return; }
          const row = { titulo: st.titulo.trim(), categoria: st.categoria || null, prazo: st.prazo || null, cofre_id: st.cofre_id || null, obs: st.obs.trim() || null };
          if (meta) DB.update('metas', meta.id, row);
          else DB.insert('metas', Object.assign(row, { concluida: false, concluida_em: null, criado_por: DB.user.nome }));
          toast(meta ? 'Meta salva' : 'Meta criada'); api.close();
        });
      },
    });
  }

  /* ---------- detalhe ---------- */
  function abrir(id) {
    const vista = () => {
      const m = DB.find('metas', id); if (!m) return html`<p>Meta não encontrada.</p>`;
      const pr = progresso(m), ps = passosDe(m), c = cofreDe(m);
      return html`
        <div class="detail-top">
          <div class="row-meta">${m.categoria ? html`<span class="badge">${m.categoria}</span>` : ''}${m.concluida ? html`<span class="badge in">Concluída</span>` : ''}${prazoTexto(m) ? html`<span class="meta-text${atrasada(m) ? ' late' : ''}">${prazoTexto(m)}</span>` : ''}</div>
          ${pr.tipo !== 'nenhum' ? html`<dl class="detail-stats"><div><dt>Progresso</dt><dd>${Math.round(pr.pct)}%</dd></div><div><dt>${pr.tipo === 'cofre' ? 'Guardado' : 'Passos'}</dt><dd>${pr.texto}</dd></div></dl>
            <div class="bar-track"><span style="width:${pr.pct.toFixed(1)}%"></span></div>` : ''}
          ${c ? html`<p class="hint">Ligada ao cofre <strong>${c.nome}</strong> ${bancoTag(c.banco)}${+c.meta > 0 ? '' : '. Defina uma meta de valor nesse cofre para ver o progresso.'}</p>` : ''}
          ${m.obs ? html`<p class="note-text">${m.obs}</p>` : ''}
        </div>
        <section class="steps"><h3>Passos</h3>
          ${ps.length ? html`<ul class="rows compact">${ps.map(p => html`<li class="row${p.feito ? ' done' : ''}">
            <button type="button" class="check${p.feito ? ' on' : ''}" data-passo="${p.id}" aria-pressed="${p.feito ? 'true' : 'false'}" aria-label="${p.feito ? 'Reabrir passo' : 'Concluir passo'}">${icon('check', 14)}</button>
            <div class="row-body static"><span class="row-title">${p.texto}</span></div>
            <button type="button" class="icon-btn" data-delpasso="${p.id}" aria-label="Excluir passo">${icon('close', 16)}</button></li>`)}</ul>`
            : html`<p class="hint">Quebre a meta em pequenos passos para acompanhar o avanço.</p>`}
          <form class="quickadd passo" data-novo-passo autocomplete="off">
            <input name="texto" maxlength="120" placeholder="Novo passo" aria-label="Novo passo"><button type="submit" class="btn ghost">Adicionar</button>
          </form>
        </section>
        <div class="modal-actions">
          <button type="button" class="btn danger-ghost" data-del>${icon('trash', 16)}Excluir</button>
          <button type="button" class="btn ghost push-right" data-edit>Editar</button>
          <button type="button" class="btn primary" data-concluir>${m.concluida ? 'Reabrir' : 'Concluir meta'}</button>
        </div>`;
    };
    const m0 = DB.find('metas', id);
    openModal({
      title: m0 ? m0.titulo : 'Meta', body: vista(), wide: true,
      onMount(api) {
        const redraw = () => { const y = api.body.scrollTop; api.body.innerHTML = String(vista()); api.body.scrollTop = y; };
        api.body.addEventListener('click', async e => {
          const p = e.target.closest('[data-passo]');
          if (p) { const x = DB.find('meta_passos', p.dataset.passo); if (x) DB.update('meta_passos', x.id, { feito: !x.feito }); redraw(); return; }
          const dp = e.target.closest('[data-delpasso]');
          if (dp) { DB.apagar('meta_passos', dp.dataset.delpasso, 'Passo removido'); redraw(); return; }
          if (e.target.closest('[data-concluir]')) { concluir(id); redraw(); return; }
          if (e.target.closest('[data-edit]')) { const m = DB.find('metas', id); api.close(); if (m) openForm(m); return; }
          if (e.target.closest('[data-del]')) {
            const ok = await confirmDialog({ title: 'Excluir meta?', message: 'A meta e os passos dela serão apagados para vocês dois.', confirmLabel: 'Excluir', danger: true });
            if (ok) { DB.apagar('metas', id, 'Meta excluída'); api.close(); }
          }
        });
        api.body.addEventListener('submit', e => {
          const f = e.target.closest('[data-novo-passo]'); if (!f) return;
          e.preventDefault();
          const texto = f.texto.value.trim(); if (!texto) return;
          DB.insert('meta_passos', { meta_id: id, texto, feito: false, criado_em: new Date().toISOString() });
          redraw(); const i = api.body.querySelector('[data-novo-passo] input'); if (i) i.focus();
        });
      },
    });
  }

  function emAndamento(limite = 3) {
    return DB.all('metas').filter(m => !m.concluida).sort(porPrazo).slice(0, limite);
  }

  global.Metas = { render, abrir, emAndamento, progresso, prazoTexto };
})(window);
