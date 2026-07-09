-- LauOS WatchTime v138
-- Rode este SQL no Supabase em SQL Editor > New query > Run.

create table if not exists public.lauos_watchtime_state (
  id text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.lauos_watchtime_state enable row level security;

drop policy if exists "WatchTime leitura autenticada" on public.lauos_watchtime_state;
drop policy if exists "WatchTime inserir autenticado" on public.lauos_watchtime_state;
drop policy if exists "WatchTime atualizar autenticado" on public.lauos_watchtime_state;

create policy "WatchTime leitura autenticada"
on public.lauos_watchtime_state
for select
to authenticated
using (id = 'watchtime_v1');

create policy "WatchTime inserir autenticado"
on public.lauos_watchtime_state
for insert
to authenticated
with check (id = 'watchtime_v1');

create policy "WatchTime atualizar autenticado"
on public.lauos_watchtime_state
for update
to authenticated
using (id = 'watchtime_v1')
with check (id = 'watchtime_v1');

create or replace function public.lauos_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = coalesce(new.updated_at, now());
  return new;
end;
$$;

drop trigger if exists lauos_watchtime_state_updated_at on public.lauos_watchtime_state;
create trigger lauos_watchtime_state_updated_at
before update on public.lauos_watchtime_state
for each row
execute function public.lauos_set_updated_at();
