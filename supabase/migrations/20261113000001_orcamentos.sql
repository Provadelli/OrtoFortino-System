-- ═══════════════════════════════════════════════════════════════════
-- Fase 5 · Orçamentos
-- Regras do README:
--   2. o preço é copiado para o item (mudar a tabela não muda orçamentos antigos);
--   3. orçamento aprovado fica travado — alterar = nova versão (-v2);
--   4. aprovar cria o atendimento.
-- Para que a trava valha no banco (e não só na tela), a equipe só LÊ
-- orcamentos/orcamento_itens; toda escrita passa pelas funções abaixo,
-- que são security definer, checam is_staff() e validam o status.
-- (Exceção: excluir orçamento não aprovado, via delete com RLS + trigger.)
-- ═══════════════════════════════════════════════════════════════════

do $$ begin
  create type public.status_orcamento as enum ('rascunho', 'enviado', 'aprovado', 'recusado', 'substituido');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.tipo_desconto as enum ('valor', 'percentual');
exception when duplicate_object then null; end $$;

create table if not exists public.orcamentos (
  id                   uuid primary key default gen_random_uuid(),
  ano                  int not null check (ano between 2000 and 2999),
  sequencial           int not null check (sequencial > 0),
  versao               int not null default 1 check (versao between 1 and 99),
  numero               text generated always as (
                         'ORC-' || ano::text || '-' || lpad(sequencial::text, 4, '0')
                         || case when versao > 1 then '-v' || versao::text else '' end
                       ) stored,
  versao_anterior_id   uuid references public.orcamentos(id) on delete set null,
  paciente_id          uuid not null references public.pacientes(id),
  status               public.status_orcamento not null default 'rascunho',
  data_emissao         date not null default current_date,
  validade             date not null,
  desconto_tipo        public.tipo_desconto not null default 'valor',
  desconto             numeric(12,2) not null default 0 check (desconto >= 0 and desconto <= 1000000),
  subtotal             numeric(12,2) not null default 0 check (subtotal >= 0),
  desconto_valor       numeric(12,2) not null default 0 check (desconto_valor >= 0),
  total                numeric(12,2) not null default 0 check (total >= 0),
  condicoes_pagamento  text check (length(condicoes_pagamento) <= 400),
  prazo_entrega        text check (length(prazo_entrega) <= 120),
  observacoes          text check (length(observacoes) <= 4000),
  atendimento_id       uuid references public.atendimentos(id) on delete set null,
  enviado_em           timestamptz,
  aprovado_em          timestamptz,
  created_at           timestamptz not null default now(),
  created_by           uuid references auth.users(id) default auth.uid(),
  updated_at           timestamptz not null default now(),
  updated_by           uuid references auth.users(id) default auth.uid(),
  constraint orcamentos_numero_uniq unique (ano, sequencial, versao),
  constraint orcamentos_validade check (validade >= data_emissao),
  constraint orcamentos_percentual check (desconto_tipo <> 'percentual' or desconto <= 100)
);

create index if not exists orcamentos_paciente_idx on public.orcamentos (paciente_id, created_at desc);
create index if not exists orcamentos_status_idx on public.orcamentos (status, updated_at desc);
create index if not exists orcamentos_atendimento_idx on public.orcamentos (atendimento_id) where atendimento_id is not null;

drop trigger if exists orcamentos_audit on public.orcamentos;
create trigger orcamentos_audit before update on public.orcamentos
  for each row execute function public.set_audit();

create table if not exists public.orcamento_itens (
  id              uuid primary key default gen_random_uuid(),
  orcamento_id    uuid not null references public.orcamentos(id) on delete cascade,
  ordem           int not null,
  produto_id      uuid references public.produtos(id), -- no action: erro 23503 ao excluir produto em uso (a tela sugere desativar)
  tipo            public.tipo_produto not null default 'base',
  secao           text check (length(secao) <= 80),
  descricao       text not null check (length(btrim(descricao)) between 1 and 160),
  detalhe         text check (length(detalhe) <= 1000),
  quantidade      numeric(10,2) not null check (quantidade > 0 and quantidade <= 10000),
  unidade         text not null default 'un' check (length(unidade) between 1 and 20),
  preco_unitario  numeric(12,2) not null check (preco_unitario >= 0 and preco_unitario <= 1000000),
  total           numeric(12,2) generated always as (round(quantidade * preco_unitario, 2)) stored
);

