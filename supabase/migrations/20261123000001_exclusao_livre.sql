-- ═══════════════════════════════════════════════════════════════════
-- Exclusão livre (com confirmação forte na tela)
-- Antes: orçamento aprovado/substituído, paciente com histórico e produto em
-- uso não podiam ser excluídos (trigger e FKs), e a equipe ficava presa.
-- Agora a equipe pode excluir qualquer registro; a proteção contra acidente é
-- a caixa de confirmação (ConfirmDialog) que mostra o que será apagado.
--   • excluir paciente  → apaga atendimentos (e fichas) e orçamentos dele;
--   • excluir produto   → itens de orçamento antigos mantêm descrição e preço
--                          (copiados no item), só perdem o vínculo.
-- A RLS não muda: só is_staff() exclui.
-- ═══════════════════════════════════════════════════════════════════

-- 1. Orçamento aprovado/substituído deixa de ser protegido contra exclusão.
drop trigger if exists orcamentos_protege_exclusao on public.orcamentos;
drop function if exists public.orcamento_protege_exclusao();

-- 2. Paciente: o histórico vai junto.
alter table public.atendimentos
  drop constraint if exists atendimentos_paciente_id_fkey,
  add constraint atendimentos_paciente_id_fkey
    foreign key (paciente_id) references public.pacientes(id) on delete cascade;

alter table public.orcamentos
  drop constraint if exists orcamentos_paciente_id_fkey,
  add constraint orcamentos_paciente_id_fkey
    foreign key (paciente_id) references public.pacientes(id) on delete cascade;

-- 3. Produto: o item do orçamento já guarda descrição e preço próprios.
alter table public.orcamento_itens
  drop constraint if exists orcamento_itens_produto_id_fkey,
  add constraint orcamento_itens_produto_id_fkey
    foreign key (produto_id) references public.produtos(id) on delete set null;
