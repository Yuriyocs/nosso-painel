-- =====================================================================
-- Nosso Painel - banco de dados (Supabase / Postgres)
-- Cole este arquivo inteiro no "SQL Editor" do Supabase e clique em Run.
-- Pode rodar de novo sem medo: ele só cria o que ainda não existe.
-- =====================================================================

-- Quem é quem (cada pessoa escolhe o próprio nome no primeiro acesso)
create table if not exists public.perfis (
  id   uuid primary key references auth.users (id) on delete cascade,
  nome text not null
);

-- ---------------------------- FINANÇAS --------------------------------

-- Entradas e saídas avulsas
create table if not exists public.lancamentos (
  id         uuid primary key default gen_random_uuid(),
  tipo       text not null check (tipo in ('entrada', 'saida')),
  descricao  text not null,
  valor      numeric(14,2) not null check (valor > 0),
  data       date not null,
  categoria  text,
  banco      text,
  pessoa     text,
  forma      text,
  obs        text,
  criado_por text,
  criado_em  timestamptz not null default now()
);
-- "pago": false = ainda a pagar/receber (fatura que não venceu, por exemplo)
alter table public.lancamentos add column if not exists pago boolean not null default true;

-- Lançamentos que se repetem todo mês (aluguel, salário, internet...)
create table if not exists public.fixas (
  id        uuid primary key default gen_random_uuid(),
  tipo      text not null default 'saida' check (tipo in ('entrada', 'saida')),
  descricao text not null,
  valor     numeric(14,2) not null check (valor > 0),
  inicio    date not null,   -- primeiro vencimento (o dia do mês vem daqui)
  fim       date,            -- opcional: último mês em que vale
  categoria text,
  banco     text,
  pessoa    text,
  obs       text,
  criado_em timestamptz not null default now()
);

-- Meses em que uma fixa já foi paga/recebida
create table if not exists public.fixas_pagas (
  id      uuid primary key default gen_random_uuid(),
  fixa_id uuid not null references public.fixas (id) on delete cascade,
  mes     text not null check (mes ~ '^[0-9]{4}-[0-9]{2}$'),
  unique (fixa_id, mes)
);

-- Compras parceladas (valor total + quantidade de parcelas)
create table if not exists public.parcelados (
  id          uuid primary key default gen_random_uuid(),
  descricao   text not null,
  valor_total numeric(14,2) not null check (valor_total > 0),
  parcelas    int not null check (parcelas between 2 and 120),
  primeira    date not null,  -- data da 1ª parcela
  categoria   text,
  banco       text,
  pessoa      text,
  obs         text,
  criado_em   timestamptz not null default now()
);

create table if not exists public.parcelas_pagas (
  id           uuid primary key default gen_random_uuid(),
  parcelado_id uuid not null references public.parcelados (id) on delete cascade,
  numero       int not null,
  unique (parcelado_id, numero)
);

-- Dinheiro guardado (reserva, viagem, etc.)
create table if not exists public.cofres (
  id        uuid primary key default gen_random_uuid(),
  nome      text not null,
  meta      numeric(14,2),
  banco     text,
  pessoa    text,
  criado_em timestamptz not null default now()
);

create table if not exists public.cofre_movs (
  id         uuid primary key default gen_random_uuid(),
  cofre_id   uuid not null references public.cofres (id) on delete cascade,
  valor      numeric(14,2) not null,  -- positivo = guardou, negativo = retirou
  data       date not null,
  nota       text,
  criado_por text,
  criado_em  timestamptz not null default now()
);

-- ----------------------------- TAREFAS --------------------------------

create table if not exists public.tarefas (
  id          uuid primary key default gen_random_uuid(),
  titulo      text not null,
  responsavel text,
  prazo       date,
  prioridade  text not null default 'normal' check (prioridade in ('baixa', 'normal', 'alta')),
  repete      text not null default 'nao' check (repete in ('nao', 'diaria', 'semanal', 'mensal')),
  obs         text,
  feita       boolean not null default false,
  feita_em    timestamptz,
  feita_por   text,
  criado_por  text,
  criado_em   timestamptz not null default now()
);

-- ------------------------------ NOTAS ---------------------------------

create table if not exists public.notas (
  id            uuid primary key default gen_random_uuid(),
  titulo        text not null default '',
  corpo         text not null default '',
  cor           text not null default '',
  fixada        boolean not null default false,
  atualizado_em timestamptz not null default now(),
  editado_por   text,
  criado_por    text,
  criado_em     timestamptz not null default now()
);

