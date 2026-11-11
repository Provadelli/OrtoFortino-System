-- ═══════════════════════════════════════════════════════════════════
-- Fase 7 · Configurações e verificação em duas etapas
-- 1) configuracoes: linha única com dados da empresa, padrões do
--    orçamento e listas da ficha técnica (antes fixos no código).
-- 2) is_staff() passa a exigir sessão aal2 de quem ativou a
--    verificação em duas etapas (TOTP). Quem não ativou segue como antes.
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.configuracoes (
  id                      boolean primary key default true check (id), -- garante uma única linha
  -- Empresa (impressa no PDF e no rodapé do login). Números guardados só com dígitos.
  empresa_nome            text not null default 'Orto Fortino' check (length(btrim(empresa_nome)) between 2 and 80),
  empresa_slogan          text check (length(empresa_slogan) <= 80),
  empresa_cnpj            text check (empresa_cnpj ~ '^\d{14}$'),
  empresa_endereco        text check (length(empresa_endereco) <= 160),
  empresa_cidade          text check (length(empresa_cidade) <= 80),
  empresa_cep             text check (empresa_cep ~ '^\d{8}$'),
  empresa_telefone        text check (empresa_telefone ~ '^\d{10,11}$'),
  empresa_email           text check (length(empresa_email) <= 254 and empresa_email ~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$'),
  -- Padrões de orçamento novo
  orc_validade_dias       integer not null default 15 check (orc_validade_dias between 1 and 365),
  orc_condicoes_pagamento text check (length(orc_condicoes_pagamento) <= 400),
  orc_prazo_entrega       text check (length(orc_prazo_entrega) <= 120),
  orc_observacoes         text check (length(orc_observacoes) <= 4000),
  -- Sugestões da ficha técnica (o campo continua aceitando texto livre)
  ficha_produtos          text[] not null default '{}' check (cardinality(ficha_produtos) <= 80),
  ficha_especificacoes    text[] not null default '{}' check (cardinality(ficha_especificacoes) <= 80),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  updated_by              uuid references auth.users(id) default auth.uid()
);

comment on table public.configuracoes is 'Linha única com os dados da empresa, padrões do orçamento e listas da ficha.';

drop trigger if exists configuracoes_audit on public.configuracoes;
create trigger configuracoes_audit before update on public.configuracoes
  for each row execute function public.set_audit();

-- Semente com os valores que estavam fixos no código até a Fase 6.
insert into public.configuracoes (id, empresa_nome, empresa_slogan, empresa_cnpj, empresa_endereco, empresa_cidade, empresa_cep,
                                  empresa_telefone, empresa_email, orc_validade_dias, ficha_produtos, ficha_especificacoes)
values (true, 'Orto Fortino', 'Órteses Funcionais', '34130423000148', 'Rua Itapicuru, 151, Quadra B Lote 40 - Bairro Kennedy',
        'Nova Iguaçu - RJ', '26020560', '21964973837', 'ortofortino@hotmail.com', 15,
        array['AFO fixa', 'AFO articulada', 'KAFO', 'H-KAFO', 'SMO forrada', 'SMO c/ flexível', 'Colete OTLS', 'Extensores', 'Palmilha sob medida'],
        array['90°', 'Tira valgo', 'Tira varo', 'Tira de travamento', 'Tira de tração', 'Pés pronados', 'Pés supinados',
              'Orifícios de ventilação', 'Elevar arco plantar', 'Acomodar equino'])
on conflict (id) do nothing;

-- ───── RLS: a equipe lê e altera; ninguém insere outra linha nem apaga ─────
alter table public.configuracoes enable row level security;
revoke all on public.configuracoes from anon;
grant select, update on public.configuracoes to authenticated;

drop policy if exists configuracoes_leitura on public.configuracoes;
create policy configuracoes_leitura on public.configuracoes
  for select to authenticated
  using ((select public.is_staff()));

drop policy if exists configuracoes_edicao on public.configuracoes;
create policy configuracoes_edicao on public.configuracoes
  for update to authenticated
  using ((select public.is_staff()))
  with check ((select public.is_staff()));

-- ───── Verificação em duas etapas ─────
-- Quem tem um fator TOTP verificado só passa com sessão aal2 (senha + código).
-- Isso vale também para quem chamar a API do Supabase direto, sem passar pelo BFF.
-- security definer: o papel authenticated não lê auth.mfa_factors.
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.role() = 'authenticated'
     and auth.uid() is not null
     and (
       coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
       or not exists (
         select 1 from auth.mfa_factors f
         where f.user_id = auth.uid() and f.status = 'verified'
       )
     );
$$;

comment on function public.is_staff() is 'Usado nas policies RLS: usuário autenticado e, se ativou a verificação em duas etapas, com sessão aal2.';

revoke execute on function public.is_staff() from public, anon;
grant execute on function public.is_staff() to authenticated;
