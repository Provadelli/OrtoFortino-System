-- ═══════════════════════════════════════════════════════════════════
-- Orto Fortino · Fundação
-- Funções utilitárias de auditoria usadas por TODAS as tabelas de negócio.
-- Padrão para cada nova tabela (etapas 1+):
--   created_at timestamptz not null default now(),
--   updated_at timestamptz not null default now(),
--   updated_by uuid references auth.users(id) default auth.uid(),
--   + trigger set_audit
--   + alter table ... enable row level security; (sempre!)
-- ═══════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto with schema extensions;
create extension if not exists unaccent with schema extensions;

-- Atualiza updated_at/updated_by em todo UPDATE.
create or replace function public.set_audit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end;
$$;

comment on function public.set_audit() is 'Trigger de auditoria: preenche updated_at e updated_by (LGPD).';

-- Sistema interno sem cadastro público: qualquer usuário autenticado é da equipe.
-- Centralizado aqui para que as policies das próximas etapas fiquem simples
-- e para endurecer depois (ex.: exigir MFA/aal2) num único lugar.
create or replace function public.is_staff()
returns boolean
language sql
stable
set search_path = ''
as $$
  select auth.role() = 'authenticated' and auth.uid() is not null;
$$;

comment on function public.is_staff() is 'Usado nas policies RLS. Ponto único para endurecer o acesso (ex.: aal2).';

-- Remove privilégios padrão do papel anônimo em objetos futuros do schema public.
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on functions from anon;
alter default privileges in schema public revoke all on sequences from anon;
revoke execute on function public.set_audit() from anon, authenticated;
revoke execute on function public.is_staff() from anon;
