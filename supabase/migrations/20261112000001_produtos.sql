-- ═══════════════════════════════════════════════════════════════════
-- Fase 4 · Tabela de preços
-- produtos (base ou adicional) + histórico automático de preços
-- + importação por planilha numa única transação.
-- Regra 5 do README: produto em uso é desativado, nunca excluído
-- (os itens de orçamento da Fase 5 referenciam produtos com on delete restrict).
-- ═══════════════════════════════════════════════════════════════════

do $$ begin
  create type public.tipo_produto as enum ('base', 'adicional');
exception when duplicate_object then null; end $$;

create table if not exists public.produtos (
  id          uuid primary key default gen_random_uuid(),
  codigo      text check (length(codigo) between 1 and 30),
  nome        text not null check (length(btrim(nome)) between 2 and 160),
  nome_busca  text generated always as (public.f_unaccent(lower(btrim(nome)))) stored,
  tipo        public.tipo_produto not null default 'base',
  categoria   text check (length(categoria) <= 80),
  descricao   text check (length(descricao) <= 1000),
  unidade     text not null default 'un' check (length(unidade) between 1 and 20),
  preco       numeric(12,2) not null default 0 check (preco >= 0 and preco <= 1000000),
  ativo       boolean not null default true,
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id) default auth.uid(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users(id) default auth.uid()
);

-- Código e nome não se repetem (nome comparado sem acento e sem diferenciar maiúsculas).
create unique index if not exists produtos_codigo_uniq on public.produtos (lower(codigo)) where codigo is not null;
create unique index if not exists produtos_nome_uniq on public.produtos (nome_busca);
create index if not exists produtos_lista_idx on public.produtos (ativo, tipo, categoria, nome_busca);

drop trigger if exists produtos_audit on public.produtos;
create trigger produtos_audit before update on public.produtos
  for each row execute function public.set_audit();

-- ───── Histórico de preços (só leitura para a equipe; escrito pelo trigger) ─────
create table if not exists public.historico_precos (
  id              uuid primary key default gen_random_uuid(),
  produto_id      uuid not null references public.produtos(id) on delete cascade,
  preco_anterior  numeric(12,2),
  preco_novo      numeric(12,2) not null,
  origem          text not null default 'manual' check (origem in ('manual', 'importacao', 'orcamento')),
  alterado_em     timestamptz not null default now(),
  alterado_por    uuid references auth.users(id) default auth.uid()
);

create index if not exists historico_precos_produto_idx on public.historico_precos (produto_id, alterado_em desc);

-- security definer: a equipe não tem permissão de escrita direta no histórico,
-- então ele não pode ser forjado nem apagado pelo cliente.
-- A origem vem de uma configuração local da transação (ver importar_produtos).
create or replace function public.registrar_preco()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.preco is distinct from old.preco then
    insert into public.historico_precos (produto_id, preco_anterior, preco_novo, origem, alterado_por)
    values (new.id,
            case when tg_op = 'UPDATE' then old.preco end,
            new.preco,
            coalesce(nullif(current_setting('orto.origem_preco', true), ''), 'manual'),
            auth.uid());
  end if;
  return null;
end;
$$;

drop trigger if exists produtos_historico on public.produtos;
create trigger produtos_historico after insert or update of preco on public.produtos
  for each row execute function public.registrar_preco();

-- ───── RLS ─────
alter table public.produtos enable row level security;
alter table public.historico_precos enable row level security;
revoke all on public.produtos, public.historico_precos from anon;
grant select, insert, update, delete on public.produtos to authenticated;
grant select on public.historico_precos to authenticated;

drop policy if exists produtos_equipe on public.produtos;
create policy produtos_equipe on public.produtos
  for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));

drop policy if exists historico_precos_leitura on public.historico_precos;
create policy historico_precos_leitura on public.historico_precos
  for select to authenticated using ((select public.is_staff()));

-- ───── Importação por planilha ─────
-- p_itens: [{codigo?, nome, tipo, categoria?, unidade?, preco, descricao?}, ...]
-- Casa cada linha com um produto existente pelo código (se houver) ou pelo nome sem acento;
-- atualiza o que existe, cria o que falta e reativa produtos importados de novo.
-- Tudo ou nada: qualquer linha inválida desfaz a importação inteira.
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
    v_codigo := nullif(btrim(v_item->>'codigo'), '');
    v_nome := btrim(coalesce(v_item->>'nome', ''));
    v_id := null;

    if v_codigo is not null then
      select id into v_id from public.produtos where lower(codigo) = lower(v_codigo);
    end if;
    if v_id is null then
      select id into v_id from public.produtos where nome_busca = public.f_unaccent(lower(v_nome));
    end if;

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
  end loop;

  perform set_config('orto.origem_preco', '', true);
  return jsonb_build_object('criados', v_criados, 'atualizados', v_atualizados, 'inalterados', v_iguais);
end;
$$;

revoke execute on function public.importar_produtos(jsonb) from public, anon;
grant execute on function public.importar_produtos(jsonb) to authenticated;
revoke execute on function public.registrar_preco() from public, anon, authenticated;
