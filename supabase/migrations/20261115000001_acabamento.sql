-- Fase 8: acabamento
-- 1. CEP do paciente (preenche endereço pelo ViaCEP no formulário).
-- 2. salvar_paciente grava o CEP.
-- 3. importar_produtos v2: em conflito de código/nome, diz qual item e qual campo (antes: erro genérico).
-- 4. sugestoes_paciente: clínicas/operadoras e médicos já usados, para sugerir no cadastro.

alter table public.pacientes add column if not exists cep text;
alter table public.pacientes drop constraint if exists pacientes_cep_check;
alter table public.pacientes add constraint pacientes_cep_check check (cep is null or cep ~ '^[0-9]{8}$');

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
    insert into public.pacientes (nome, cpf, data_nascimento, telefone, cep, endereco, cidade, uf, origem, origem_nome,
                                  medico, diagnostico, observacoes, consentimento_lgpd_em)
    values (btrim(p_dados->>'nome'),
            nullif(p_dados->>'cpf', ''),
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
      cpf             = nullif(p_dados->>'cpf', ''),
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

create or replace function public.importar_produtos(p_itens jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_item jsonb;
  v_codigo text;
  v_nome text;
  v_id uuid;
  v_antes public.produtos;
  v_depois public.produtos;
  v_criados int := 0;
  v_atualizados int := 0;
  v_iguais int := 0;
  v_n int := 0;
  v_restricao text;
begin
  if not public.is_staff() then
    raise exception 'acesso negado' using errcode = '42501';
  end if;
  if jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'nenhum item para importar' using errcode = '22023';
  end if;
  if jsonb_array_length(p_itens) > 2000 then
    raise exception 'máximo de 2000 itens por importação' using errcode = '22023';
  end if;

  perform set_config('orto.origem_preco', 'importacao', true);

  for v_item in select * from jsonb_array_elements(p_itens) loop
    v_n := v_n + 1;
    v_codigo := nullif(btrim(v_item->>'codigo'), '');
    v_nome := btrim(coalesce(v_item->>'nome', ''));
    v_id := null;

    if v_codigo is not null then
      select id into v_id from public.produtos where lower(codigo) = lower(v_codigo);
    end if;
    if v_id is null then
      select id into v_id from public.produtos where nome_busca = public.f_unaccent(lower(v_nome));
    end if;

    begin
    if v_id is null then
      insert into public.produtos (codigo, nome, tipo, categoria, unidade, preco, descricao)
      values (v_codigo,
              v_nome,
              coalesce(nullif(v_item->>'tipo', ''), 'base')::public.tipo_produto,
              nullif(btrim(v_item->>'categoria'), ''),
              coalesce(nullif(btrim(v_item->>'unidade'), ''), 'un'),
              (v_item->>'preco')::numeric,
              nullif(btrim(v_item->>'descricao'), ''));
      v_criados := v_criados + 1;
    else
      select * into v_antes from public.produtos where id = v_id;
      update public.produtos set
        codigo    = coalesce(v_codigo, codigo),
        nome      = v_nome,
        tipo      = coalesce(nullif(v_item->>'tipo', ''), 'base')::public.tipo_produto,
        categoria = coalesce(nullif(btrim(v_item->>'categoria'), ''), categoria),
        unidade   = coalesce(nullif(btrim(v_item->>'unidade'), ''), unidade),
        preco     = (v_item->>'preco')::numeric,
        descricao = coalesce(nullif(btrim(v_item->>'descricao'), ''), descricao),
        ativo     = true
      where id = v_id
      returning * into v_depois;
      if (v_antes.codigo, v_antes.nome, v_antes.tipo, v_antes.categoria, v_antes.unidade, v_antes.preco, v_antes.descricao, v_antes.ativo)
         is not distinct from
         (v_depois.codigo, v_depois.nome, v_depois.tipo, v_depois.categoria, v_depois.unidade, v_depois.preco, v_depois.descricao, v_depois.ativo) then
        v_iguais := v_iguais + 1;
      else
        v_atualizados := v_atualizados + 1;
      end if;
    end if;
    exception when unique_violation then
      -- Tudo ou nada: aborta a importação inteira, dizendo qual item (1, 2, …) e qual campo conflitou.
      get stacked diagnostics v_restricao = constraint_name;
      raise exception 'código ou nome já usado por outro produto (item %)', v_n
        using errcode = '23505',
              detail = v_n::text,
              hint = case when v_restricao like '%codigo%' then 'codigo' else 'nome' end;
    end;
  end loop;

  perform set_config('orto.origem_preco', '', true);
  return jsonb_build_object('criados', v_criados, 'atualizados', v_atualizados, 'inalterados', v_iguais);
end;
$$;

create or replace function public.sugestoes_paciente()
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if not public.is_staff() then
    raise exception 'acesso negado' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'origens', coalesce((
      select jsonb_agg(v order by n desc, v)
        from (select origem_nome as v, count(*) as n
                from public.pacientes
               where origem_nome is not null and origem <> 'particular'
               group by origem_nome
               order by n desc, origem_nome
               limit 100) o), '[]'::jsonb),
    'medicos', coalesce((
      select jsonb_agg(v order by n desc, v)
        from (select medico as v, count(*) as n
                from public.pacientes
               where medico is not null
               group by medico
               order by n desc, medico
               limit 100) m), '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.sugestoes_paciente() from public, anon;
grant execute on function public.sugestoes_paciente() to authenticated;
