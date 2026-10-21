/* Descreve, em português, o que cada pessoa fez (alimenta a aba Notificações). */
(function (global) {
  'use strict';
  const U = global.UI;
  const q = s => `"${String(s == null ? '' : s).trim() || 'sem nome'}"`;
  const mes = mk => (mk ? U.monthLabel(mk) : '');

  /* devolve { area, texto, ref?, dedupe? } ou null quando não vale avisar */
  function descrever(op, t, r, patch, DB) {
    const ins = op === 'insert', upd = op === 'update', del = op === 'remove';
    const so = k => patch && Object.keys(patch).length === 1 && k in patch;
    const F = 'financas';
    switch (t) {
      case 'lancamentos': {
        const ent = r.tipo === 'entrada';
        if (ins) return { area: F, texto: `${ent ? 'registrou uma entrada' : 'lançou uma saída'}: ${q(r.descricao)} (${U.fmt(r.valor)})${r.pago === false ? ', ' + (ent ? 'a receber' : 'a pagar') : ''}` };
        if (upd && so('pago')) return { area: F, texto: `marcou ${q(r.descricao)} como ${r.pago ? (ent ? 'recebida' : 'paga') : (ent ? 'a receber' : 'a pagar')}` };
        if (upd) return { area: F, texto: `editou o lançamento ${q(r.descricao)}` };
        if (del) return { area: F, texto: `excluiu o lançamento ${q(r.descricao)} (${U.fmt(r.valor)})` };
        break;
      }
      case 'fixas': {
        const ent = r.tipo === 'entrada', nome = ent ? 'a entrada fixa' : 'a conta fixa';
        if (ins) return { area: F, texto: `cadastrou ${nome} ${q(r.descricao)} (${U.fmt(r.valor)} por mês)` };
        if (upd) return { area: F, texto: `editou ${nome} ${q(r.descricao)}` };
        if (del) return { area: F, texto: `excluiu ${nome} ${q(r.descricao)}` };
        break;
      }
      case 'fixas_pagas': {
        const f = DB.find('fixas', r.fixa_id); if (!f) return null;
        if (ins) return { area: F, texto: `marcou ${q(f.descricao)} de ${mes(r.mes)} como ${f.tipo === 'entrada' ? 'recebida' : 'paga'}` };
        if (del) return { area: F, texto: `desmarcou ${q(f.descricao)} de ${mes(r.mes)}` };
        break;
      }
      case 'parcelados': {
        if (ins) return { area: F, texto: `cadastrou a compra parcelada ${q(r.descricao)} (${r.parcelas}x de ${U.fmt(+r.valor_total / +r.parcelas)})` };
        if (upd) return { area: F, texto: `editou a compra parcelada ${q(r.descricao)}` };
        if (del) return { area: F, texto: `excluiu a compra parcelada ${q(r.descricao)}` };
        break;
      }
      case 'parcelas_pagas': {
        const p = DB.find('parcelados', r.parcelado_id); if (!p) return null;
        if (ins) return { area: F, texto: `pagou a parcela ${r.numero}/${p.parcelas} de ${q(p.descricao)}` };
        if (del) return { area: F, texto: `desmarcou a parcela ${r.numero}/${p.parcelas} de ${q(p.descricao)}` };
        break;
      }
      case 'cofres':
        if (ins) return { area: F, texto: `criou o cofre ${q(r.nome)}` };
        if (upd) return { area: F, texto: `editou o cofre ${q(r.nome)}` };
        if (del) return { area: F, texto: `excluiu o cofre ${q(r.nome)}` };
        break;
      case 'cofre_movs': {
        const c = DB.find('cofres', r.cofre_id); if (!c) return null;
        if (ins) return { area: F, texto: +r.valor >= 0 ? `guardou ${U.fmt(r.valor)} em ${q(c.nome)}` : `retirou ${U.fmt(-r.valor)} de ${q(c.nome)}` };
        if (del) return { area: F, texto: `apagou uma movimentação do cofre ${q(c.nome)}` };
        break;
      }
      case 'cartoes': {
        const n = `${r.banco}${r.final ? ' final ' + r.final : ''}`;
        if (ins) return { area: F, texto: `cadastrou o cartão ${n}` };
        if (upd) return { area: F, texto: `editou o cartão ${n}` };
        if (del) return { area: F, texto: `excluiu o cartão ${n}` };
        break;
      }
      case 'bancos':
        if (ins) return { area: F, texto: `adicionou o banco ${q(r.nome)}` };
        if (del) return { area: F, texto: `excluiu o banco ${q(r.nome)}` };
        break;
      case 'orcamentos':
        if (ins) return { area: F, texto: `definiu o limite de ${q(r.categoria)}: ${U.fmt(r.limite)} por mês` };
        if (upd) return { area: F, texto: `alterou o limite de ${q(r.categoria)} para ${U.fmt(r.limite)}` };
        if (del) return { area: F, texto: `removeu o limite de ${q(r.categoria)}` };
        break;
      case 'tarefas': {
        const eu = DB.user && DB.user.nome;
        if (ins) return { area: 'tarefas', texto: `adicionou a tarefa ${q(r.titulo)}${r.responsavel && r.responsavel !== eu ? ' para ' + (r.responsavel === 'Ambos' ? 'os dois' : r.responsavel) : ''}${r.prazo ? ' (' + U.dateLabel(r.prazo) + ')' : ''}` };
        if (upd && patch && 'feita' in patch) return { area: 'tarefas', texto: `${r.feita ? 'concluiu' : 'reabriu'} a tarefa ${q(r.titulo)}` };
        if (upd) return { area: 'tarefas', texto: `editou a tarefa ${q(r.titulo)}` };
        if (del) return { area: 'tarefas', texto: `excluiu a tarefa ${q(r.titulo)}` };
        break;
      }
      case 'notas':
        if (ins) return { area: 'notas', texto: 'criou uma nova nota', ref: r.id };
        if (upd) return { area: 'notas', texto: `editou a nota ${q(r.titulo || 'sem título')}`, ref: r.id, dedupe: true };
        if (del) return { area: 'notas', texto: `excluiu a nota ${q(r.titulo || 'sem título')}` };
        break;
      case 'compras': {
        if (ins) return { area: 'compras', texto: `adicionou ${q(r.nome)}${r.qtd ? ' (' + r.qtd + ')' : ''} na lista de ${r.lista || 'Mercado'}${r.sublista ? ' › ' + r.sublista : ''}` };
        if (upd && patch && 'comprado' in patch) return { area: 'compras', texto: r.comprado ? `marcou ${q(r.nome)} como comprado` : `devolveu ${q(r.nome)} para a lista de ${r.lista || 'Mercado'}` };
        if (upd) return { area: 'compras', texto: `editou o item ${q(r.nome)}` };
        if (del) return { area: 'compras', texto: `removeu ${q(r.nome)} da lista de ${r.lista || 'Mercado'}` };
        break;
      }
      case 'listas_compra':
        if (r.pai) return ins ? { area: 'compras', texto: `criou a sublista ${q(r.nome)} na lista ${q(r.pai)}` } : del ? { area: 'compras', texto: `excluiu a sublista ${q(r.nome)} da lista ${q(r.pai)}` } : null;
        if (ins) return { area: 'compras', texto: `criou a lista de compras ${q(r.nome)}` };
        if (del) return { area: 'compras', texto: `excluiu a lista de compras ${q(r.nome)}` };
        break;
      case 'metas':
        if (ins) return { area: 'metas', texto: `criou a meta ${q(r.titulo)}` };
        if (upd && patch && 'concluida' in patch) return { area: 'metas', texto: `${r.concluida ? 'concluiu' : 'reabriu'} a meta ${q(r.titulo)}` };
        if (upd) return { area: 'metas', texto: `editou a meta ${q(r.titulo)}` };
        if (del) return { area: 'metas', texto: `excluiu a meta ${q(r.titulo)}` };
        break;
      case 'meta_passos': {
        const m = DB.find('metas', r.meta_id); if (!m) return null;
        if (ins) return { area: 'metas', texto: `adicionou o passo ${q(r.texto)} na meta ${q(m.titulo)}` };
        if (upd && patch && 'feito' in patch) return { area: 'metas', texto: `marcou o passo ${q(r.texto)} como ${r.feito ? 'feito' : 'pendente'} (meta ${q(m.titulo)})` };
        if (del) return { area: 'metas', texto: `removeu o passo ${q(r.texto)} da meta ${q(m.titulo)}` };
        break;
      }
      default: break;
    }
    return null;
  }

  global.Atividades = { descrever };
})(window);
