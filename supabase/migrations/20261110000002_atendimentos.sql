-- ═══════════════════════════════════════════════════════════════════
-- Etapa 2 · Atendimentos, ficha técnica e pagamento
-- ═══════════════════════════════════════════════════════════════════

do $$ begin
  create type public.categoria_atendimento as enum ('confeccao', 'ajuste', 'reparo', 'manutencao');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.status_atendimento as enum ('em_contato', 'em_producao', 'pronto', 'entregue', 'cancelado');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.status_pagamento as enum ('pendente', 'parcial', 'pago', 'isento');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.forma_pagamento as enum ('pix', 'dinheiro', 'cartao', 'boleto', 'convenio');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.tipo_ficha as enum ('ortese', 'protese', 'palmilha');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.lateralidade as enum ('bilateral', 'unilateral_d', 'unilateral_e');
exception when duplicate_object then null; end $$;

-- ───── Atendimentos ─────
create table if not exists public.atendimentos (
  id                     uuid primary key default gen_random_uuid(),
  numero                 bigint generated always as identity unique,
  paciente_id            uuid not null references public.pacientes(id) on delete restrict,
  categoria              public.categoria_atendimento not null default 'confeccao',
  descricao              text check (length(descricao) <= 240),
  status                 public.status_atendimento not null default 'em_contato',
  data_primeiro_contato  date not null default current_date,
  data_fechamento        date,
  prazo_entrega          date,
  data_conclusao         date,
  valor                  numeric(12,2) not null default 0 check (valor >= 0 and valor <= 1000000),
  valor_pago             numeric(12,2) not null default 0 check (valor_pago >= 0 and valor_pago <= 1000000),
  pagamento_status       public.status_pagamento not null default 'pendente',
  pagamento_forma        public.forma_pagamento,
  pagamento_detalhe      text check (length(pagamento_detalhe) <= 120),
  data_pagamento         date,
  observacoes            text check (length(observacoes) <= 4000),
  created_at             timestamptz not null default now(),
  created_by             uuid references auth.users(id) default auth.uid(),
  updated_at             timestamptz not null default now(),
  updated_by             uuid references auth.users(id) default auth.uid(),
  constraint datas_coerentes check (
    (data_fechamento is null or data_fechamento >= data_primeiro_contato)
    and (data_conclusao is null or data_conclusao >= data_primeiro_contato)
  )
);

create index if not exists atendimentos_paciente_idx on public.atendimentos (paciente_id, created_at desc);
create index if not exists atendimentos_status_idx on public.atendimentos (status, prazo_entrega);
create index if not exists atendimentos_pagamento_idx on public.atendimentos (pagamento_status) where pagamento_status in ('pendente', 'parcial');

-- Regras automáticas: status do pagamento derivado dos valores; conclusão ao entregar.
create or replace function public.atendimento_regras()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.valor = 0 then
    new.pagamento_status := 'isento';
  elsif new.valor_pago >= new.valor then
    new.pagamento_status := 'pago';
  elsif new.valor_pago > 0 then
    new.pagamento_status := 'parcial';
  else
    new.pagamento_status := 'pendente';
  end if;

  if new.status = 'entregue' and new.data_conclusao is null then
    new.data_conclusao := current_date;
  end if;
  if new.status in ('em_producao', 'pronto', 'entregue') and new.data_fechamento is null then
    new.data_fechamento := greatest(new.data_primeiro_contato, current_date);
  end if;
  return new;
end;
$$;

drop trigger if exists atendimentos_regras on public.atendimentos;
create trigger atendimentos_regras before insert or update on public.atendimentos
  for each row execute function public.atendimento_regras();

drop trigger if exists atendimentos_audit on public.atendimentos;
create trigger atendimentos_audit before update on public.atendimentos
  for each row execute function public.set_audit();

