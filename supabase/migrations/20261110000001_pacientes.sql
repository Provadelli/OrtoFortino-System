-- ═══════════════════════════════════════════════════════════════════
-- Etapa 1 · Pacientes e responsáveis
-- ═══════════════════════════════════════════════════════════════════

create extension if not exists pg_trgm with schema extensions;

-- ───── Utilitários ─────

-- unaccent "imutável" (necessário para coluna gerada e índice de busca)
create or replace function public.f_unaccent(t text)
returns text
language sql
immutable
parallel safe
strict
set search_path = ''
as $$
  select extensions.unaccent('extensions.unaccent'::regdictionary, t);
$$;

-- Validação de CPF (dígitos verificadores). Defesa no banco, além do formulário.
create or replace function public.cpf_valido(c text)
returns boolean
language plpgsql
immutable
parallel safe
set search_path = ''
as $$
declare
  s int;
  d1 int;
  d2 int;
  i int;
begin
  if c is null then return true; end if;
  if c !~ '^\d{11}$' or c ~ '^(\d)\1{10}$' then return false; end if;
  s := 0;
  for i in 1..9 loop s := s + substr(c, i, 1)::int * (11 - i); end loop;
  d1 := (s * 10) % 11; if d1 = 10 then d1 := 0; end if;
  s := 0;
  for i in 1..10 loop s := s + substr(c, i, 1)::int * (12 - i); end loop;
  d2 := (s * 10) % 11; if d2 = 10 then d2 := 0; end if;
  return d1 = substr(c, 10, 1)::int and d2 = substr(c, 11, 1)::int;
end;
$$;

