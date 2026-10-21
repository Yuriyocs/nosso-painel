/* Camada de dados: Supabase (nuvem) ou localStorage (modo demonstração). */
(function (global) {
  'use strict';
  const U = global.UI;
  const { toast, uid, K, today, addDays, addMonthsKey, dateInMonth, monthKey } = U;
  const CFG = global.CONFIG || {};

  const TABLES = ['lancamentos', 'fixas', 'fixas_pagas', 'parcelados', 'parcelas_pagas', 'cofres', 'cofre_movs', 'tarefas', 'notas', 'compras', 'metas', 'meta_passos', 'bancos', 'cartoes', 'orcamentos', 'listas_compra', 'atividades'];
  const OPCIONAIS = ['bancos', 'cartoes', 'orcamentos', 'listas_compra', 'atividades']; // criadas depois: se faltarem no Supabase, o painel segue funcionando
  const CASCADE = {
    fixas: [['fixas_pagas', 'fixa_id']],
    parcelados: [['parcelas_pagas', 'parcelado_id']],
    cofres: [['cofre_movs', 'cofre_id']],
    metas: [['meta_passos', 'meta_id']],
  };
  const LS_DATA = 'np:demo:dados';
  const LS_USER = 'np:demo:user';

  async function fetchAll(sb, t) {
    if (OPCIONAIS.includes(t)) {
      try { return await fetchTodas(sb, t); } catch (e) { DB.faltaTabela = true; console.warn('Tabela ausente:', t, e); return []; }
    }
    return fetchTodas(sb, t);
  }
  async function fetchTodas(sb, t) {
    const size = 1000; let from = 0, out = [];
    for (;;) {
      const { data, error } = await sb.from(t).select('*').order('id').range(from, from + size - 1);
      if (error) throw error;
      out = out.concat(data || []);
      if (!data || data.length < size) break;
      from += size;
    }
    return out;
  }

  const DB = {
    mode: 'demo', // 'demo' | 'cloud' | 'erro'
    faltaTabela: false,
    sb: null,
    user: null, // { id, email, nome }
    cache: {},
    listeners: new Set(),

    all(t) { return this.cache[t] || []; },
    find(t, id) { return this.all(t).find(x => x.id === id); },
    onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },
    _touch(t) { if (t === '*' || t === 'bancos') this.syncBancos(); this.listeners.forEach(fn => { try { fn(t); } catch (e) { console.error(e); } }); },

    /* bancos personalizados entram nas listas de escolha e ganham cor */
    syncBancos() {
      const base = K.BANCOS_BASE, extras = [];
      this.all('bancos').forEach(b => { if (b.nome && !base.includes(b.nome) && !extras.includes(b.nome)) { extras.push(b.nome); } if (b.nome && b.cor) K.BANCO_COR[b.nome] = b.cor; });
      K.BANCOS.length = 0; K.BANCOS.push(...base, ...extras, 'Dinheiro', 'Outro');
    },

    /* ----- histórico de movimentações (aba Notificações) ----- */
    _log(op, t, row, patch) {
      if (this._mudo || !this.user || !this.user.nome || !global.Atividades) return;
      let d = null;
      try { d = global.Atividades.descrever(op, t, row, patch, this); } catch (e) { console.warn(e); }
      if (d) this.log(d.area, d.texto, d.ref, d.dedupe);
    },
    log(area, texto, ref, dedupe) {
      if (!this.user || !this.user.nome || this.cache.atividades == null) return;
      const autor = this.user.nome;
      if (dedupe && ref) {
        const lim = Date.now() - 30 * 60000;
        if (this.all('atividades').some(x => x.autor === autor && x.ref === ref && x.area === area && new Date(x.criado_em).getTime() > lim)) return;
      }
      const lista = this.cache.atividades;
      if (lista.length > 600) lista.splice(0, lista.length - 500); // só na tela; a nuvem limpa o que é antigo
      this.insert('atividades', { autor, area, texto, ref: ref || null, criado_em: new Date().toISOString() }, { silent: true });
    },
    /* executa várias gravações em seguida avisando só uma vez */
    lote(fn, area, texto) {
      this._mudo = (this._mudo || 0) + 1;
      try { fn(); } finally { this._mudo--; }
      if (texto) this.log(area, texto);
    },
    /* apagar vários de uma vez, com um único "Desfazer" */
    async apagarVarios(itens, msg, area, texto) {
      const copias = itens.map(([t, id]) => { const r = this.find(t, id); return r ? [t, Object.assign({}, r)] : null; }).filter(Boolean);
      if (!copias.length) return;
      const ps = [];
      this.lote(() => itens.forEach(([t, id]) => ps.push(this.remove(t, id))), area, texto || msg);
      U.toast(msg, '', {
        label: 'Desfazer',
        fn: async () => {
          await Promise.all(ps);
          for (const [t, r] of copias) await this.insert(t, r, { silent: true });
          this.log(area, 'desfez: ' + (texto || msg));
          U.toast('Restaurado');
        },
      });
      return Promise.all(ps);
    },

    /* apagar com "Desfazer": guarda a linha (e o que depende dela) e devolve tudo se o usuário voltar atrás */
    async apagar(t, id, msg) {
      const row = this.find(t, id); if (!row) return;
      const filhos = (CASCADE[t] || []).map(([ft, fk]) => [ft, this.all(ft).filter(x => x[fk] === id).map(x => Object.assign({}, x))]);
      const copia = Object.assign({}, row);
      const p = this.remove(t, id);
      U.toast(msg || 'Apagado', '', {
        label: 'Desfazer',
        fn: async () => {
          await p;
          await this.insert(t, copia, { silent: true });
          for (const [ft, rows] of filhos) for (const r of rows) await this.insert(ft, r, { silent: true });
          const d = global.Atividades && global.Atividades.descrever('insert', t, copia, null, this);
          this.log(d ? d.area : 'geral', 'desfez a exclusão: ' + (msg || 'item').toLowerCase());
          U.toast('Restaurado');
        },
      });
      return p;
    },

    /* ----- início ----- */
    async init() {
      TABLES.forEach(t => { this.cache[t] = []; });
      const configurado = !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY);
      if (!configurado) {
        this.mode = 'demo';
        this.syncBancos();
        const nome = U.lsGet(LS_USER);
        if (nome) this.user = { id: 'demo-' + nome, email: '', nome };
        window.addEventListener('storage', e => {
          if (e.key === LS_DATA && e.newValue) { this._loadDemo(); this._touch('*'); }
        });
        return;
      }
      if (!global.supabase) { this.mode = 'erro'; return; }
      this.mode = 'cloud';
      this.sb = global.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true },
      });
      const { data } = await this.sb.auth.getSession();
      if (data && data.session) await this._depoisDoLogin(data.session.user);
      this.sb.auth.onAuthStateChange(evt => { if (evt === 'SIGNED_OUT') location.reload(); });
    },

    async _depoisDoLogin(u) {
      this.user = { id: u.id, email: u.email || '', nome: null };
      const { data } = await this.sb.from('perfis').select('nome').eq('id', u.id).maybeSingle();
      if (data && data.nome) this.user.nome = data.nome;
    },
    async signIn(email, password) {
      const { data, error } = await this.sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await this._depoisDoLogin(data.user);
    },
    async signOut() {
      if (this.mode === 'cloud') { await this.sb.auth.signOut(); return; }
      try { localStorage.removeItem(LS_USER); } catch (e) { /* ignora */ }
      location.reload();
    },
    demoLogin(nome) { U.lsSet(LS_USER, nome); this.user = { id: 'demo-' + nome, email: '', nome }; },
    async nomesEmUso() {
      if (this.mode !== 'cloud') return [];
      const { data } = await this.sb.from('perfis').select('nome');
      return (data || []).map(x => x.nome);
    },
    async setNome(nome) {
      const { error } = await this.sb.from('perfis').insert({ id: this.user.id, nome });
      if (error) throw error;
      this.user.nome = nome;
    },

    /* ----- carga e tempo real ----- */
    async loadAll() {
      if (this.mode === 'cloud') {
        const res = await Promise.all(TABLES.map(t => fetchAll(this.sb, t)));
        TABLES.forEach((t, i) => { this.cache[t] = res[i]; });
      } else {
        this._loadDemo();
      }
      this.syncBancos();
      if (this.mode === 'cloud' && !this._limpou) {
        this._limpou = true;
        const corte = new Date(Date.now() - 90 * 86400000).toISOString();
        Promise.resolve(this.sb.from('atividades').delete().lt('criado_em', corte)).catch(() => {});
      }
    },
    async reload(t) {
      if (this.mode !== 'cloud') return;
      try { this.cache[t] = await fetchAll(this.sb, t); this._touch(t); } catch (e) { console.error(e); }
    },
    subscribe() {
      if (this.mode !== 'cloud') return;
      this.sb.channel('painel')
        .on('postgres_changes', { event: '*', schema: 'public' }, p => this._apply(p))
        .subscribe();
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) this.loadAll().then(() => this._touch('*')).catch(console.error);
      });
    },
    _apply(p) {
      const t = p.table, list = this.cache[t]; if (!list) return;
      if (p.eventType === 'DELETE') {
        const id = p.old && p.old.id; if (!id) return;
        this._removeLocal(t, id);
      } else if (p.new) {
        if (t === 'atividades' && p.eventType === 'INSERT' && this.user && p.new.autor !== this.user.nome && !list.some(x => x.id === p.new.id) && this.onAtividade) this.onAtividade(p.new);
        const i = list.findIndex(x => x.id === p.new.id);
        if (i >= 0) list[i] = Object.assign(list[i], p.new); else list.push(p.new);
      }
      this._touch(t);
    },

    /* ----- gravação (a tela atualiza na hora; a nuvem confirma depois) ----- */
    async insert(t, row, opts) {
      const r = Object.assign({ id: uid() }, row);
      this.cache[t].push(r); this._persist(t);
      if (!(opts && opts.silent)) this._log('insert', t, r);
      if (this.mode === 'cloud') {
        const { error } = await this.sb.from(t).insert(r);
        if (error) { if (t === 'atividades') console.warn('atividades', error); else await this._falha(t, error); }
      }
      return r;
    },
    async update(t, id, patch, opts) {
      const r = this.find(t, id); if (!r) return;
      Object.assign(r, patch); this._persist(t);
      if (!(opts && opts.silent)) this._log('update', t, r, patch);
      if (this.mode === 'cloud') {
        const { error } = await this.sb.from(t).update(patch).eq('id', id);
        if (error) await this._falha(t, error);
      }
    },
    async remove(t, id, opts) {
      const antes = this.find(t, id);
      if (antes && !(opts && opts.silent)) this._log('remove', t, Object.assign({}, antes));
      this._removeLocal(t, id); this._persist(t);
      (CASCADE[t] || []).forEach(([ft]) => this._persist(ft));
      if (this.mode === 'cloud') {
        const { error } = await this.sb.from(t).delete().eq('id', id);
        if (error) await this._falha(t, error);
      }
    },
    _removeLocal(t, id) {
      this.cache[t] = this.cache[t].filter(x => x.id !== id);
      (CASCADE[t] || []).forEach(([ft, fk]) => { this.cache[ft] = this.cache[ft].filter(x => x[fk] !== id); });
    },
    async _falha(t, error) {
      console.error(t, error);
      toast('Não foi possível salvar agora. Atualizando os dados...', 'erro');
      await this.reload(t);
    },
    _persist(t) {
      if (this.mode === 'demo') {
        try { localStorage.setItem(LS_DATA, JSON.stringify(this.cache)); } catch (e) { toast('Sem espaço para salvar neste navegador.', 'erro'); }
      }
      this._touch(t);
    },

    /* ----- modo demonstração ----- */
    _loadDemo() {
      let d = null;
      try { d = JSON.parse(localStorage.getItem(LS_DATA)); } catch (e) { d = null; }
      if (!d) { d = seed(); try { localStorage.setItem(LS_DATA, JSON.stringify(d)); } catch (e) { /* ignora */ } }
      TABLES.forEach(t => { this.cache[t] = d[t] || []; });
    },
    /* restaurar um backup (substitui só as tabelas que o arquivo traz) */
    validarBackup(d) {
      if (!d || typeof d !== 'object' || !d.tabelas || typeof d.tabelas !== 'object') return null;
      const tabelas = TABLES.filter(t => Array.isArray(d.tabelas[t]));
      if (!tabelas.length) return null;
      const linhas = tabelas.reduce((a, t) => a + d.tabelas[t].filter(r => r && typeof r === 'object' && r.id).length, 0);
      return { tabelas, linhas };
    },
    async restaurar(d) {
      const v = this.validarBackup(d); if (!v) throw new Error('Arquivo inválido');
      const limpa = t => d.tabelas[t].filter(r => r && typeof r === 'object' && r.id);
      if (this.mode === 'cloud') {
        for (const t of [...v.tabelas].reverse()) {
          const { error } = await this.sb.from(t).delete().not('id', 'is', null);
          if (error) throw error;
        }
        for (const t of v.tabelas) {
          const rows = limpa(t);
          for (let i = 0; i < rows.length; i += 400) {
            const { error } = await this.sb.from(t).insert(rows.slice(i, i + 400));
            if (error) throw error;
          }
        }
      }
      v.tabelas.forEach(t => { this.cache[t] = limpa(t); });
      this.log('geral', 'restaurou um backup dos dados');
      if (this.mode === 'demo') this._persist('*'); else this._touch('*');
      return v;
    },
    resetDemo(comExemplos) {
      const d = comExemplos ? seed() : Object.fromEntries(TABLES.map(t => [t, []]));
      localStorage.setItem(LS_DATA, JSON.stringify(d));
      TABLES.forEach(t => { this.cache[t] = d[t]; });
      this._touch('*');
    },
  };

  /* ---------- dados de exemplo (só no modo demonstração) ---------- */
  function seed() {
    const [A, B] = K.NOMES;
    const t0 = today(), mk = monthKey(t0), diaHoje = +t0.slice(8, 10);
    const prev = n => addMonthsKey(mk, -n);
    const d = Object.fromEntries(TABLES.map(t => [t, []]));

    d.cartoes.push(
      { id: uid(), banco: 'Nubank', apelido: null, bandeira: 'Mastercard', final: '4821', vencimento: 8, limite: 8000, pessoa: A },
      { id: uid(), banco: 'Itaú', apelido: 'Itaú da Lohrane', bandeira: 'Visa', final: '7710', vencimento: 15, limite: 5000, pessoa: B });
    d.orcamentos.push(
      { id: uid(), categoria: 'Mercado', limite: 600 }, { id: uid(), categoria: 'Alimentação', limite: 250 },
      { id: uid(), categoria: 'Transporte', limite: 120 }, { id: uid(), categoria: 'Saúde', limite: 300 });

    const min = n => new Date(Date.now() - n * 60000).toISOString();
    [[18, 'compras', 'adicionou "Pão de forma" na lista de Mercado'], [55, 'financas', 'lançou uma saída: "Farmácia" (R$ 67,90)'], [190, 'tarefas', 'concluiu a tarefa "Comprar pão e leite"'], [1500, 'financas', 'marcou "Internet" de ' + U.monthLabel(mk) + ' como paga']]
      .forEach(([m, area, texto]) => d.atividades.push({ id: uid(), autor: B, area, texto, ref: null, criado_em: min(m) }));

    const lanc = (tipo, descricao, valor, dia, categoria, banco, pessoa, forma) =>
      d.lancamentos.push({ id: uid(), tipo, descricao, valor, data: dateInMonth(mk, dia), categoria, banco, pessoa, forma, obs: '', criado_por: pessoa });
    lanc('entrada', 'Freela do site', 800, 3, 'Renda extra', 'Nubank', A, 'Pix');
    lanc('saida', 'Mercado do mês', 342.18, 2, 'Mercado', 'Nubank', B, 'Débito');
    lanc('saida', 'Farmácia', 67.9, 4, 'Saúde', 'Itaú', A, 'Débito');
    lanc('saida', 'Jantar fora', 128.5, 6, 'Alimentação', 'Nubank', 'Casal', 'Crédito');
    lanc('saida', 'Uber', 34.7, 7, 'Transporte', 'Nubank', B, 'Crédito');

    const fx = (tipo, descricao, valor, dia, categoria, banco, pessoa) => {
      const f = { id: uid(), tipo, descricao, valor, inicio: dateInMonth(prev(4), dia), fim: null, categoria, banco, pessoa, obs: '' };
      d.fixas.push(f);
      for (let i = 4; i >= 1; i--) d.fixas_pagas.push({ id: uid(), fixa_id: f.id, mes: prev(i) });
      if (dia <= diaHoje) d.fixas_pagas.push({ id: uid(), fixa_id: f.id, mes: mk });
    };
    fx('entrada', 'Salário ' + A, 6500, 5, 'Salário', 'Itaú', A);
    fx('entrada', 'Salário ' + B, 4200, 5, 'Salário', 'Santander', B);
    fx('saida', 'Aluguel', 1800, 10, 'Moradia', 'Itaú', 'Casal');
    fx('saida', 'Internet', 119.9, 15, 'Contas (luz, água, internet)', 'Nubank', A);
    fx('saida', 'Streaming', 55.9, 20, 'Assinaturas', 'Nubank', B);

    const notebook = { id: uid(), descricao: 'Notebook novo', valor_total: 4800, parcelas: 12, primeira: dateInMonth(prev(3), 12), categoria: 'Compras', banco: 'Nubank', pessoa: A, obs: '' };
    const sofa = { id: uid(), descricao: 'Sofá da sala', valor_total: 2100, parcelas: 6, primeira: dateInMonth(prev(1), 20), categoria: 'Moradia', banco: 'Santander', pessoa: 'Casal', obs: '' };
    d.parcelados.push(notebook, sofa);
    [1, 2, 3].forEach(n => d.parcelas_pagas.push({ id: uid(), parcelado_id: notebook.id, numero: n }));
    d.parcelas_pagas.push({ id: uid(), parcelado_id: sofa.id, numero: 1 });

    const reserva = { id: uid(), nome: 'Reserva de emergência', meta: 20000, banco: 'Nubank', pessoa: 'Casal' };
    const viagem = { id: uid(), nome: 'Viagem de fim de ano', meta: 6000, banco: 'Itaú', pessoa: 'Casal' };
    d.cofres.push(reserva, viagem);
    const mov = (c, valor, dias, nota) => d.cofre_movs.push({ id: uid(), cofre_id: c.id, valor, data: addDays(t0, -dias), nota, criado_por: A });
    mov(reserva, 5000, 90, 'Começo da reserva'); mov(reserva, 1500, 45, ''); mov(reserva, 800, 10, 'Sobra do mês');
    mov(viagem, 1200, 30, '');

    const tar = (titulo, responsavel, prazo, prioridade, repete) =>
      d.tarefas.push({ id: uid(), titulo, responsavel, prazo, prioridade, repete, obs: '', feita: false, feita_em: null, feita_por: null, criado_por: A });
    tar('Pagar boleto do condomínio', A, t0, 'alta', 'mensal');
    tar('Comprar pão e leite', B, t0, 'normal', 'nao');
    tar('Marcar dentista', 'Ambos', addDays(t0, 1), 'normal', 'nao');
    tar('Lavar a roupa de cama', B, addDays(t0, 3), 'baixa', 'semanal');
    tar('Pesquisar revisão do carro', A, null, 'normal', 'nao');

    const nota = (titulo, corpo, cor, fixada, minAtras) =>
      d.notas.push({ id: uid(), titulo, corpo, cor, fixada, atualizado_em: new Date(Date.now() - minAtras * 60000).toISOString(), editado_por: A, criado_por: A });
    nota('Ideias de viagem', 'Fim de ano:\n- Praia no Nordeste\n- Serra gaúcha (frio!)\n\nVer passagens em novembro.', 'sky', true, 60 * 26);
    nota('Lista do mercado', 'Arroz\nFeijão\nOvos\nCafé\nPapel higiênico', 'sage', false, 25);

    const compra = (lista, nome, qtd, secao, comprado) =>
      d.compras.push({ id: uid(), lista, nome, qtd, secao, comprado, comprado_em: comprado ? new Date().toISOString() : null, adicionado_por: B, criado_em: new Date(Date.now() + d.compras.length).toISOString() });
    compra('Mercado', 'Tomate', '1 kg', 'Hortifruti', false);
    compra('Mercado', 'Banana', '6', 'Hortifruti', false);
    compra('Mercado', 'Pão de forma', '', 'Padaria', false);
    compra('Mercado', 'Leite', '2 caixas', 'Frios e laticínios', false);
    compra('Mercado', 'Arroz', '5 kg', 'Mercearia', true);
    compra('Mercado', 'Detergente', '', 'Limpeza', false);
    compra('Farmácia', 'Vitamina D', '', 'Higiene', false);

    const meta = (titulo, categoria, prazo, cofre, concluida) => { const m = { id: uid(), titulo, categoria, prazo, cofre_id: cofre ? cofre.id : null, obs: '', concluida, concluida_em: concluida ? new Date().toISOString() : null, criado_por: A }; d.metas.push(m); return m; };
    meta('Viagem de fim de ano', 'Viagem', addDays(t0, 70), viagem, false);
    meta('Reserva de emergência de 6 meses', 'Finanças', null, reserva, false);
    const casa = meta('Reorganizar a casa', 'Casa', addDays(t0, 25), null, false);
    [['Doar o que não usamos', true], ['Montar a estante do escritório', true], ['Trocar as cortinas da sala', false], ['Pintar o quarto', false]].forEach(([texto, feito]) =>
      d.meta_passos.push({ id: uid(), meta_id: casa.id, texto, feito, criado_em: new Date().toISOString() }));

    return d;
  }

  global.DB = DB;
})(window);