-- ───── Ficha técnica (1 por atendimento) ─────
create table if not exists public.fichas_tecnicas (
  id                   uuid primary key default gen_random_uuid(),
  atendimento_id       uuid not null unique references public.atendimentos(id) on delete cascade,
  tipo                 public.tipo_ficha not null default 'ortese',
  lateralidade         public.lateralidade,
  produto              text check (length(produto) <= 120),
  especificacoes       text[] not null default '{}' check (cardinality(especificacoes) <= 40),
  compensacao_lado     char(1) check (compensacao_lado in ('D', 'E')),
  compensacao_medida   text check (length(compensacao_medida) <= 40),
  tamanho_calcado      text check (length(tamanho_calcado) <= 20),
  medidas_ml           text check (length(medidas_ml) <= 400),
  nome_na_ortese       boolean not null default false,
  tema                 text check (length(tema) <= 80),
  cor_forro            text check (length(cor_forro) <= 60),
  cor_tira             text check (length(cor_tira) <= 60),
  protese_membro       text check (protese_membro in ('superior', 'inferior')),
  protese_nivel        text check (protese_nivel in ('transtibial', 'transfemoral')),
  protese_lado         char(1) check (protese_lado in ('D', 'E')),
  liner                text check (length(liner) <= 80),
  tamanho_pe           text check (length(tamanho_pe) <= 20),
  observacoes          text check (length(observacoes) <= 4000),
  created_at           timestamptz not null default now(),
  created_by           uuid references auth.users(id) default auth.uid(),
  updated_at           timestamptz not null default now(),
  updated_by           uuid references auth.users(id) default auth.uid()
);

drop trigger if exists fichas_audit on public.fichas_tecnicas;
create trigger fichas_audit before update on public.fichas_tecnicas
  for each row execute function public.set_audit();

-- ───── RLS ─────
alter table public.atendimentos enable row level security;
alter table public.fichas_tecnicas enable row level security;
revoke all on public.atendimentos, public.fichas_tecnicas from anon;
grant select, insert, update, delete on public.atendimentos, public.fichas_tecnicas to authenticated;

drop policy if exists atendimentos_equipe on public.atendimentos;
create policy atendimentos_equipe on public.atendimentos
  for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));

drop policy if exists fichas_equipe on public.fichas_tecnicas;
create policy fichas_equipe on public.fichas_tecnicas
  for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));

