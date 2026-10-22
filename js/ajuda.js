/* Ajuda: explicação curta de cada tela e passo a passo dos processos, sempre a um clique ("Como usar"). */
(function (global) {
  'use strict';
  const U = global.UI;
  const { html, icon, on, openModal } = U;

  const TELAS = {
    inicio: {
      nome: 'Início',
      resumo: 'Um retrato do dia: finanças do mês, o que vence, tarefas, compras, metas e notas recentes.',
      topicos: [
        ['O que cada cartão mostra', ['Finanças: quanto sobra no mês, entradas, saídas e quanto ainda falta pagar.', 'Próximos meses: gráfico de entradas e saídas. Clique numa barra para abrir aquele mês.', 'Vencimentos, Tarefas, Compras, Metas e Notas: um resumo de cada área com atalho para abrir.']],
        ['Como ir para outra tela', ['No computador, use o menu da esquerda. No celular, a barra de baixo (o botão Mais mostra o resto).', 'Também dá para clicar em "Abrir" em qualquer cartão.']],
      ],
    },
    'financas/mes': {
      nome: 'Finanças · Mês',
      resumo: 'Tudo que entra e sai em cada mês, com o quanto sobra, o que falta pagar e para onde o dinheiro foi.',
      topicos: [
        ['Como lançar uma entrada ou saída', ['Clique em "Lançar" (ou aperte N no computador).', 'Escolha Saída ou Entrada, digite o nome e o valor.', 'Escolha se é avulso, todo mês (conta fixa) ou parcelado.', 'Informe banco, de quem é e a categoria. Toque em Salvar.']],
        ['Como lançar uma compra parcelada', ['Em "Lançar", escolha Parcelado.', 'Cole o valor total e digite a quantidade de parcelas.', 'O painel divide e coloca cada parcela no mês certo, já aparecendo nos meses seguintes.']],
        ['Como marcar como pago ou recebido', ['Toque no círculo à esquerda do lançamento.', 'Ele sai de "A pagar" e vai para a aba "Pagos". Toque de novo para desfazer.']],
        ['Como navegar em listas longas', ['A lista fica dividida em duas abas: "A pagar" (ou "A receber") e "Pagos". Toque na aba para trocar.', 'Cada aba mostra 15 itens por vez. Toque em "Mostrar mais" no fim da lista para ver os próximos.', 'Ao trocar de mês, de filtro ou de aba, a lista volta para os 15 primeiros.']],
        ['Como importar a fatura em aberto (app Bradesco Cartões)', ['Use o mesmo botão "Importar fatura ou extrato" com o PDF do "Extrato em aberto".', 'O arquivo não traz vencimento: o painel calcula pelo cartão cadastrado (confira a data).', 'Quando a fatura fechar, importe a versão final: o que já foi lançado vem marcado e não duplica.']],
        ['Como importar o extrato da conta (Itaú ou Santander)', ['Clique em "Importar fatura ou extrato" e escolha o PDF do extrato. O painel reconhece sozinho se é fatura ou extrato.', 'Aplicações/resgates (cofrinhos), transferências entre vocês e pagamentos de fatura vêm desmarcados, para o mesmo dinheiro não contar duas vezes.', 'Confira o nome, a categoria e de quem é cada linha, e clique em "Lançar". Movimentações já lançadas (mesma data, tipo e valor) vêm marcadas como "já lançada".']],
        ['Como importar a fatura do cartão', ['Clique em "Importar fatura" e solte o arquivo (PDF de Bradesco, Itaú ou Nubank, ou o CSV do Nubank).', 'Confira a lista: dá para desmarcar, renomear e trocar categoria e pessoa.', 'Clique em "Lançar". O que já existia vem desmarcado, então nada duplica.']],
        ['Fatura: pagamento da fatura anterior', ['Linhas como "PAGTO ANTECIPADO" ou "PAGAMENTO" são o pagamento da fatura passada, não dinheiro que entrou. Elas vêm desmarcadas: deixe assim.', 'As compras contam como gasto do mês em que a fatura fecha. O dinheiro sai da conta no vencimento, e o painel concilia isso sozinho.', 'Errou uma importação? Em Ajustes > "Apagar por área", marque só "lançamentos" e importe de novo.']],
        ['Conta x cartão: como a fatura é contada', ['"Gasto no cartão" mostra as compras cuja fatura fecha no mês. A fatura que fecha em setembro é gasto de setembro, mesmo sendo paga em outubro.', '"Na conta" mostra entradas menos débito/pix menos a fatura que vence no mês, que é quando o dinheiro sai de verdade.', 'Assim o mesmo valor não é contado duas vezes. O "PAGTO" que aparece na fatura seguinte é ignorado: já está conciliado.', 'Cadastre o cartão com vencimento e fechamento em Cartões. Importar a fatura já faz isso sozinho.']],
        ['Como filtrar e buscar', ['Use Tudo, Entradas e Saídas para separar o que entra do que sai.', 'Escolha a pessoa e o banco nos filtros.', 'Use o campo Buscar (tecla /) para achar um lançamento pelo nome.']],
        ['Como editar ou apagar', ['Toque no lançamento, altere e salve, ou use Excluir.', 'Se apagar sem querer, clique em "Desfazer" no aviso que aparece.']],
      ],
    },
    'financas/cartoes': {
      nome: 'Finanças · Cartões',
      resumo: 'Seus cartões de crédito como cartões de verdade: fatura do mês, limite, vencimento e o que falta pagar.',
      topicos: [
        ['Como cadastrar um cartão', ['Clique em "Novo cartão".', 'Escolha o banco (ou "Outro banco" para criar um novo com a cor que quiser).', 'Informe bandeira, final, dia do vencimento, limite (opcional) e de quem é.', 'As compras no crédito desse banco entram sozinhas na fatura.']],
        ['Como ver e pagar a fatura', ['Troque o mês pelas setas.', 'Clique em "Ver lançamentos" para ver as compras da fatura.', 'Ao pagar, clique em "Marcar como paga": todos os itens da fatura ficam pagos de uma vez.']],
        ['Como criar ou mudar a cor de um banco', ['Clique em "Bancos".', 'Mude a cor no seletor ao lado do nome, ou adicione um banco novo no fim da janela.']],
      ],
    },
    'financas/orcamento': {
      nome: 'Finanças · Orçamento',
      resumo: 'Quanto vocês querem gastar por mês em cada categoria, com alertas quando estiver chegando perto.',
      topicos: [
        ['Como definir um limite', ['Clique em "Novo limite" ou em "Definir limite" ao lado da categoria.', 'Digite o valor mensal e salve. O limite vale para todos os meses.']],
        ['Como começar rápido', ['Clique em "Sugerir limites": o painel cria um limite para cada categoria usando a média dos últimos 3 meses.', 'Depois ajuste o que quiser tocando na categoria.']],
        ['Como ler os alertas', ['Verde: dentro do limite. Amarelo: já passou de 80%. Vermelho: estourou.', 'Em "Ritmo do mês" aparece quanto ainda dá para gastar por dia.']],
      ],
    },
    'financas/fixas': {
      nome: 'Finanças · Fixas',
      resumo: 'Contas e entradas que se repetem todo mês, como aluguel, internet e salário. Aparecem sozinhas em cada mês.',
      topicos: [
        ['Como cadastrar uma conta fixa', ['Clique em "Nova fixa" (ou em Lançar e escolha Todo mês).', 'Informe nome, valor, o dia do mês e o banco.', 'Ela passa a aparecer em todos os meses a partir da data de início.']],
        ['Como marcar como paga', ['No mês, toque no círculo da conta. Cada mês é marcado separadamente.']],
        ['Como encerrar uma conta fixa', ['Toque na conta, preencha "Termina em" e salve. Os meses depois dela deixam de mostrar a conta.']],
      ],
    },
    'financas/parcelados': {
      nome: 'Finanças · Parcelados',
      resumo: 'Compras divididas em parcelas: quanto já foi pago, quanto falta e quando termina.',
      topicos: [
        ['Como cadastrar', ['Clique em "Nova compra".', 'Cole o valor total e digite o número de parcelas e a data da primeira.']],
        ['Como marcar parcelas pagas', ['Toque na compra e marque cada parcela como paga. Também dá para marcar direto na aba Mês.']],
      ],
    },
    'financas/guardado': {
      nome: 'Finanças · Guardado',
      resumo: 'Cofres para o dinheiro guardado: reserva de emergência, viagem, troca de carro...',
      topicos: [
        ['Como criar um cofre', ['Clique em "Novo cofre", dê um nome e, se quiser, uma meta de valor.']],
        ['Como guardar ou retirar dinheiro', ['No cofre, toque em "Guardar" ou "Retirar", digite o valor e salve. O histórico aparece ao lado.']],
        ['Como ligar a uma meta do casal', ['Em Metas, ao criar ou editar uma meta, escolha o cofre. O progresso acompanha o dinheiro guardado.']],
      ],
    },
    calendario: {
      nome: 'Calendário',
      resumo: 'Os vencimentos do mês em um calendário: contas, parcelas e entradas por dia.',
      topicos: [
        ['Como ler', ['Pontinho vermelho: conta a pagar. Cinza: já pago ou lançado. Verde: entrada.', 'O dia de hoje fica destacado. Dias atrasados ficam em vermelho.']],
        ['Como ver e pagar', ['Toque num dia para ver os detalhes ao lado.', 'Toque no círculo de um item para marcar como pago.']],
        ['Como ver tarefas e metas também', ['Ligue o botão "Tarefas e metas" abaixo do calendário.']],
      ],
    },
    tarefas: {
      nome: 'Tarefas',
      resumo: 'A lista de afazeres do casal, com responsável, data e repetição.',
      topicos: [
        ['Como adicionar uma tarefa', ['Digite o que precisa ser feito no campo "Nova tarefa".', 'Em "Quem vai fazer", escolha Yuri, Lohrane ou os dois.', 'Em "Para quando", escolha hoje, amanhã, sem data ou outro dia (abre o calendário).', 'Confira o resumo embaixo e clique em "Adicionar tarefa".']],
        ['Como repetir uma tarefa', ['Em "Mais opções", escolha Todo dia, Toda semana ou Todo mês.', 'Ao concluir, a próxima já é criada sozinha. A tarefa precisa ter data.']],
        ['Como concluir, editar ou apagar', ['Toque no círculo para concluir.', 'Toque no nome da tarefa para editar ou excluir.']],
        ['Como ver só as suas', ['Use "Ver tarefas de" para filtrar por pessoa. Tarefas "dos dois" aparecem para ambos.']],
      ],
    },
    compras: {
      nome: 'Compras',
      resumo: 'Listas de compras compartilhadas em tempo real: o que um adiciona, o outro vê na hora.',
      topicos: [
        ['Como adicionar um item', ['Escolha a lista (Mercado, Farmácia...).', 'Digite o item e, se quiser, a quantidade. Aperte Enter.', 'Se já comprou antes, o painel lembra a seção e a quantidade.']],
        ['Como usar no mercado', ['Toque no círculo ao pegar o item: ele vai para "No carrinho".', 'Ao terminar, clique em "Limpar comprados".']],
        ['Como criar uma sublista dentro da lista', ['Abra a lista (ex.: Mercado) e clique em "Sublista".', 'Dê um nome (ex.: Feira, Compra do mês). Ela vira um botão acima do campo de item.', 'Escolha a sublista antes de digitar o item: ele entra nela. "Todas" mostra tudo junto, "Geral" os itens sem sublista.', 'A lixeira, com uma sublista escolhida, exclui só ela e os itens dela.']],
        ['Como preencher a quantidade', ['O campo de quantidade aceita só números (ex.: 2 ou 1,5). Letras são ignoradas.']],
        ['Como criar outra lista', ['Clique em "Nova lista", dê um nome (ex.: Churrasco) e confirme. Ela aparece junto das outras.']],
        ['Como esvaziar ou excluir uma lista', ['Clique na lixeira ao lado do nome da lista.', 'Listas padrão são esvaziadas; listas que você criou são excluídas. Se foi sem querer, use "Desfazer".']],
        ['Como enviar a lista', ['Clique em "Copiar" e cole no WhatsApp.']],
      ],
    },
    metas: {
      nome: 'Metas',
      resumo: 'Os planos do casal: viagem, reserva, trocar de carro. Cada meta pode ter prazo, passos e um cofre.',
      topicos: [
        ['Como criar uma meta', ['Clique em "Nova meta", dê um título, escolha o tipo e, se quiser, um prazo.']],
        ['Como acompanhar', ['Adicione passos e marque conforme avançam.', 'Ou ligue a meta a um cofre de Finanças: o progresso acompanha o dinheiro guardado.']],
        ['Como concluir', ['Abra a meta e clique em "Concluir meta". Ela vai para a aba Concluídas.']],
      ],
    },
    notas: {
      nome: 'Notas',
      resumo: 'Bloco de notas compartilhado para qualquer assunto, com salvamento automático.',
      topicos: [
        ['Como criar e editar', ['Clique em "Nova nota" e escreva. Tudo é salvo sozinho.', 'Quando um editar, o outro vê a mudança.']],
        ['Como organizar', ['Dê uma cor à nota e fixe as importantes no topo.', 'Use a busca para achar por título ou texto.']],
        ['Como apagar', ['Abra a nota e toque na lixeira. Dá para desfazer logo em seguida.']],
      ],
    },
    notificacoes: {
      nome: 'Notificações',
      resumo: 'O que cada um fez no painel: lançamentos, tarefas, compras, notas e metas.',
      topicos: [
        ['Como funciona', ['Tudo que um faz fica registrado aqui para o outro ver.', 'O número no menu mostra o que chegou desde a última vez que você abriu esta aba.', 'Com o painel aberto, um aviso aparece na hora quando o outro faz algo.']],
        ['Como filtrar', ['Escolha "De Lohrane", "Minhas" ou "Dos dois".', 'Filtre também por área: Finanças, Tarefas, Compras, Notas, Metas.']],
        ['Como ir até o item', ['Toque numa notificação para abrir a tela correspondente.']],
      ],
    },
  };

  const ORDEM = ['inicio', 'financas/mes', 'financas/cartoes', 'financas/orcamento', 'financas/fixas', 'financas/parcelados', 'financas/guardado', 'calendario', 'tarefas', 'compras', 'metas', 'notas', 'notificacoes'];

  function chaveAtual() {
    const p = location.hash.replace(/^#\/?/, '').split('/');
    const r = p[0] || 'inicio';
    if (r === 'financas') { const s = ['cartoes', 'orcamento', 'fixas', 'parcelados', 'guardado'].includes(p[1]) ? p[1] : 'mes'; return 'financas/' + s; }
    return TELAS[r] ? r : 'inicio';
  }

  function topicosHtml(t, abertos) {
    return html`${t.topicos.map(([titulo, passos], i) => html`<details class="help-topic"${abertos && i === 0 ? ' open' : ''}>
      <summary>${titulo}</summary>
      <ol>${passos.map(p => html`<li>${p}</li>`)}</ol></details>`)}`;
  }

  function abrir(chave) {
    const t = TELAS[chave] || TELAS.inicio;
    openModal({
      title: 'Como usar: ' + t.nome, wide: false,
      body: html`<p class="help-lead">${t.resumo}</p>${topicosHtml(t, true)}
        <div class="modal-actions"><button type="button" class="btn ghost" data-help-todas>Ver ajuda de outras telas</button></div>`,
      onMount(api) { api.el.addEventListener('click', e => { if (e.target.closest('[data-help-todas]')) { api.close(); central(); } }); },
    });
  }

  function central() {
    openModal({
      title: 'Central de ajuda',
      body: html`<p class="help-lead">Escolha a tela para ver o que ela faz e como usar. Em qualquer tela, o botão "Como usar" ao lado do título abre a ajuda dela.</p>
        <ul class="help-list">${ORDEM.map(k => html`<li><button type="button" class="help-item" data-help="${k}"><strong>${TELAS[k].nome}</strong><span>${TELAS[k].resumo}</span></button></li>`)}</ul>
        <div class="modal-actions"><button type="button" class="btn ghost" data-help-atalhos>${icon('keyboard', 16)}Atalhos do teclado</button></div>`,
      onMount(api) {
        api.el.addEventListener('click', e => {
          const b = e.target.closest('[data-help]'); if (b) { api.close(); abrir(b.dataset.help); return; }
          if (e.target.closest('[data-help-atalhos]')) { api.close(); global.Atalhos.ajuda(); }
        });
      },
    });
  }

  /* Coloca o botão "Como usar" e a explicação curta em toda tela, mesmo depois de ela se redesenhar. */
  function decorar(main) {
    const head = main.querySelector('.page-head, .home-head');
    if (!head || head.querySelector('.help-btn')) return;
    const chave = chaveAtual(), t = TELAS[chave]; if (!t) return;
    const h1 = head.querySelector('h1'); if (!h1) return;
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'help-btn'; b.dataset.act = 'ajuda:abrir'; b.dataset.k = chave;
    b.setAttribute('aria-label', 'Como usar ' + t.nome);
    b.innerHTML = String(icon('help', 16)) + '<span>Como usar</span>';
    if (head.classList.contains('home-head')) { const alvo = h1.parentElement; alvo.appendChild(b); b.style.marginLeft = '0'; return; }
    const wrap = document.createElement('div'); wrap.className = 'head-title';
    h1.insertAdjacentElement('beforebegin', wrap); wrap.appendChild(h1); wrap.appendChild(b);
    const d = document.createElement('p');
    d.className = 'page-desc'; d.textContent = t.resumo;
    const tabs = head.querySelector('.subtabs');
    if (tabs) tabs.insertAdjacentElement('beforebegin', d); else head.appendChild(d);
  }
  function iniciar(main) {
    new MutationObserver(() => decorar(main)).observe(main, { childList: true, subtree: false });
    decorar(main);
  }

  on('ajuda:abrir', el => abrir(el.dataset.k));
  on('ajuda:central', () => central());

  global.Ajuda = { iniciar, decorar, abrir, central };
})(window);
