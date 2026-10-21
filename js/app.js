/* Casca do app: login, navegação, tela inicial, ajustes. */
(function (global) {
  'use strict';
  const U = global.UI, DB = global.DB;
  const { html, icon, fmt, today, monthKey, monthLabel, longDate, dateLabel, K, pessoaSlot, pessoaTag, bancoTag, openModal, closeAllModals, confirmDialog, toast, on, Forms, lsGet, lsSet, agoLabel } = U;
  const $app = document.getElementById('app');

  /* ---------- tema ---------- */
  function aplicarTema() {
    const t = lsGet('np:tema');
    if (t === 'claro') document.documentElement.dataset.theme = 'light';
    else if (t === 'escuro') document.documentElement.dataset.theme = 'dark';
    else delete document.documentElement.dataset.theme;
    const meta = document.querySelector('meta[name=theme-color]');
    if (meta) meta.content = (t === 'escuro' || (t !== 'claro' && matchMedia('(prefers-color-scheme: dark)').matches)) ? '#0F1A1D' : '#14282E';
  }

  const marca = html`<span class="brand-mark" aria-hidden="true"><i class="a"></i><i class="b"></i></span>`;

  /* ---------- telas de entrada ---------- */
  function telaCentral(conteudo) {
    $app.innerHTML = String(html`<main class="gate"><div class="gate-card">
      <div class="gate-brand">${marca}<span>Nosso Painel</span></div>${conteudo}</div></main>`);
  }

  function telaErro() {
    telaCentral(html`<h1>Sem conexão com a nuvem</h1>
      <p class="gate-text">Não consegui carregar a biblioteca do Supabase. Confira se há internet e recarregue a página.</p>
      <button type="button" class="btn primary block" onclick="location.reload()">Tentar de novo</button>`);
  }

  function telaDemo() {
    telaCentral(html`<h1>Quem está usando?</h1>
      <p class="gate-text">Modo demonstração: os dados ficam só neste navegador. Para usarem juntos, de qualquer lugar, siga o passo a passo do arquivo README.</p>
      <div class="gate-buttons">
        ${K.NOMES.map(n => html`<button type="button" class="btn who p-${pessoaSlot(n)}" data-act="app:demo" data-v="${n}"><i></i>${n}</button>`)}
      </div>`);
  }
  on('app:demo', el => { DB.demoLogin(el.dataset.v); iniciar(); });

  function telaLogin(erro = '') {
    telaCentral(html`<h1>Entrar</h1>
      <p class="gate-text">Use o e-mail e a senha que vocês criaram no Supabase.</p>
      <form class="form" data-form="app:login" novalidate>
        <div class="field"><label class="label" for="l-email">E-mail</label><input id="l-email" name="email" type="email" autocomplete="username" inputmode="email" required></div>
        <div class="field"><label class="label" for="l-senha">Senha</label><input id="l-senha" name="senha" type="password" autocomplete="current-password" required></div>
        <p class="form-error" role="alert" ${erro ? '' : 'hidden'}>${erro}</p>
        <button type="submit" class="btn primary block">Entrar</button>
      </form>`);
    const e = document.getElementById('l-email'); if (e) e.focus();
  }
  Forms['app:login'] = async f => {
    const email = f.email.value.trim(), senha = f.senha.value;
    const btn = f.querySelector('button[type=submit]');
    if (!email || !senha) { telaLogin('Preencha o e-mail e a senha.'); return; }
    btn.disabled = true; btn.textContent = 'Entrando...';
    try { await DB.signIn(email, senha); iniciar(); }
    catch (err) {
      const msg = /invalid login/i.test(err.message || '') ? 'E-mail ou senha incorretos.' : 'Não foi possível entrar agora. Tente de novo em instantes.';
      telaLogin(msg);
    }
  };

  async function telaQuemE() {
    const usados = await DB.nomesEmUso();
    telaCentral(html`<h1>Quem é você?</h1>
      <p class="gate-text">Escolha seu nome uma única vez. Ele aparece nos lançamentos e nas tarefas que você criar.</p>
      <div class="gate-buttons">
        ${K.NOMES.map(n => html`<button type="button" class="btn who p-${pessoaSlot(n)}" data-act="app:quem" data-v="${n}" ${usados.includes(n) ? 'disabled' : ''}><i></i>${n}${usados.includes(n) ? html`<small>já escolhido</small>` : ''}</button>`)}
      </div>
      <p class="form-error" id="quem-erro" role="alert" hidden></p>`);
  }
  on('app:quem', async el => {
    try { await DB.setNome(el.dataset.v); iniciar(); }
    catch (err) { const p = document.getElementById('quem-erro'); p.hidden = false; p.textContent = 'Não foi possível salvar o nome. Tente de novo.'; }
  });

  /* ---------- casca ---------- */
  const NAV = [
    { id: 'inicio', nome: 'Início', ic: 'home' },
    { id: 'financas', nome: 'Finanças', ic: 'wallet' },
    { id: 'calendario', nome: 'Calendário', ic: 'calendar', mais: true },
    { id: 'tarefas', nome: 'Tarefas', ic: 'tasks' },
    { id: 'compras', nome: 'Compras', ic: 'cart' },
    { id: 'metas', nome: 'Metas', ic: 'target', mais: true },
    { id: 'notas', nome: 'Notas', ic: 'note', mais: true },
    { id: 'notificacoes', nome: 'Notificações', ic: 'bell', mais: true },
  ];
  let main = null, rota = 'inicio', sub = '';

  function montarCasca() {
    const eu = DB.user.nome;
    $app.innerHTML = String(html`<div class="shell">
      <aside class="rail">
        <a class="brand" href="#/inicio">${marca}<span>Nosso Painel</span></a>
        <nav class="rail-nav" aria-label="Principal">
          ${NAV.map(n => html`<a href="#/${n.id}" class="rail-link" data-nav="${n.id}">${icon(n.ic)}<span>${n.nome}</span>${n.id === 'notificacoes' ? html`<b class="nbadge" data-nbadge hidden></b>` : ''}</a>`)}
        </nav>
        <button type="button" class="rail-user" data-act="app:ajustes"><span class="avatar p-${pessoaSlot(eu)}">${eu[0]}</span><span>${eu}<small>Ajustes e sair</small></span></button>
      </aside>
      <main id="main" class="main" tabindex="-1"></main>
      <nav class="tabbar" aria-label="Principal">
        ${NAV.filter(n => !n.mais).map(n => html`<a href="#/${n.id}" class="tab" data-nav="${n.id}">${icon(n.ic, 22)}<span>${n.nome}</span></a>`)}
        <button type="button" class="tab tab-mais" data-act="app:mais">${icon('more', 22)}<b class="nbadge dot" data-nbadge-mais hidden></b><span>Mais</span></button>
      </nav>
    </div>`);
    main = document.getElementById('main');
    if (global.Ajuda) global.Ajuda.iniciar(main);
  }

  /* contador de notificações novas (menu, aba do celular e título da página) */
  function badge() {
    const n = global.Notificacoes && DB.user ? global.Notificacoes.naoLidas() : 0;
    document.querySelectorAll('[data-nbadge]').forEach(b => { b.hidden = !n; b.textContent = n > 99 ? '99+' : n; });
    document.querySelectorAll('[data-nbadge-mais]').forEach(b => { b.hidden = !n; });
    const base = (document.title || '').replace(/^\(\d+\+?\) /, '');
    document.title = n ? `(${n}) ${base}` : base;
  }
  global.App = { badge };

  function lerRota() {
    const p = location.hash.replace(/^#\/?/, '').split('/');
    rota = NAV.some(n => n.id === p[0]) ? p[0] : 'inicio';
    sub = p[1] || '';
  }

  function desenhar(preservarScroll) {
    if (!main) return;
    const y = window.scrollY;
    U.route.nome = rota;
    if (rota === 'inicio') telaInicio(main);
    else if (rota === 'financas') global.Financas.render(main, sub);
    else if (rota === 'calendario') global.Calendario.render(main);
    else if (rota === 'tarefas') global.Tarefas.render(main);
    else if (rota === 'compras') global.Compras.render(main);
    else if (rota === 'metas') global.Metas.render(main);
    else if (rota === 'notificacoes') global.Notificacoes.render(main);
    else global.Notas.render(main, sub);
    document.querySelectorAll('[data-nav]').forEach(a => {
      const on = a.dataset.nav === rota;
      a.classList.toggle('on', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    const mais = document.querySelector('.tab-mais');
    if (mais) mais.classList.toggle('on', !!NAV.find(n => n.id === rota).mais);
    document.title = (NAV.find(n => n.id === rota).nome) + ' - Nosso Painel';
    badge();
    if (preservarScroll) window.scrollTo(0, y); else window.scrollTo(0, 0);
  }
  function aoMudarRota() { closeAllModals(); lerRota(); desenhar(false); }

  /* ---------- tela inicial ---------- */
  function telaInicio(root) {
    const eu = DB.user.nome, h = new Date().getHours();
    const saud = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
    const mk = monthKey(today());
    const r = global.Financas.resumo(global.Financas.itensDoMes(mk));
    const venc = global.Financas.proximos(7, 4);
    const tp = global.Tarefas.pendentesHoje();
    const notas = global.Notas.recentes(3);
    const cp = global.Compras.pendentes(4);
    const metas = global.Metas.emAndamento(3);
    const prevR = global.Financas.resumo(global.Financas.itensDoMes(U.addMonthsKey(mk, -1)));
    const delta = prevR.sai > 0 ? (r.sai - prevR.sai) / prevR.sai * 100 : null;

    root.innerHTML = String(html`<section class="page home">
      <header class="home-head">
        <div><h1>${saud}, ${eu}</h1><p class="page-sub">${longDate()}</p></div>
        <button type="button" class="avatar-btn p-${pessoaSlot(eu)}" data-act="app:ajustes" aria-label="Ajustes e sair">${eu[0]}</button>
      </header>
      ${DB.mode === 'demo' ? html`<p class="demo-banner">Modo demonstração: os dados ficam só neste navegador.</p>` : ''}

      <div class="home-grid">
        <section class="block hm-fin">
          <div class="block-head"><h2>Finanças de ${monthLabel(mk)}</h2><a class="link" href="#/financas">Abrir</a></div>
          ${global.Financas.heroHtml(r, { delta, split: global.Financas.splitHtml(global.Financas.itensDoMes(mk)) })}
        </section>

        <div class="hm-proj">${global.Financas.cardProjecao(mk, false)}</div>

        <section class="card hm-venc">
          <div class="block-head"><h2>Próximos vencimentos</h2><a class="link" href="#/calendario">Calendário</a></div>
          ${venc.length ? html`<ul class="rows compact">${venc.map(i => html`<li class="row">
            <span class="check static saida" aria-hidden="true">${icon('calendar', 14)}</span>
            <a class="row-body" href="#/financas"><span class="row-title">${i.descricao}</span><span class="row-meta">${bancoTag(i.banco)}${pessoaTag(i.pessoa)}<span class="meta-text${i.data < today() ? ' late' : ''}">${i.data < today() ? 'venceu ' : ''}${dateLabel(i.data)}</span></span></a>
            <div class="row-amount saida"><strong>${fmt(i.valor)}</strong></div></li>`)}</ul>`
            : html`<p class="muted-line">Nada vence nos próximos 7 dias.</p>`}
        </section>

        <section class="card hm-tar">
          <div class="block-head"><h2>Hoje nas tarefas</h2><a class="link" href="#/tarefas">Abrir</a></div>
          ${tp.total ? html`<p class="muted-line">${tp.feitas} de ${tp.total} feitas</p><div class="bar-track thin"><span style="width:${Math.round(tp.feitas / tp.total * 100)}%"></span></div>` : ''}
          ${tp.lista.length ? html`<ul class="rows compact">${tp.lista.slice(0, 5).map(global.Tarefas.rowHtml)}</ul>${tp.lista.length > 5 ? html`<a class="link more" href="#/tarefas">e mais ${tp.lista.length - 5}</a>` : ''}`
            : html`<p class="muted-line">${tp.total ? 'Tudo feito por hoje.' : 'Nenhuma tarefa para hoje.'}</p>`}
        </section>

        <section class="card hm-comp">
          <div class="block-head"><h2>Compras</h2><a class="link" href="#/compras">Abrir</a></div>
          ${cp.total ? html`<p class="muted-line">${cp.total} ${cp.total === 1 ? 'item' : 'itens'} para comprar</p>
            <ul class="rows compact">${cp.itens.map(c => html`<li class="row"><div class="row-body static"><span class="row-title">${c.nome}${c.qtd ? html` <span class="badge qtd">${c.qtd}</span>` : ''}</span></div></li>`)}</ul>
            ${cp.total > cp.itens.length ? html`<a class="link more" href="#/compras">e mais ${cp.total - cp.itens.length}</a>` : ''}`
            : html`<p class="muted-line">Nenhum item na lista.</p>`}
        </section>

        <section class="card hm-met">
          <div class="block-head"><h2>Metas do casal</h2><a class="link" href="#/metas">Abrir</a></div>
          ${metas.length ? html`<ul class="rows compact">${metas.map(m => { const pr = global.Metas.progresso(m); return html`<li class="row tall"><button type="button" class="row-body" data-act="met:abrir" data-id="${m.id}">
            <span class="row-title">${m.titulo}</span>
            <span class="row-meta">${global.Metas.prazoTexto(m) ? html`<span class="meta-text">${global.Metas.prazoTexto(m)}</span>` : ''}${pr.texto ? html`<span class="meta-text">${pr.texto}</span>` : ''}</span>
            ${pr.tipo !== 'nenhum' ? html`<span class="bar-track thin"><span style="width:${pr.pct.toFixed(1)}%"></span></span>` : ''}</button></li>`; })}</ul>`
            : html`<p class="muted-line">Nenhuma meta em andamento.</p>`}
        </section>

        <section class="card hm-not">
          <div class="block-head"><h2>Notas recentes</h2><a class="link" href="#/notas">Abrir</a></div>
          ${notas.length ? html`<ul class="note-items compact">${notas.map(n => html`<li><a class="note-item" href="#/notas/${n.id}" data-cor="${n.cor || ''}"><span class="note-item-title">${n.titulo || 'Sem título'}</span><span class="note-item-when">${agoLabel(n.atualizado_em)}</span></a></li>`)}</ul>`
            : html`<p class="muted-line">Nenhuma nota ainda.</p>`}
        </section>
      </div>
    </section>`);
  }

  /* ---------- menu "Mais" (celular) ---------- */
  on('app:mais', () => {
    openModal({
      title: 'Mais opções', small: true,
      body: html`<ul class="more-list">
        ${NAV.filter(n => n.mais).map(n => html`<li><a class="more-link${rota === n.id ? ' on' : ''}" href="#/${n.id}">${icon(n.ic, 22)}<span>${n.nome}</span></a></li>`)}
        <li><button type="button" class="more-link" data-ajustes>${icon('user', 22)}<span>Ajustes e sair</span></button></li>
      </ul>`,
      onMount(api) {
        api.body.addEventListener('click', e => {
          if (e.target.closest('[data-ajustes]')) { api.close(); U.Actions['app:ajustes'](); return; }
          if (e.target.closest('a')) api.close();
        });
      },
    });
  });

  /* ---------- ajustes ---------- */
  function baixarBackup(sufixo) {
    const dados = { app: 'nosso-painel', exportado_em: new Date().toISOString(), por: DB.user.nome, tabelas: {} };
    Object.keys(DB.cache).forEach(t => { dados.tabelas[t] = DB.all(t); });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' }));
    a.download = `nosso-painel-backup-${sufixo ? sufixo + '-' : ''}${today()}.json`; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  on('app:ajustes', () => {
    const eu = DB.user.nome, tema = lsGet('np:tema') || 'auto';
    const corpo = () => html`
      <div class="settings-user"><span class="avatar big p-${pessoaSlot(eu)}">${eu[0]}</span>
        <div><strong>${eu}</strong><span class="muted">${DB.mode === 'cloud' ? DB.user.email : 'Modo demonstração'}</span></div></div>
      <div class="field"><span class="label">Aparência</span>
        <div class="seg" role="group" aria-label="Tema">
          ${[['auto', 'Automática'], ['claro', 'Clara'], ['escuro', 'Escura']].map(([v, n]) => html`<button type="button" class="seg-btn${(lsGet('np:tema') || 'auto') === v ? ' on' : ''}" data-tema="${v}" aria-pressed="${(lsGet('np:tema') || 'auto') === v ? 'true' : 'false'}">${n}</button>`)}
        </div></div>
      <div class="field"><span class="label">Cópia de segurança</span>
        <button type="button" class="btn ghost" data-backup>${icon('download', 16)}Baixar todos os dados (JSON)</button>
        <button type="button" class="btn ghost" data-restaurar>${icon('upload', 16)}Restaurar de um backup</button>
        <input type="file" id="bk-file" accept=".json,application/json" hidden>
        <p class="hint">O backup é um arquivo com tudo que está no painel. Vale guardar uma cópia de vez em quando. Restaurar troca os dados atuais pelos do arquivo.</p>
        <p class="bk-msg" id="bk-msg" role="status" hidden></p></div>
      <div class="field"><span class="label">Ajuda</span>
        <div class="stack"><button type="button" class="btn ghost" data-ajuda>${icon('help', 16)}Central de ajuda: como usar cada tela</button>
        <button type="button" class="btn ghost" data-atalhos>${icon('keyboard', 16)}Atalhos do teclado (tecla ?)</button></div></div>
      <p class="hint">Dica: no celular, abra o painel no navegador e escolha "Adicionar à tela inicial". Ele vira um app.</p>
      ${DB.mode === 'demo' ? html`<div class="field"><span class="label">Dados de demonstração</span>
        <div class="stack"><button type="button" class="btn ghost" data-reset="exemplo">Restaurar exemplos</button>
        <button type="button" class="btn danger-ghost" data-reset="vazio">Apagar tudo e começar do zero</button></div></div>` : ''}
      <div class="modal-actions"><button type="button" class="btn ghost" data-sair>${icon('logout', 16)}Sair</button></div>`;
    openModal({
      title: 'Ajustes', body: corpo(), small: true,
      onMount(api) {
        api.body.addEventListener('change', async e => {
          if (e.target.id !== 'bk-file' || !e.target.files[0]) return;
          const arq = e.target.files[0], msg = api.body.querySelector('#bk-msg');
          const erro = txt => { msg.hidden = false; msg.className = 'bk-msg erro'; msg.textContent = txt; };
          let d; try { d = JSON.parse(await arq.text()); } catch (x) { return erro('Esse arquivo não é um backup do painel (não consegui ler).'); }
          const v = DB.validarBackup(d); if (!v) return erro('Esse arquivo não parece um backup do Nosso Painel.');
          const ok = await confirmDialog({ title: 'Restaurar este backup?', message: `O arquivo tem ${v.linhas} registros${d.exportado_em ? ' (de ' + new Date(d.exportado_em).toLocaleDateString('pt-BR') + ')' : ''}. Os dados atuais serão trocados por eles. Antes disso, o painel baixa uma cópia do que existe agora, para você poder voltar atrás.`, confirmLabel: 'Restaurar', danger: true });
          e.target.value = '';
          if (!ok) return;
          baixarBackup('antes-de-restaurar');
          try { await DB.restaurar(d); api.close(); desenhar(false); toast('Backup restaurado'); }
          catch (x) { console.error(x); erro('Não consegui restaurar tudo. Seus dados foram mantidos onde possível; recarregue a página e confira. Detalhe: ' + (x.message || x)); await DB.loadAll().catch(() => {}); DB._touch('*'); }
        });
        api.body.addEventListener('click', async e => {
          const t = e.target.closest('[data-tema]');
          if (t) { lsSet('np:tema', t.dataset.tema); aplicarTema(); api.body.innerHTML = String(corpo()); return; }
          const r = e.target.closest('[data-reset]');
          if (r) {
            const vazio = r.dataset.reset === 'vazio';
            const ok = await confirmDialog({ title: vazio ? 'Apagar tudo?' : 'Restaurar exemplos?', message: vazio ? 'Todos os dados deste navegador serão apagados.' : 'Os dados atuais serão trocados pelos exemplos.', confirmLabel: vazio ? 'Apagar' : 'Restaurar', danger: vazio });
            if (ok) { DB.resetDemo(!vazio); api.close(); desenhar(false); toast(vazio ? 'Tudo limpo' : 'Exemplos restaurados'); }
            return;
          }
          if (e.target.closest('[data-backup]')) { baixarBackup(); toast('Backup baixado'); return; }
          if (e.target.closest('[data-ajuda]')) { api.close(); global.Ajuda.central(); return; }
          if (e.target.closest('[data-atalhos]')) { api.close(); global.Atalhos.ajuda(); return; }
          if (e.target.closest('[data-restaurar]')) { api.body.querySelector('#bk-file').click(); return; }
          if (e.target.closest('[data-sair]')) { api.close(); DB.signOut(); }
        });
      },
    });
  });

  /* ---------- início ---------- */
  let render1 = 0;
  async function iniciar() {
    if (DB.mode === 'erro') return telaErro();
    if (!DB.user) return DB.mode === 'cloud' ? telaLogin() : telaDemo();
    if (DB.mode === 'cloud' && !DB.user.nome) return telaQuemE();
    $app.innerHTML = '<main class="gate"><div class="gate-card"><p class="gate-text">Carregando...</p></div></main>';
    try { await DB.loadAll(); }
    catch (err) { console.error(err); return telaCentral(html`<h1>Não consegui carregar</h1><p class="gate-text">Confira a internet e se o schema.sql foi executado no Supabase.</p><button type="button" class="btn primary block" onclick="location.reload()">Tentar de novo</button>`); }
    DB.subscribe();
    DB.onAtividade = a => { toast(`${a.autor} ${a.texto}`); badge(); };
    montarCasca();
    lerRota(); desenhar(false);
    if (!render1++) {
      window.addEventListener('hashchange', aoMudarRota);
      DB.onChange(t => {
        if (!main) return;
        cancelAnimationFrame(DB._raf);
        DB._raf = requestAnimationFrame(() => {
          if (rota === 'notas') { global.Notas.onData(); badge(); } else desenhar(true);
        });
      });
    }
  }

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', aplicarTema);
  aplicarTema();
  DB.init().then(iniciar).catch(err => { console.error(err); telaErro(); });
})(window);