-- ───── Salvar atendimento + ficha numa transação ─────
create or replace function public.salvar_atendimento(p_id uuid, p_dados jsonb, p_ficha jsonb default null)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.is_staff() then
    raise exception 'acesso negado' using errcode = '42501';
  end if;

  if p_id is null then
    insert into public.atendimentos (paciente_id, categoria, descricao, status, data_primeiro_contato, data_fechamento,
                                     prazo_entrega, data_conclusao, valor, valor_pago, pagamento_forma, pagamento_detalhe,
                                     data_pagamento, observacoes)
    values ((p_dados->>'paciente_id')::uuid,
            coalesce(nullif(p_dados->>'categoria', ''), 'confeccao')::public.categoria_atendimento,
            nullif(btrim(p_dados->>'descricao'), ''),
            coalesce(nullif(p_dados->>'status', ''), 'em_contato')::public.status_atendimento,
            coalesce(nullif(p_dados->>'data_primeiro_contato', '')::date, current_date),
            nullif(p_dados->>'data_fechamento', '')::date,
            nullif(p_dados->>'prazo_entrega', '')::date,
            nullif(p_dados->>'data_conclusao', '')::date,
            coalesce(nullif(p_dados->>'valor', '')::numeric, 0),
            coalesce(nullif(p_dados->>'valor_pago', '')::numeric, 0),
            nullif(p_dados->>'pagamento_forma', '')::public.forma_pagamento,
            nullif(btrim(p_dados->>'pagamento_detalhe'), ''),
            nullif(p_dados->>'data_pagamento', '')::date,
            nullif(btrim(p_dados->>'observacoes'), ''))
    returning id into v_id;
  else
    update public.atendimentos set
      categoria             = coalesce(nullif(p_dados->>'categoria', ''), 'confeccao')::public.categoria_atendimento,
      descricao             = nullif(btrim(p_dados->>'descricao'), ''),
      status                = coalesce(nullif(p_dados->>'status', ''), 'em_contato')::public.status_atendimento,
      data_primeiro_contato = coalesce(nullif(p_dados->>'data_primeiro_contato', '')::date, data_primeiro_contato),
      data_fechamento       = nullif(p_dados->>'data_fechamento', '')::date,
      prazo_entrega         = nullif(p_dados->>'prazo_entrega', '')::date,
      data_conclusao        = nullif(p_dados->>'data_conclusao', '')::date,
      valor                 = coalesce(nullif(p_dados->>'valor', '')::numeric, 0),
      valor_pago            = coalesce(nullif(p_dados->>'valor_pago', '')::numeric, 0),
      pagamento_forma       = nullif(p_dados->>'pagamento_forma', '')::public.forma_pagamento,
      pagamento_detalhe     = nullif(btrim(p_dados->>'pagamento_detalhe'), ''),
      data_pagamento        = nullif(p_dados->>'data_pagamento', '')::date,
      observacoes           = nullif(btrim(p_dados->>'observacoes'), '')
    where id = p_id
    returning id into v_id;
    if v_id is null then
      raise exception 'atendimento não encontrado' using errcode = 'P0002';
    end if;
  end if;

  if p_ficha is null then
    delete from public.fichas_tecnicas where atendimento_id = v_id;
  else
    insert into public.fichas_tecnicas as f (atendimento_id, tipo, lateralidade, produto, especificacoes, compensacao_lado,
                                             compensacao_medida, tamanho_calcado, medidas_ml, nome_na_ortese, tema, cor_forro,
                                             cor_tira, protese_membro, protese_nivel, protese_lado, liner, tamanho_pe, observacoes)
    values (v_id,
            coalesce(nullif(p_ficha->>'tipo', ''), 'ortese')::public.tipo_ficha,
            nullif(p_ficha->>'lateralidade', '')::public.lateralidade,
            nullif(btrim(p_ficha->>'produto'), ''),
            coalesce(array(select jsonb_array_elements_text(coalesce(p_ficha->'especificacoes', '[]'::jsonb))), '{}'),
            nullif(p_ficha->>'compensacao_lado', ''),
            nullif(btrim(p_ficha->>'compensacao_medida'), ''),
            nullif(btrim(p_ficha->>'tamanho_calcado'), ''),
            nullif(btrim(p_ficha->>'medidas_ml'), ''),
            coalesce((p_ficha->>'nome_na_ortese')::boolean, false),
            nullif(btrim(p_ficha->>'tema'), ''),
            nullif(btrim(p_ficha->>'cor_forro'), ''),
            nullif(btrim(p_ficha->>'cor_tira'), ''),
            nullif(p_ficha->>'protese_membro', ''),
            nullif(p_ficha->>'protese_nivel', ''),
            nullif(p_ficha->>'protese_lado', ''),
            nullif(btrim(p_ficha->>'liner'), ''),
            nullif(btrim(p_ficha->>'tamanho_pe'), ''),
            nullif(btrim(p_ficha->>'observacoes'), ''))
    on conflict (atendimento_id) do update set
      tipo = excluded.tipo, lateralidade = excluded.lateralidade, produto = excluded.produto,
      especificacoes = excluded.especificacoes, compensacao_lado = excluded.compensacao_lado,
      compensacao_medida = excluded.compensacao_medida, tamanho_calcado = excluded.tamanho_calcado,
      medidas_ml = excluded.medidas_ml, nome_na_ortese = excluded.nome_na_ortese, tema = excluded.tema,
      cor_forro = excluded.cor_forro, cor_tira = excluded.cor_tira, protese_membro = excluded.protese_membro,
      protese_nivel = excluded.protese_nivel, protese_lado = excluded.protese_lado, liner = excluded.liner,
      tamanho_pe = excluded.tamanho_pe, observacoes = excluded.observacoes;
  end if;

  return v_id;
end;
$$;

revoke execute on function public.salvar_atendimento(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.salvar_atendimento(uuid, jsonb, jsonb) to authenticated;
revoke execute on function public.atendimento_regras() from public, anon, authenticated;
