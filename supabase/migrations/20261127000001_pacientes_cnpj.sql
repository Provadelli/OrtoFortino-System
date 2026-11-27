-- Cadastro de cliente pessoa jurídica: CPF ou CNPJ.
-- Aditiva: pacientes existentes continuam 'cpf'. O nome da empresa (razão social) vai em pacientes.nome.

create or replace function public.cnpj_valido(c text)
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
  p1 int[] := array[5,4,3,2,9,8,7,6,5,4,3,2];
  p2 int[] := array[6,5,4,3,2,9,8,7,6,5,4,3,2];
begin
  if c is null then return true; end if;
  if c !~ '^\d{14}$' or c ~ '^(\d)\1{13}$' then return false; end if;
  s := 0;
  for i in 1..12 loop s := s + substr(c, i, 1)::int * p1[i]; end loop;
  d1 := s % 11; d1 := case when d1 < 2 then 0 else 11 - d1 end;
  s := 0;
  for i in 1..13 loop s := s + substr(c, i, 1)::int * p2[i]; end loop;
  d2 := s % 11; d2 := case when d2 < 2 then 0 else 11 - d2 end;
  return d1 = substr(c, 13, 1)::int and d2 = substr(c, 14, 1)::int;
end;
$$;

create or replace function public.mascarar_cnpj(c text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when c is null then null else '**.' || substr(c, 3, 3) || '.' || substr(c, 6, 3) || '/' || substr(c, 9, 4) || '-**' end;
$$;

alter table public.pacientes add column if not exists tipo_documento text not null default 'cpf';
alter table public.pacientes add column if not exists cnpj text;
alter table public.pacientes drop constraint if exists pacientes_tipo_documento_check;
alter table public.pacientes add constraint pacientes_tipo_documento_check check (tipo_documento in ('cpf', 'cnpj'));
alter table public.pacientes drop constraint if exists pacientes_cnpj_check;
alter table public.pacientes add constraint pacientes_cnpj_check check (cnpj is null or public.cnpj_valido(cnpj));
alter table public.pacientes drop constraint if exists pacientes_documento_coerente_check;
alter table public.pacientes add constraint pacientes_documento_coerente_check
  check ((tipo_documento = 'cpf' and cnpj is null) or (tipo_documento = 'cnpj' and cpf is null));
create unique index if not exists pacientes_cnpj_key on public.pacientes (cnpj) where cnpj is not null;

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
    insert into public.pacientes (nome, tipo_documento, cpf, cnpj, data_nascimento, telefone, cep, endereco, cidade, uf, origem, origem_nome,
                                  medico, diagnostico, observacoes, consentimento_lgpd_em)
    values (btrim(p_dados->>'nome'),
            coalesce(nullif(p_dados->>'tipo_documento', ''), 'cpf'),
            nullif(p_dados->>'cpf', ''),
            nullif(p_dados->>'cnpj', ''),
            nullif(p_dados->>'data_nascimento', '')::date,
            nullif(p_dados->>'telefone', ''),
            nullif(p_dados->>'cep', ''),
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
      tipo_documento  = coalesce(nullif(p_dados->>'tipo_documento', ''), 'cpf'),
      cpf             = nullif(p_dados->>'cpf', ''),
      cnpj            = nullif(p_dados->>'cnpj', ''),
      data_nascimento = nullif(p_dados->>'data_nascimento', '')::date,
      telefone        = nullif(p_dados->>'telefone', ''),
      cep             = nullif(p_dados->>'cep', ''),
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

-- Busca: também encontra por CNPJ e mascara o documento conforme o tipo.
drop function if exists public.buscar_pacientes(text, int, int, text[], text[]);
create or replace function public.buscar_pacientes(q text default '', lim int default 25, pular int default 0,
                                                   origens text[] default null, faixas text[] default null)
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
     where (t.txt = ''
            or p.nome_busca like '%' || t.txt || '%'
            or (length(t.dig) >= 3 and (p.cpf like '%' || t.dig || '%' or p.cnpj like '%' || t.dig || '%')))
       and (coalesce(cardinality(origens), 0) = 0 or p.origem::text = any (origens))
       and (coalesce(cardinality(faixas), 0) = 0
            or ('menor' = any (faixas) and p.data_nascimento > (current_date - interval '18 years'))
            or ('adulto' = any (faixas) and p.data_nascimento <= (current_date - interval '18 years'))
            or ('sem_data' = any (faixas) and p.data_nascimento is null))
     order by p.nome_busca
     limit least(greatest(lim, 1), 100) offset greatest(pular, 0)
  )
  select b.id, b.nome,
         case when b.tipo_documento = 'cnpj' then public.mascarar_cnpj(b.cnpj) else public.mascarar_cpf(b.cpf) end,
         b.data_nascimento, b.telefone, b.cidade, b.uf,
         b.origem, b.origem_nome,
         (select r.nome from public.responsaveis r where r.paciente_id = b.id order by r.principal desc, r.created_at limit 1),
         b.created_at, b.total
    from base b
   order by b.nome_busca;
$$;
revoke execute on function public.buscar_pacientes(text, int, int, text[], text[]) from public, anon;
grant execute on function public.buscar_pacientes(text, int, int, text[], text[]) to authenticated;
