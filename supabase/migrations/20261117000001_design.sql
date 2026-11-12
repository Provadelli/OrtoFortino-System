-- Fase 10: design
-- 1. Medidas do boneco da ficha técnica (pontos clicáveis do desenho), salvas junto da ficha.
-- 2. Recebimentos por dia para o gráfico do painel.

alter table public.fichas_tecnicas add column if not exists medidas jsonb not null default '{}'::jsonb;
alter table public.fichas_tecnicas drop constraint if exists fichas_medidas_check;
alter table public.fichas_tecnicas add constraint fichas_medidas_check
  check (jsonb_typeof(medidas) = 'object' and pg_column_size(medidas) < 4000);

create or replace function public.salvar_atendimento(p_id uuid, p_dados jsonb, p_ficha jsonb default null)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
  v_medidas jsonb := '{}'::jsonb;
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

  -- Medidas do boneco: só chaves "diagrama.ponto" com texto curto; o resto é descartado.
  if p_ficha is not null and jsonb_typeof(p_ficha->'medidas') = 'object' then
    select coalesce(jsonb_object_agg(e.k, btrim(e.v)), '{}'::jsonb)
      into v_medidas
      from jsonb_each_text(p_ficha->'medidas') as e(k, v)
     where e.k ~ '^[a-z]+\.[a-z0-9_]+$' and length(btrim(e.v)) between 1 and 12;
  end if;

  if p_ficha is null then
    delete from public.fichas_tecnicas where atendimento_id = v_id;
  else
    insert into public.fichas_tecnicas as f (atendimento_id, tipo, lateralidade, produto, especificacoes, compensacao_lado,
                                             compensacao_medida, tamanho_calcado, medidas_ml, nome_na_ortese, tema, cor_forro,
                                             cor_tira, protese_membro, protese_nivel, protese_lado, liner, tamanho_pe, observacoes,
                                             medidas)
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
            nullif(btrim(p_ficha->>'observacoes'), ''),
            v_medidas)
    on conflict (atendimento_id) do update set
      tipo = excluded.tipo, lateralidade = excluded.lateralidade, produto = excluded.produto,
      especificacoes = excluded.especificacoes, compensacao_lado = excluded.compensacao_lado,
      compensacao_medida = excluded.compensacao_medida, tamanho_calcado = excluded.tamanho_calcado,
      medidas_ml = excluded.medidas_ml, nome_na_ortese = excluded.nome_na_ortese, tema = excluded.tema,
      cor_forro = excluded.cor_forro, cor_tira = excluded.cor_tira, protese_membro = excluded.protese_membro,
      protese_nivel = excluded.protese_nivel, protese_lado = excluded.protese_lado, liner = excluded.liner,
      tamanho_pe = excluded.tamanho_pe, observacoes = excluded.observacoes, medidas = excluded.medidas;
  end if;

  return v_id;
end;
$$;

-- Soma do valor pago por data de pagamento (o sistema guarda o total pago e a data do último pagamento).
create or replace function public.painel_recebimentos(p_de date, p_ate date)
returns table (dia date, total numeric)
language sql
stable
security invoker
set search_path = ''
as $$
  select a.data_pagamento, sum(a.valor_pago)
    from public.atendimentos a
   where a.data_pagamento between p_de and p_ate
     and p_ate - p_de <= 800
     and a.valor_pago > 0
     and a.status <> 'cancelado'
   group by a.data_pagamento
   order by a.data_pagamento;
$$;
revoke execute on function public.painel_recebimentos(date, date) from public, anon;
grant execute on function public.painel_recebimentos(date, date) to authenticated;