create or replace function public.mascarar_cpf(c text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when c is null then null else '***.' || substr(c, 4, 3) || '.' || substr(c, 7, 3) || '-**' end;
$$;

do $$ begin
  create type public.origem_paciente as enum ('clinica', 'particular', 'plano');
exception when duplicate_object then null; end $$;

-- ───── Pacientes ─────
create table if not exists public.pacientes (
  id                     uuid primary key default gen_random_uuid(),
  nome                   text not null check (length(btrim(nome)) between 2 and 160),
  nome_busca             text generated always as (public.f_unaccent(lower(nome))) stored,
  cpf                    text unique check (public.cpf_valido(cpf)),
  data_nascimento        date check (data_nascimento between date '1900-01-01' and current_date),
  telefone               text check (telefone ~ '^\d{10,11}$'),
  endereco               text check (length(endereco) <= 240),
  cidade                 text check (length(cidade) <= 120),
  uf                     char(2) check (uf ~ '^[A-Z]{2}$'),
  origem                 public.origem_paciente not null default 'particular',
  origem_nome            text check (length(origem_nome) <= 160),
  medico                 text check (length(medico) <= 160),
  diagnostico            text check (length(diagnostico) <= 2000),
  observacoes            text check (length(observacoes) <= 4000),
  consentimento_lgpd_em  timestamptz not null,
  consentimento_por      uuid references auth.users(id) default auth.uid(),
  created_at             timestamptz not null default now(),
  created_by             uuid references auth.users(id) default auth.uid(),
  updated_at             timestamptz not null default now(),
  updated_by             uuid references auth.users(id) default auth.uid()
);

comment on table public.pacientes is 'Pacientes (dados pessoais e de saúde — LGPD art. 11).';

create index if not exists pacientes_nome_busca_trgm on public.pacientes using gin (nome_busca extensions.gin_trgm_ops);
create index if not exists pacientes_cpf_trgm on public.pacientes using gin (cpf extensions.gin_trgm_ops);
create index if not exists pacientes_nome_idx on public.pacientes (nome);

drop trigger if exists pacientes_audit on public.pacientes;
create trigger pacientes_audit before update on public.pacientes
  for each row execute function public.set_audit();

-- ───── Responsáveis ─────
create table if not exists public.responsaveis (
  id           uuid primary key default gen_random_uuid(),
  paciente_id  uuid not null references public.pacientes(id) on delete cascade,
  nome         text not null check (length(btrim(nome)) between 2 and 160),
  cpf          text check (public.cpf_valido(cpf)),
  telefone     text check (telefone ~ '^\d{10,11}$'),
  parentesco   text check (length(parentesco) <= 60),
  principal    boolean not null default false,
  created_at   timestamptz not null default now(),
  created_by   uuid references auth.users(id) default auth.uid(),
  updated_at   timestamptz not null default now(),
  updated_by   uuid references auth.users(id) default auth.uid()
);

create index if not exists responsaveis_paciente_idx on public.responsaveis (paciente_id);
-- No máximo um responsável principal por paciente
create unique index if not exists responsaveis_um_principal on public.responsaveis (paciente_id) where principal;

drop trigger if exists responsaveis_audit on public.responsaveis;
create trigger responsaveis_audit before update on public.responsaveis
  for each row execute function public.set_audit();

-- ───── RLS: só a equipe autenticada ─────
alter table public.pacientes enable row level security;
alter table public.responsaveis enable row level security;
revoke all on public.pacientes, public.responsaveis from anon;
grant select, insert, update, delete on public.pacientes, public.responsaveis to authenticated;

drop policy if exists pacientes_equipe on public.pacientes;
create policy pacientes_equipe on public.pacientes
  for all to authenticated
  using ((select public.is_staff()))
  with check ((select public.is_staff()));

drop policy if exists responsaveis_equipe on public.responsaveis;
create policy responsaveis_equipe on public.responsaveis
  for all to authenticated
  using ((select public.is_staff()))
  with check ((select public.is_staff()));

grant execute on function public.is_staff() to authenticated;

-- ───── Busca para listagem (CPF já sai mascarado — LGPD) ─────
create or replace function public.buscar_pacientes(q text default '', lim int default 25, pular int default 0)
returns table (
  id uuid,
  nome text,
  cpf_mascarado text,
  data_nascimento date,
  telefone text,
  cidade text,
  uf char(2),
  origem public.origem_paciente,
  origem_nome text,
  responsavel text,
  created_at timestamptz,
  total bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with termo as (
    select public.f_unaccent(lower(btrim(coalesce(q, '')))) as txt,
           regexp_replace(coalesce(q, ''), '\D', '', 'g') as dig
  ),
  base as (
    select p.*, count(*) over () as total
      from public.pacientes p, termo t
     where t.txt = ''
        or p.nome_busca like '%' || t.txt || '%'
        or (length(t.dig) >= 3 and p.cpf like '%' || t.dig || '%')
     order by p.nome_busca
     limit least(greatest(lim, 1), 100) offset greatest(pular, 0)
  )
  select b.id, b.nome, public.mascarar_cpf(b.cpf), b.data_nascimento, b.telefone, b.cidade, b.uf,
         b.origem, b.origem_nome,
         (select r.nome from public.responsaveis r where r.paciente_id = b.id order by r.principal desc, r.created_at limit 1),
         b.created_at, b.total
    from base b
   order by b.nome_busca;
$$;

revoke execute on function public.buscar_pacientes(text, int, int) from public, anon;
grant execute on function public.buscar_pacientes(text, int, int) to authenticated;

-- ───── Salvar paciente + responsáveis numa única transação ─────
create or replace function public.salvar_paciente(p_id uuid, p_dados jsonb, p_responsaveis jsonb default '[]'::jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
  v_ids uuid[];
begin
  if not public.is_staff() then
    raise exception 'acesso negado' using errcode = '42501';
  end if;

  if p_id is null then
    if coalesce((p_dados->>'consentimento')::boolean, false) is not true then
      raise exception 'consentimento LGPD obrigatório' using errcode = '23514';
    end if;
    insert into public.pacientes (nome, cpf, data_nascimento, telefone, endereco, cidade, uf, origem, origem_nome,
                                  medico, diagnostico, observacoes, consentimento_lgpd_em)
    values (btrim(p_dados->>'nome'),
            nullif(p_dados->>'cpf', ''),
            nullif(p_dados->>'data_nascimento', '')::date,
            nullif(p_dados->>'telefone', ''),
            nullif(btrim(p_dados->>'endereco'), ''),
            nullif(btrim(p_dados->>'cidade'), ''),
            nullif(upper(p_dados->>'uf'), ''),
            coalesce(nullif(p_dados->>'origem', ''), 'particular')::public.origem_paciente,
            nullif(btrim(p_dados->>'origem_nome'), ''),
            nullif(btrim(p_dados->>'medico'), ''),
            nullif(btrim(p_dados->>'diagnostico'), ''),
            nullif(btrim(p_dados->>'observacoes'), ''),
            now())
    returning id into v_id;
  else
    update public.pacientes set
      nome            = btrim(p_dados->>'nome'),
      cpf             = nullif(p_dados->>'cpf', ''),
      data_nascimento = nullif(p_dados->>'data_nascimento', '')::date,
      telefone        = nullif(p_dados->>'telefone', ''),
      endereco        = nullif(btrim(p_dados->>'endereco'), ''),
      cidade          = nullif(btrim(p_dados->>'cidade'), ''),
      uf              = nullif(upper(p_dados->>'uf'), ''),
      origem          = coalesce(nullif(p_dados->>'origem', ''), 'particular')::public.origem_paciente,
      origem_nome     = nullif(btrim(p_dados->>'origem_nome'), ''),
      medico          = nullif(btrim(p_dados->>'medico'), ''),
      diagnostico     = nullif(btrim(p_dados->>'diagnostico'), ''),
      observacoes     = nullif(btrim(p_dados->>'observacoes'), '')
    where id = p_id
    returning id into v_id;
    if v_id is null then
      raise exception 'paciente não encontrado' using errcode = 'P0002';
    end if;
  end if;

  -- Responsáveis: remove os que saíram da lista, atualiza/inclui os demais
  select coalesce(array_agg((r->>'id')::uuid), '{}')
    into v_ids
    from jsonb_array_elements(coalesce(p_responsaveis, '[]'::jsonb)) r
   where nullif(r->>'id', '') is not null;

  delete from public.responsaveis where paciente_id = v_id and not (id = any (v_ids));

  -- Zera o principal antes, para o índice único não conflitar durante a troca
  update public.responsaveis set principal = false where paciente_id = v_id and principal;

  insert into public.responsaveis as t (id, paciente_id, nome, cpf, telefone, parentesco, principal)
  select coalesce(nullif(r->>'id', '')::uuid, gen_random_uuid()),
         v_id,
         btrim(r->>'nome'),
         nullif(r->>'cpf', ''),
         nullif(r->>'telefone', ''),
         nullif(btrim(r->>'parentesco'), ''),
         coalesce((r->>'principal')::boolean, false)
    from jsonb_array_elements(coalesce(p_responsaveis, '[]'::jsonb)) r
  on conflict (id) do update
     set nome = excluded.nome, cpf = excluded.cpf, telefone = excluded.telefone,
         parentesco = excluded.parentesco, principal = excluded.principal
   where t.paciente_id = v_id; -- nunca "sequestra" responsável de outro paciente

  return v_id;
end;
$$;

revoke execute on function public.salvar_paciente(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.salvar_paciente(uuid, jsonb, jsonb) to authenticated;
revoke execute on function public.cpf_valido(text) from anon;
revoke execute on function public.mascarar_cpf(text) from anon;
revoke execute on function public.f_unaccent(text) from anon;