create index if not exists orcamento_itens_orcamento_idx on public.orcamento_itens (orcamento_id, ordem);
create index if not exists orcamento_itens_produto_idx on public.orcamento_itens (produto_id) where produto_id is not null;

-- Aprovado (ou substituído por versão nova) não pode ser excluído.
create or replace function public.orcamento_protege_exclusao()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status in ('aprovado', 'substituido') then
    raise exception 'orçamento aprovado não pode ser excluído' using errcode = '55000';
  end if;
  return old;
end;
$$;

drop trigger if exists orcamentos_protege_exclusao on public.orcamentos;
create trigger orcamentos_protege_exclusao before delete on public.orcamentos
  for each row execute function public.orcamento_protege_exclusao();

-- ───── RLS: leitura para a equipe; exclusão de não aprovados ─────
alter table public.orcamentos enable row level security;
alter table public.orcamento_itens enable row level security;
revoke all on public.orcamentos, public.orcamento_itens from anon, authenticated;
grant select, delete on public.orcamentos to authenticated;
grant select on public.orcamento_itens to authenticated;

drop policy if exists orcamentos_leitura on public.orcamentos;
create policy orcamentos_leitura on public.orcamentos
  for select to authenticated using ((select public.is_staff()));
drop policy if exists orcamentos_exclusao on public.orcamentos;
create policy orcamentos_exclusao on public.orcamentos
  for delete to authenticated using ((select public.is_staff()));
drop policy if exists orcamento_itens_leitura on public.orcamento_itens;
create policy orcamento_itens_leitura on public.orcamento_itens
  for select to authenticated using ((select public.is_staff()));

