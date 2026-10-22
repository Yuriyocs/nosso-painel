# Nosso Painel

Painel pessoal do Yuri e da Lohrane: **finanças**, **calendário de vencimentos**, **tarefas do dia a dia**, **lista de compras**, **metas do casal** e **notas**.
Cada um entra com o próprio login, os dados são compartilhados e aparecem na tela do outro em tempo real.

- Site estático (HTML, CSS e JavaScript puro, sem instalar nada para rodar).
- Dados e login no **Supabase** (plano gratuito).
- Hospedagem gratuita no **GitHub Pages** (ou Cloudflare Pages / Netlify).

## Testar agora, sem configurar nada

Abra o `index.html` no navegador. Enquanto o `js/config.js` estiver vazio, o painel roda em
**modo demonstração**: escolhe "Yuri" ou "Lohrane", já vem com dados de exemplo e tudo fica salvo só naquele navegador.
Em Ajustes dá para apagar os exemplos e começar do zero.

## Colocar no ar de verdade (uns 20 minutos)

### 1. Criar o banco (Supabase)

1. Crie uma conta em <https://supabase.com> e clique em **New project**. Escolha um nome, uma senha de banco (guarde) e a região mais próxima (por exemplo, São Paulo).
2. Com o projeto pronto, abra **SQL Editor**, clique em **New query**, cole o conteúdo do arquivo `supabase/schema.sql` e clique em **Run**. Isso cria as tabelas, as regras de segurança e o tempo real. (O arquivo pode ser executado de novo sem problema: se vocês já tinham rodado uma versão anterior, rodem outra vez para criar as tabelas de compras e metas.)
3. **Desligue o cadastro aberto** (importante): em **Authentication**, procure as configurações de login (**Sign In / Providers**) e desative **Allow new users to sign up**. Assim ninguém além de vocês consegue criar conta.
4. Crie os dois usuários: em **Authentication > Users**, clique em **Add user** (Create new user), informe e-mail e senha, e marque a opção de confirmar o e-mail automaticamente (**Auto Confirm User**). Faça isso uma vez para o Yuri e outra para a Lohrane.
5. Pegue os dados de conexão em **Project Settings > API** (ou **API Keys**): a **Project URL** e a chave **anon / publishable**.

> Os nomes dos menus do Supabase mudam de vez em quando. Se algo não estiver exatamente onde está escrito, procure por termo parecido.

### 2. Ligar o site ao banco

Edite `js/config.js` e preencha:

```js
SUPABASE_URL: "https://xxxxxxxx.supabase.co",
SUPABASE_ANON_KEY: "a-chave-anon-ou-publishable",
```

A chave anon pode ficar no código: quem protege os dados é o login e as regras do `schema.sql`. **Nunca** use a chave `service_role` aqui.

### 3. Publicar no GitHub Pages

1. Crie uma conta em <https://github.com> e um repositório novo (por exemplo, `nosso-painel`).
2. Envie todos os arquivos desta pasta para o repositório (pelo botão **Add file > Upload files**, ou com `git`).
3. No repositório, abra **Settings > Pages**. Em **Build and deployment**, escolha **Deploy from a branch**, branch `main`, pasta `/ (root)`, e salve.
4. Em um ou dois minutos o endereço aparece lá: `https://SEU-USUARIO.github.io/nosso-painel/`.

Observações sobre o GitHub Pages:

- No plano gratuito do GitHub, o Pages costuma exigir repositório **público**. Isso expõe só o código do site, não os dados: eles ficam no Supabase, atrás de login. Por isso o `config.js` não leva senha nenhuma.
- A documentação do GitHub diz que o Pages não deve ser usado para transações sensíveis, como receber senhas ou cartões. Aqui o site não processa senha: o login é feito direto com o Supabase. Se preferir não ficar nessa zona cinzenta, hospede a mesma pasta no **Cloudflare Pages** ou no **Netlify** (ambos gratuitos para sites estáticos e aceitam repositório privado): é só conectar o repositório e deixar o comando de build e a pasta de saída em branco.
- O site tem `noindex`, então não aparece em buscadores, mas quem souber o endereço consegue ver a tela de login.

### 4. Primeiro acesso

Abra o endereço, entre com e-mail e senha e escolha seu nome (Yuri ou Lohrane) uma única vez. No celular, abra no navegador e use **Adicionar à tela inicial**: o painel vira um app.