-- ------------------------- LISTA DE COMPRAS ----------------------------

create table if not exists public.compras (
  id             uuid primary key default gen_random_uuid(),
  lista          text not null default 'Mercado',
  nome           text not null,
  qtd            text,
  secao          text,
  comprado       boolean not null default false,
  comprado_em    timestamptz,
  adicionado_por text,
  criado_em      timestamptz not null default now()
);

-- --------------------------- METAS DO CASAL ----------------------------

create table if not exists public.metas (
  id           uuid primary key default gen_random_uuid(),
  titulo       text not null,
  categoria    text,
  prazo        date,
  cofre_id     uuid references public.cofres (id) on delete set null,  -- opcional: liga a meta a um cofre
  obs          text,
  concluida    boolean not null default false,
  concluida_em timestamptz,
  criado_por   text,
  criado_em    timestamptz not null default now()
);

create table if not exists public.meta_passos (
  id        uuid primary key default gen_random_uuid(),
  meta_id   uuid not null references public.metas (id) on delete cascade,
  texto     text not null,
  feito     boolean not null default false,
  criado_em timestamptz not null default now()
);


-- ---------------------------------------------------------------------
-- Bancos próprios, cartões e orçamento por categoria
-- ---------------------------------------------------------------------
create table if not exists public.bancos (
  id        uuid primary key default gen_random_uuid(),
  nome      text not null,
  cor       text,
  criado_em timestamptz not null default now()
);

create table if not exists public.cartoes (
  id         uuid primary key default gen_random_uuid(),
  banco      text not null,
  apelido    text,
  bandeira   text,
  final      text,
  vencimento integer check (vencimento between 1 and 31),
  limite     numeric(12,2),
  pessoa     text,
  criado_em  timestamptz not null default now()
);

create table if not exists public.listas_compra (
  id        uuid primary key default gen_random_uuid(),
  nome      text not null,
  criado_em timestamptz not null default now()
);

-- Histórico do que cada um faz (aba Notificações)
create table if not exists public.atividades (
  id        uuid primary key default gen_random_uuid(),
  autor     text not null,
  area      text not null,
  texto     text not null,
  ref       text,
  criado_em timestamptz not null default now()
);
-- Sublistas de compras (uma lista pode ter várias dentro dela)
alter table public.listas_compra add column if not exists pai text;
alter table public.compras add column if not exists sublista text;

create index if not exists atividades_criado_em_idx on public.atividades (criado_em desc);

create table if not exists public.orcamentos (
  id        uuid primary key default gen_random_uuid(),
  categoria text not null,
  limite    numeric(12,2) not null check (limite > 0),
  criado_em timestamptz not null default now()
);

-- =====================================================================
-- SEGURANÇA: só quem está logado enxerga ou altera qualquer coisa.
-- (Desative o cadastro aberto no painel do Supabase - veja o README.)
-- =====================================================================

do $$
declare t text;
begin
  foreach t in array array[
    'lancamentos','fixas','fixas_pagas','parcelados','parcelas_pagas',
    'cofres','cofre_movs','tarefas','notas','compras','metas','meta_passos',
    'bancos','cartoes','orcamentos','listas_compra','atividades'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon', t);
    execute format('drop policy if exists "casal" on public.%I', t);
    execute format(
      'create policy "casal" on public.%I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

alter table public.perfis enable row level security;
revoke all on table public.perfis from anon;
drop policy if exists "perfis_ver" on public.perfis;
drop policy if exists "perfis_criar" on public.perfis;
drop policy if exists "perfis_editar" on public.perfis;
create policy "perfis_ver"    on public.perfis for select to authenticated using (true);
create policy "perfis_criar"  on public.perfis for insert to authenticated with check (id = auth.uid());
create policy "perfis_editar" on public.perfis for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- =====================================================================
-- TEMPO REAL: o que um fizer aparece na tela do outro sem recarregar.
-- =====================================================================

do $$
declare t text;
begin
  foreach t in array array[
    'lancamentos','fixas','fixas_pagas','parcelados','parcelas_pagas',
    'cofres','cofre_movs','tarefas','notas','compras','metas','meta_passos',
    'bancos','cartoes','orcamentos','listas_compra','atividades'
  ] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- Compras no crédito entram na fatura do vencimento (mês em que o dinheiro sai) e cartões com dia de fechamento.
alter table public.lancamentos add column if not exists fatura date;
alter table public.cartoes add column if not exists fechamento int;