-- ───── Totais (sempre recalculados no banco) ─────
create or replace function public.orcamento_recalcular(p_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_sub numeric(12,2);
  v_tipo public.tipo_desconto;
  v_desc numeric(12,2);
  v_valor numeric(12,2);
begin
  select coalesce(sum(total), 0) into v_sub from public.orcamento_itens where orcamento_id = p_id;
  select desconto_tipo, desconto into v_tipo, v_desc from public.orcamentos where id = p_id;
  v_valor := least(v_sub, case when v_tipo = 'percentual' then round(v_sub * v_desc / 100, 2) else v_desc end);
  update public.orcamentos set subtotal = v_sub, desconto_valor = v_valor, total = v_sub - v_valor where id = p_id;
end;
$$;

-- ───── Salvar (criar ou editar rascunho/enviado) com os itens ─────
-- p_dados: {paciente_id, data_emissao, validade, desconto_tipo, desconto, condicoes_pagamento, prazo_entrega, observacoes}
-- p_itens: [{produto_id?, tipo, secao?, descricao, detalhe?, quantidade, unidade, preco_unitario, salvar_na_tabela?}, ...]
create or replace function public.salvar_orcamento(p_id uuid, p_dados jsonb, p_itens jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_status public.status_orcamento;
  v_emissao date;
  v_validade date;
  v_ano int;
  v_seq int;
  v_item jsonb;
  v_ordem int := 0;
  v_produto uuid;
  v_preco numeric(12,2);
begin
  if not public.is_staff() then
    raise exception 'acesso negado' using errcode = '42501';
  end if;
  if jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'inclua pelo menos um item' using errcode = '22023';
  end if;
  if jsonb_array_length(p_itens) > 200 then
    raise exception 'máximo de 200 itens por orçamento' using errcode = '22023';
  end if;

  v_emissao := coalesce(nullif(p_dados->>'data_emissao', '')::date, current_date);
  v_validade := coalesce(nullif(p_dados->>'validade', '')::date, v_emissao + 15);

  if p_id is null then
    v_ano := extract(year from v_emissao)::int;
    -- numeração sem buracos nem repetição, mesmo com duas pessoas salvando ao mesmo tempo
    perform pg_advisory_xact_lock(hashtext('orcamentos_numero'), v_ano);
    select coalesce(max(sequencial), 0) + 1 into v_seq from public.orcamentos where ano = v_ano;
    insert into public.orcamentos (ano, sequencial, paciente_id, data_emissao, validade, desconto_tipo, desconto,
                                   condicoes_pagamento, prazo_entrega, observacoes)
    values (v_ano, v_seq,
            (p_dados->>'paciente_id')::uuid,
            v_emissao, v_validade,
            coalesce(nullif(p_dados->>'desconto_tipo', ''), 'valor')::public.tipo_desconto,
            coalesce(nullif(p_dados->>'desconto', '')::numeric, 0),
            nullif(btrim(p_dados->>'condicoes_pagamento'), ''),
            nullif(btrim(p_dados->>'prazo_entrega'), ''),
            nullif(btrim(p_dados->>'observacoes'), ''))
    returning id into v_id;
  else
    select status into v_status from public.orcamentos where id = p_id for update;
    if not found then
      raise exception 'orçamento não encontrado' using errcode = 'P0002';
    end if;
    if v_status not in ('rascunho', 'enviado') then
      raise exception 'orçamento travado: crie uma nova versão' using errcode = '55000';
    end if;
    update public.orcamentos set
      paciente_id         = (p_dados->>'paciente_id')::uuid,
      data_emissao        = v_emissao,
      validade            = v_validade,
      desconto_tipo       = coalesce(nullif(p_dados->>'desconto_tipo', ''), 'valor')::public.tipo_desconto,
      desconto            = coalesce(nullif(p_dados->>'desconto', '')::numeric, 0),
      condicoes_pagamento = nullif(btrim(p_dados->>'condicoes_pagamento'), ''),
      prazo_entrega       = nullif(btrim(p_dados->>'prazo_entrega'), ''),
      observacoes         = nullif(btrim(p_dados->>'observacoes'), '')
    where id = p_id;
    v_id := p_id;
    delete from public.orcamento_itens where orcamento_id = v_id;
  end if;

  -- "salvar na tabela": o novo preço entra no histórico com origem 'orcamento'
  perform set_config('orto.origem_preco', 'orcamento', true);
  for v_item in select * from jsonb_array_elements(p_itens) loop
    v_ordem := v_ordem + 1;
    v_produto := nullif(v_item->>'produto_id', '')::uuid;
    v_preco := (v_item->>'preco_unitario')::numeric;
    insert into public.orcamento_itens (orcamento_id, ordem, produto_id, tipo, secao, descricao, detalhe, quantidade, unidade, preco_unitario)
    values (v_id, v_ordem, v_produto,
            coalesce(nullif(v_item->>'tipo', ''), 'base')::public.tipo_produto,
            nullif(btrim(v_item->>'secao'), ''),
            btrim(v_item->>'descricao'),
            nullif(btrim(v_item->>'detalhe'), ''),
            (v_item->>'quantidade')::numeric,
            coalesce(nullif(btrim(v_item->>'unidade'), ''), 'un'),
            v_preco);
    if v_produto is not null and coalesce((v_item->>'salvar_na_tabela')::boolean, false) then
      update public.produtos set preco = v_preco where id = v_produto and preco is distinct from v_preco;
    end if;
  end loop;
  perform set_config('orto.origem_preco', '', true);

  perform public.orcamento_recalcular(v_id);
  return v_id;
end;
$$;

-- ───── Enviado / recusado / reaberto ─────
create or replace function public.mudar_status_orcamento(p_id uuid, p_status public.status_orcamento)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.status_orcamento;
begin
  if not public.is_staff() then
    raise exception 'acesso negado' using errcode = '42501';
  end if;
  if p_status not in ('enviado', 'recusado') then
    raise exception 'use aprovar_orcamento ou nova_versao_orcamento' using errcode = '22023';
  end if;
  select status into v_status from public.orcamentos where id = p_id for update;
  if not found then
    raise exception 'orçamento não encontrado' using errcode = 'P0002';
  end if;
  if v_status not in ('rascunho', 'enviado', 'recusado') then
    raise exception 'orçamento travado' using errcode = '55000';
  end if;
  update public.orcamentos
     set status = p_status,
         enviado_em = case when p_status = 'enviado' then coalesce(enviado_em, now()) else enviado_em end
   where id = p_id;
end;
$$;

-- ───── Aprovar: trava o orçamento e cria (ou atualiza) o atendimento ─────
-- Se a versão anterior já tinha gerado um atendimento, ele é atualizado em vez de duplicado.
-- p_hoje vem do navegador (fuso de quem usa).
create or replace function public.aprovar_orcamento(p_id uuid, p_hoje date)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_o public.orcamentos;
  v_at uuid;
  v_desc text;
begin
  if not public.is_staff() then
    raise exception 'acesso negado' using errcode = '42501';
  end if;
  select * into v_o from public.orcamentos where id = p_id for update;
  if not found then
    raise exception 'orçamento não encontrado' using errcode = 'P0002';
  end if;
  if v_o.status not in ('rascunho', 'enviado') then
    raise exception 'só orçamentos em rascunho ou enviados podem ser aprovados' using errcode = '55000';
  end if;

  select left(string_agg(i.descricao, ' + ' order by i.ordem), 240) into v_desc
    from public.orcamento_itens i where i.orcamento_id = p_id and i.tipo = 'base';
  v_desc := coalesce(v_desc, 'Orçamento ' || v_o.numero);

  if v_o.versao_anterior_id is not null then
    select a.id into v_at
      from public.orcamentos ant join public.atendimentos a on a.id = ant.atendimento_id
     where ant.id = v_o.versao_anterior_id;
  end if;

  if v_at is not null then
    update public.atendimentos set valor = v_o.total, descricao = v_desc where id = v_at;
  else
    insert into public.atendimentos (paciente_id, categoria, descricao, status, data_primeiro_contato, data_fechamento, valor, observacoes)
    values (v_o.paciente_id, 'confeccao', v_desc, 'em_producao', least(v_o.data_emissao, p_hoje), p_hoje, v_o.total,
            'Gerado pela aprovação do orçamento ' || v_o.numero || '.')
    returning id into v_at;
  end if;

  update public.orcamentos set status = 'aprovado', aprovado_em = now(), atendimento_id = v_at where id = p_id;
  update public.orcamentos set status = 'substituido'
   where ano = v_o.ano and sequencial = v_o.sequencial and id <> p_id and status <> 'substituido';
  return v_at;
end;
$$;

-- ───── Nova versão (de um aprovado ou recusado) ─────
create or replace function public.nova_versao_orcamento(p_id uuid, p_hoje date)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_o public.orcamentos;
  v_id uuid;
begin
  if not public.is_staff() then
    raise exception 'acesso negado' using errcode = '42501';
  end if;
  select * into v_o from public.orcamentos where id = p_id for update;
  if not found then
    raise exception 'orçamento não encontrado' using errcode = 'P0002';
  end if;
  if v_o.status not in ('aprovado', 'recusado') then
    raise exception 'rascunhos e enviados podem ser editados direto' using errcode = '55000';
  end if;
  if exists (select 1 from public.orcamentos where ano = v_o.ano and sequencial = v_o.sequencial and versao > v_o.versao) then
    raise exception 'já existe uma versão mais nova deste orçamento' using errcode = '55000';
  end if;

  insert into public.orcamentos (ano, sequencial, versao, versao_anterior_id, paciente_id, data_emissao, validade,
                                 desconto_tipo, desconto, subtotal, desconto_valor, total,
                                 condicoes_pagamento, prazo_entrega, observacoes)
  values (v_o.ano, v_o.sequencial, v_o.versao + 1, v_o.id, v_o.paciente_id, greatest(p_hoje, v_o.data_emissao),
          greatest(p_hoje, v_o.data_emissao) + (v_o.validade - v_o.data_emissao),
          v_o.desconto_tipo, v_o.desconto, v_o.subtotal, v_o.desconto_valor, v_o.total,
          v_o.condicoes_pagamento, v_o.prazo_entrega, v_o.observacoes)
  returning id into v_id;

  insert into public.orcamento_itens (orcamento_id, ordem, produto_id, tipo, secao, descricao, detalhe, quantidade, unidade, preco_unitario)
  select v_id, ordem, produto_id, tipo, secao, descricao, detalhe, quantidade, unidade, preco_unitario
    from public.orcamento_itens where orcamento_id = p_id;

  return v_id;
end;
$$;

revoke execute on function public.salvar_orcamento(uuid, jsonb, jsonb) from public, anon;
revoke execute on function public.mudar_status_orcamento(uuid, public.status_orcamento) from public, anon;
revoke execute on function public.aprovar_orcamento(uuid, date) from public, anon;
revoke execute on function public.nova_versao_orcamento(uuid, date) from public, anon;
grant execute on function public.salvar_orcamento(uuid, jsonb, jsonb) to authenticated;
grant execute on function public.mudar_status_orcamento(uuid, public.status_orcamento) to authenticated;
grant execute on function public.aprovar_orcamento(uuid, date) to authenticated;
grant execute on function public.nova_versao_orcamento(uuid, date) to authenticated;
revoke execute on function public.orcamento_recalcular(uuid) from public, anon, authenticated;
revoke execute on function public.orcamento_protege_exclusao() from public, anon, authenticated;

-- ───── Painel: liga "Orçamentos em aberto" e "Orçamentos recentes" ─────
create or replace function public.painel_resumo(p_hoje date)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_ativos public.status_atendimento[] := array['em_contato', 'em_producao', 'pronto']::public.status_atendimento[];
  v_resultado jsonb;
begin
  if not public.is_staff() then
    raise exception 'acesso negado' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'em_contato',      count(*) filter (where a.status = 'em_contato'),
    'em_producao',     count(*) filter (where a.status = 'em_producao'),
    'prontos',         count(*) filter (where a.status = 'pronto'),
    'entregues_mes',   count(*) filter (where a.status = 'entregue' and a.data_conclusao >= date_trunc('month', p_hoje)::date),
    'entregas_semana', count(*) filter (where a.status = any (v_ativos) and a.prazo_entrega between p_hoje and p_hoje + 6),
    'atrasados',       count(*) filter (where a.status = any (v_ativos) and a.prazo_entrega < p_hoje),
    'a_receber',       coalesce(sum(a.valor - a.valor_pago) filter (where a.pagamento_status in ('pendente', 'parcial') and a.status <> 'cancelado'), 0),
    'pagamentos_abertos', count(*) filter (where a.pagamento_status in ('pendente', 'parcial') and a.status <> 'cancelado')
  )
  into v_resultado
  from public.atendimentos a;

  v_resultado := v_resultado || (
    select jsonb_build_object(
      'orcamentos_abertos', count(*),
      'orcamentos_valor_aberto', coalesce(sum(o.total), 0),
      'orcamentos_vencidos', count(*) filter (where o.validade < p_hoje)
    )
    from public.orcamentos o
    where o.status in ('rascunho', 'enviado')
  );

  v_resultado := v_resultado || jsonb_build_object('prazos', coalesce((
    select jsonb_agg(x order by x.prazo_entrega, x.numero)
    from (
      select a.id, a.numero, a.status, a.prazo_entrega, a.categoria,
             coalesce(nullif(a.descricao, ''), f.produto) as servico,
             p.nome as paciente
      from public.atendimentos a
      join public.pacientes p on p.id = a.paciente_id
      left join public.fichas_tecnicas f on f.atendimento_id = a.id
      where a.status = any (v_ativos) and a.prazo_entrega is not null
      order by a.prazo_entrega, a.numero
      limit 6
    ) x
  ), '[]'::jsonb));

  v_resultado := v_resultado || jsonb_build_object('receber', coalesce((
    select jsonb_agg(x order by x.restante desc, x.numero)
    from (
      select a.id, a.numero, a.pagamento_status, a.pagamento_forma, a.pagamento_detalhe,
             (a.valor - a.valor_pago) as restante,
             p.nome as paciente
      from public.atendimentos a
      join public.pacientes p on p.id = a.paciente_id
      where a.pagamento_status in ('pendente', 'parcial') and a.status <> 'cancelado'
      order by (a.valor - a.valor_pago) desc, a.numero
      limit 5
    ) x
  ), '[]'::jsonb));

  v_resultado := v_resultado || jsonb_build_object('orcamentos', coalesce((
    select jsonb_agg(x order by x.updated_at desc)
    from (
      select o.id, o.numero, o.status, o.total, o.validade, o.updated_at, p.nome as paciente
      from public.orcamentos o
      join public.pacientes p on p.id = o.paciente_id
      where o.status <> 'substituido'
      order by o.updated_at desc
      limit 5
    ) x
  ), '[]'::jsonb));

  return v_resultado;
end;
$$;

revoke execute on function public.painel_resumo(date) from public, anon;
grant execute on function public.painel_resumo(date) to authenticated;
