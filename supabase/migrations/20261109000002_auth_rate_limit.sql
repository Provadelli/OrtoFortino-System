-- ═══════════════════════════════════════════════════════════════════
-- Limite de tentativas (login, recuperação de senha) usado pelo BFF.
-- Acessível SOMENTE pela service role (chave secreta no servidor).
-- As chaves são hashes SHA-256 truncados: sem e-mail/IP em texto puro.
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.auth_rate_limits (
  key           text primary key check (length(key) <= 80),
  fails         integer not null default 0,
  window_start  timestamptz not null default now(),
  locked_until  timestamptz
);

alter table public.auth_rate_limits enable row level security;
-- Nenhuma policy: anon e authenticated não leem nem escrevem.
revoke all on public.auth_rate_limits from anon, authenticated;

-- Segundos de espera (0 = liberado)
create or replace function public.auth_rate_check(p_key text)
returns integer
language sql
security definer
set search_path = ''
as $$
  select coalesce(
    (select greatest(0, ceil(extract(epoch from (locked_until - now()))))::int
       from public.auth_rate_limits
      where key = p_key and locked_until is not null),
    0
  );
$$;

create or replace function public.auth_rate_fail(p_key text, p_max int, p_window_sec int, p_lock_sec int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.auth_rate_limits;
begin
  insert into public.auth_rate_limits as t (key, fails, window_start)
  values (p_key, 1, now())
  on conflict (key) do update
    set fails = case
                  when t.window_start < now() - make_interval(secs => p_window_sec) then 1
                  else t.fails + 1
                end,
        window_start = case
                  when t.window_start < now() - make_interval(secs => p_window_sec) then now()
                  else t.window_start
                end
  returning * into r;

  if r.fails >= p_max then
    update public.auth_rate_limits
       set locked_until = now() + make_interval(secs => p_lock_sec), fails = 0, window_start = now()
     where key = p_key;
  end if;
end;
$$;

create or replace function public.auth_rate_reset(p_key text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.auth_rate_limits where key = p_key;
$$;

-- Limpeza de registros antigos (chamada oportunisticamente; pode virar pg_cron).
create or replace function public.auth_rate_gc()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.auth_rate_limits
   where coalesce(locked_until, window_start) < now() - interval '1 day';
$$;

revoke execute on function public.auth_rate_check(text) from public, anon, authenticated;
revoke execute on function public.auth_rate_fail(text, int, int, int) from public, anon, authenticated;
revoke execute on function public.auth_rate_reset(text) from public, anon, authenticated;
revoke execute on function public.auth_rate_gc() from public, anon, authenticated;
grant execute on function public.auth_rate_check(text) to service_role;
grant execute on function public.auth_rate_fail(text, int, int, int) to service_role;
grant execute on function public.auth_rate_reset(text) to service_role;
grant execute on function public.auth_rate_gc() to service_role;