## Limites do plano gratuito (conferidos em outubro de 2026)

- **Supabase:** banco de 500 MB, 1 GB de arquivos, 50.000 usuários ativos por mês. O projeto é **pausado após 7 dias sem uso**; para dois usuários que abrem o painel de vez em quando isso quase nunca acontece, e dá para despausar pelo painel do Supabase.
- **GitHub Pages:** site de até 1 GB e 100 GB de tráfego por mês (limite flexível). Sobra muito.

Fonte: [Supabase Pricing](https://supabase.com/pricing) e [limites do GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits). Limites e preços podem mudar; vale uma olhada de vez em quando.

### Opcional: não deixar o Supabase pausar nas férias

O arquivo `.github/workflows/manter-ativo.yml` dá uma "cutucada" no banco duas vezes por semana. Para ativar, cadastre dois *secrets* no repositório (**Settings > Secrets and variables > Actions**): `SUPABASE_URL` e `SUPABASE_ANON_KEY`, com os mesmos valores do `config.js`. O GitHub desliga agendamentos de repositórios parados há 60 dias, então isso ajuda em ausências curtas, não em meses.

## Como o painel funciona

**Finanças**
- **Mês:** sobra prevista, entradas, saídas e quanto falta pagar. A barra colorida mostra quanto cada um gastou.
  - O seletor **Tudo / Entradas / Saídas** filtra a lista (com a contagem de cada uma). Entradas aparecem em verde com seta para cima e etiqueta "Entrada"; saídas em vermelho com seta para baixo e etiqueta "Saída". Ao filtrar, cada bloco mostra o total (a pagar, pagas, a receber, recebidas).
  - Dá para filtrar também por pessoa e por banco, ver para onde o dinheiro foi (ou de onde veio) por categoria, banco ou pessoa, e exportar o mês em CSV (abre no Excel).
- **Lançar:** um único botão cria uma saída ou entrada **avulsa**, **todo mês** (aluguel, salário, internet) ou **parcelada** (cole o valor total e a quantidade de parcelas; o painel distribui nos meses certos).
- **Importar fatura:** em Finanças, botão **Importar fatura**. Aceita o PDF da fatura do **Bradesco**, do **Itaú** e do **Nubank**, e o CSV do Nubank. Confira a lista (dá para desmarcar, renomear e trocar categoria e pessoa de cada item) e lance tudo de uma vez. O arquivo é lido no próprio navegador, não é enviado nem guardado. A soma é conferida com o total da fatura. Para o CSV, o vencimento vem do nome do arquivo (ex.: `Nubank_2026-08-08.csv`) e pode ser corrigido na tela.
- **Parcelas dos próximos meses:** uma compra "5/12" vira uma **compra parcelada** completa: as parcelas 1 a 5 ficam como pagas e as 7 restantes entram nos meses seguintes como "falta pagar". Dá para desligar essa opção na tela de importação.
- **Sem lançar em duplicidade:** ao importar, o que já existe com o **mesmo nome e valor** no mesmo mês (ou a mesma compra parcelada) vem desmarcado. Coisas parecidas de outro mês (assinaturas, por exemplo) só ganham um aviso. No lançamento manual, o painel pergunta se quer lançar mesmo assim. Reimportar o mesmo arquivo não duplica nada.
- **Telas largas:** em monitor grande, cada tela usa o espaço inteiro: lista à esquerda e painéis à direita (para onde foi o dinheiro, próximos meses, maiores gastos, fixas por categoria, vencimentos por mês, últimas movimentações do guardado). No celular tudo empilha.
- **Gráfico dos próximos meses:** barras de entradas e saídas com a sobra de cada mês (inclui fixas e parcelas já lançadas). Clique numa barra para abrir aquele mês. O mês mostra também a variação das saídas em relação ao mês anterior.
- **Lista do mês em abas:** "A pagar" e "Pagos" ficam separadas e mostram 15 itens por vez, com o botão "Mostrar mais" (nada de número de página, que é ruim no celular). Voltar para 15 acontece ao trocar de mês, filtro ou aba.
- **Campos só com números:** valor, parcelas, limite, dia de vencimento, final do cartão e quantidade das compras ignoram letras (também ao colar), para não haver erro de digitação.
- **Fatura em aberto (app Bradesco Cartões):** o PDF "Extrato em aberto" também é aceito; o vencimento vem do cartão cadastrado (editável) e a versão final, depois do fechamento, não duplica o que já foi lançado.
- **Importar extrato da conta (Itaú e Santander):** o mesmo botão "Importar fatura ou extrato" também lê o PDF do extrato de conta. Lança entradas e saídas (Pix, débito, boleto, salário, IOF), sugere a categoria e deixa de fora, por padrão, aplicações/resgates (cofrinhos), transferências entre vocês e pagamentos de fatura de cartão. Importar duas vezes não duplica (mesma data, tipo e valor já lançados vêm marcados).
- **Gasto x caixa do cartão:** a compra no crédito conta como gasto no mês em que a fatura **fecha** (a fatura que fecha em setembro é gasto de setembro). O dinheiro só sai da conta no **vencimento** (outubro), e isso aparece no card "Na conta". Assim nada é contado duas vezes. Linhas "PAGTO ANTECIPADO" são ignoradas (já estão conciliadas). Importar a fatura cadastra o cartão sozinho (vencimento e fechamento lidos do PDF); compras lançadas à mão com forma "Crédito" usam esses dias para cair na fatura certa.
- **Dois cards no Mês:** "Na conta" (entradas − débito/pix − fatura que vence no mês) e "Gasto no cartão" (compras cuja fatura fecha no mês). O limite do cartão diminui com compras não pagas e parcelas que faltam.
- **Apagar por área:** em Ajustes > "Apagar por área", escolha o que zerar (lançamentos, fixas, parcelados, guardado, cartões, orçamento, tarefas, compras, metas, notas, notificações). Baixa um backup antes e vale para os dois.
- **Busca no mês:** campo para achar um lançamento pelo nome.
- **Lançamentos a pagar:** um lançamento avulso pode ficar "pendente" (ex.: compra com data futura). Marque o check quando pagar. **Atenção:** quem já configurou o Supabase precisa rodar de novo o `supabase/schema.sql` no SQL Editor (ele adiciona a coluna `pago` e as tabelas de bancos, cartões, orçamento, listas de compras e notificações, sem apagar nada; sem isso o painel funciona, só não guarda cartões, bancos novos e limites).
- **Categoria aprendida:** ao importar fatura, o painel sugere a categoria pelo que vocês já usaram para o mesmo estabelecimento.
- **Backup e restauração:** em Ajustes, "Baixar todos os dados (JSON)" e "Restaurar de um backup". Ao restaurar, o painel baixa antes uma cópia do que existe e depois troca os dados atuais pelos do arquivo.
- **Cartões:** cadastre cada cartão (banco, bandeira, final, dia do vencimento, limite e de quem é). Cada um vira um cartão visual com a cor do banco, mostra a fatura do mês, o limite usado e disponível e as próximas faturas. "Ver lançamentos" abre as compras da fatura; "Marcar como paga" fecha tudo de uma vez (e dá para desfazer). As compras no crédito de cada banco entram sozinhas na fatura, e as parcelas dos meses seguintes já aparecem. A bandeira aparece como texto (Visa, Mastercard...), sem os logotipos oficiais.
- **Bancos próprios:** além de Nubank, Itaú, Bradesco e Santander, dá para criar qualquer banco (Inter, C6...) com a cor que quiser, em Cartões > Bancos ou direto no cadastro do cartão. Eles passam a aparecer em todos os lançamentos.
- **Orçamento:** em Finanças > Orçamento, defina um limite mensal por categoria (Mercado, Lazer...). O painel mostra quanto já foi, avisa quando passa de 80% e quando estoura, calcula quanto dá para gastar por dia até o fim do mês e sugere limites pela média dos últimos 3 meses. Um resumo também aparece na aba Mês.
- **Desfazer:** ao apagar um lançamento, conta fixa, compra parcelada, tarefa, nota, meta, cofre, item de compra, cartão ou limite, aparece "Desfazer" por alguns segundos.
- **Atalhos de teclado (no computador):** `1` a `8` trocam de tela, `N` cria novo, `/` busca, `←` `→` mudam o mês, `H` volta para hoje, `[` `]` trocam a seção de Finanças, `,` abre os Ajustes e `?` mostra a lista.
- **Notificações:** a aba Notificações mostra o que o outro fez (lançou uma saída, marcou uma conta como paga, adicionou uma tarefa ou um item de compra, criou uma nota...), agrupado por dia, com filtro por pessoa e por área. Um número no menu mostra o que chegou desde a última vez que você abriu a aba, e com o painel aberto aparece um aviso na hora. O histórico guarda 90 dias. Não há aviso no celular com o painel fechado (isso exigiria um serviço de notificações push à parte).
- **Como usar:** toda tela tem uma explicação curta embaixo do título e o botão "Como usar", com o passo a passo de cada processo. Em Ajustes há a "Central de ajuda" com todas as telas.
- **Tarefas:** o formulário de nova tarefa é feito em passos (o quê, quem, para quando, e em "Mais opções" prioridade e repetição) e mostra um resumo antes de adicionar.
- **Compras:** crie listas próprias ("Nova lista"), esvazie ou exclua uma lista inteira pela lixeira (com "Desfazer"). Dentro de cada lista dá para criar **sublistas** (ex.: Feira e Compra do mês dentro de Mercado); a lixeira exclui só a sublista escolhida. A quantidade aceita só números.
- **Fixas:** todas as contas que se repetem. Aparecem sozinhas em cada mês, e você marca como pago mês a mês.
- **Parcelados:** progresso de cada compra, quanto falta pagar e o fim do parcelamento. Marque cada parcela como paga.
- **Guardado:** cofres com meta opcional (reserva, viagem...). Registre o que entra e o que sai.
- Banco: Nubank, Itaú, Bradesco, Santander, Dinheiro ou Outro. De quem é: Yuri, Lohrane ou Casal.

**Calendário:** o mês inteiro com pontinhos nos dias de vencimento (vermelho a pagar, círculo vazio pago ou lançado, verde entrada). Toque em um dia para ver os detalhes e marcar como pago ali mesmo. O botão "Tarefas e metas" inclui também os prazos de tarefas e metas.

**Tarefas:** digite e aperte Enter. Escolha quem faz e para quando: Hoje, Amanhã, Sem data ou **Escolher data** (qualquer dia do calendário). Tarefas podem repetir (todo dia, toda semana, todo mês): ao concluir, a próxima já é criada. Atrasadas aparecem em destaque.

**Compras:** listas separadas (Mercado, Farmácia, Casa, Outros). Digite o item e aperte Enter; se já foi comprado antes, o painel lembra a seção e a quantidade. Os itens ficam agrupados por seção, marque ao pegar (vai para "No carrinho") e use "Copiar lista para enviar" para mandar no WhatsApp.

**Metas do casal:** viajar, trocar de carro, montar a reserva. Cada meta tem prazo, tipo e passos para marcar. Se ligar a meta a um cofre de Finanças, o progresso acompanha o dinheiro guardado.

**Notas:** texto livre com salvamento automático, busca, cor e fixação no topo.

## Estrutura

```
index.html            página única
css/style.css         visual (claro e escuro automático)
js/config.js          dados de conexão e nomes
js/ui.js              utilitários (datas, dinheiro, janelas)
js/db.js              dados (Supabase ou modo demonstração)
js/financas.js        tela de finanças
js/fatura-parser.js   leitor das faturas (Bradesco, Itaú, Nubank)
js/fatura.js          tela de importação da fatura
js/vendor/            pdf.js (Mozilla, licença Apache 2.0), carregado só ao importar
js/tarefas.js         tela de tarefas
js/notas.js           tela de notas
js/compras.js         lista de compras
js/metas.js           metas do casal
js/calendario.js      calendário de vencimentos
js/orcamento.js       orçamento por categoria
js/cartoes.js         cartões, faturas e bancos
js/atalhos.js         atalhos de teclado
js/notificacoes.js    aba Notificações
js/atividades.js      descreve cada ação para o histórico
js/ajuda.js           textos e botão "Como usar"
js/app.js             login, navegação, tela inicial
supabase/schema.sql   tabelas, segurança e tempo real
```

## Adicionar novas seções depois

Cada seção é um arquivo em `js/` com uma função `render(elemento)`. Para criar uma nova (lista de compras, metas, calendário...):
1. crie a tabela em um novo trecho de SQL (copie o padrão de `notas` e a regra de segurança "casal");
2. adicione o nome da tabela em `TABLES` no `js/db.js` (e no `schema.sql`, nas duas listas de tabelas das regras de segurança e do tempo real);
3. crie `js/minha-secao.js` e inclua no `index.html`;
4. registre a rota em `NAV` e em `desenhar()` no `js/app.js`.

## Trocar os nomes

Em `js/config.js`, altere `NOMES`. A primeira pessoa usa o azul e a segunda o rosa.
