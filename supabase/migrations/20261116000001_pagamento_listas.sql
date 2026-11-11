-- Fase 9: pagamento organizado e listas com filtros
-- 1. Crédito e débito separados (o antigo "cartao" continua válido para registros existentes).
-- 2. Número de parcelas (crédito e boleto).
-- 3. Sai a função de sugestões do cadastro de paciente (o formulário voltou a ter campos livres).

alter type public.forma_pagamento add value if not exists 'credito';
alter type public.forma_pagamento add value if not exists 'debito';

alter table public.atendimentos add column if not exists pagamento_parcelas smallint;
alter table public.atendimentos drop constraint if exists atendimentos_parcelas_check;
alter table public.atendimentos add constraint atendimentos_parcelas_check check (pagamento_parcelas is null or pagamento_parcelas between 1 and 24);

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
                                     pagamento_parcelas, data_pagamento, observacoes)
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
            nullif(p_dados->>'pagamento_parcelas', '')::smallint,
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
      pagamento_parcelas    = nullif(p_dados->>'pagamento_parcelas', '')::smallint,
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

drop function if exists public.sugestoes_paciente();

-- 4. Busca de pacientes com filtros opcionais (origem e faixa etária). Sem filtros = todos.
drop function if exists public.buscar_pacientes(text, int, int);
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
            or (length(t.dig) >= 3 and p.cpf like '%' || t.dig || '%'))
       and (coalesce(cardinality(origens), 0) = 0 or p.origem::text = any (origens))
       and (coalesce(cardinality(faixas), 0) = 0
            or ('menor' = any (faixas) and p.data_nascimento > (current_date - interval '18 years'))
            or ('adulto' = any (faixas) and p.data_nascimento <= (current_date - interval '18 years'))
            or ('sem_data' = any (faixas) and p.data_nascimento is null))
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
revoke execute on function public.buscar_pacientes(text, int, int, text[], text[]) from public, anon;
grant execute on function public.buscar_pacientes(text, int, int, text[], text[]) to authenticated;
