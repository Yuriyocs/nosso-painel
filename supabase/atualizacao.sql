-- Nosso Painel: atualização do banco. Pode rodar quantas vezes quiser (não apaga nada).
alter table public.lancamentos add column if not exists pago boolean not null default true;
alter table public.listas_compra add column if not exists pai text;
alter table public.compras add column if not exists sublista text;
alter table public.lancamentos add column if not exists fatura date;
alter table public.cartoes add column if not exists fechamento int;
