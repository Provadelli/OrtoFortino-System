import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { formatMoneyInput, normalizeSearch, todayIso } from '@/lib/br'
import { db } from '@/lib/supabase'
import type { StatusOrcamento } from './constants'
import { toPayload, type OrcamentoForm } from './schema'

export const PAGE_SIZE = 25

const keys = {
  all: ['orcamentos'] as const,
  list: (f: string[], q: string, page: number) => ['orcamentos', 'lista', [...f].sort().join(','), q, page] as const,
  one: (id: string) => ['orcamentos', 'um', id] as const,
  doPaciente: (id: string) => ['orcamentos', 'paciente', id] as const,
  doAtendimento: (id: string) => ['orcamentos', 'atendimento', id] as const,
}

/** Orçamentos mexem no painel (prefixo 'atendimentos'), nos atendimentos (aprovar) e na tabela de preços ("salvar na tabela"). */
function invalidar(qc: QueryClient, extra: ('atendimentos' | 'produtos')[] = []) {
  void qc.invalidateQueries({ queryKey: keys.all })
  void qc.invalidateQueries({ queryKey: ['atendimentos', 'painel'] })
  for (const k of extra) void qc.invalidateQueries({ queryKey: [k] })
}

const LISTA_COLS = 'id, numero, status, data_emissao, validade, total, versao, updated_at'
const num = (v: unknown) => Number(v) // numeric pode chegar como string

/** Lista com filtros combináveis: situações entre si somam (OU); "vencidos" restringe (E). Sem filtros = todos. */
export function useOrcamentos(filtros: string[], q: string, page: number) {
  return useQuery({
    queryKey: keys.list(filtros, q, page),
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let query = db().from('orcamentos').select(`${LISTA_COLS}, pacientes!inner(id, nome, nome_busca)`, { count: 'exact' })
      const busca = q.trim()
      // Com número ("0012", "ORC-2026-0012") busca pelo número; senão, pelo nome do paciente.
      if (/\d/.test(busca)) query = query.ilike('numero', `%${busca.replace(/[%_\\]/g, '')}%`)
      else if (busca) query = query.like('pacientes.nome_busca', `%${normalizeSearch(busca).replace(/[%_\\]/g, '')}%`)
      const situacoes = filtros.filter((f): f is StatusOrcamento => ['rascunho', 'enviado', 'aprovado', 'recusado'].includes(f))
      if (filtros.includes('vencidos')) {
        const abertas = (situacoes.length ? situacoes : ['rascunho', 'enviado']).filter((x) => x === 'rascunho' || x === 'enviado')
        query = query.in('status', abertas.length ? abertas : ['__nenhum__' as StatusOrcamento]).lt('validade', todayIso())
      } else if (situacoes.length) query = query.in('status', situacoes)
      const { data, error, count } = await query
        .order('ano', { ascending: false })
        .order('sequencial', { ascending: false })
        .order('versao', { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)
      if (error) throw error
      return { rows: (data ?? []).map((o) => ({ ...o, total: num(o.total) })), total: count ?? 0 }
    },
  })
}

export function useOrcamentosDoPaciente(pacienteId: string | undefined) {
  return useQuery({
    queryKey: keys.doPaciente(pacienteId ?? ''),
    enabled: !!pacienteId,
    queryFn: async () => {
      const { data, error } = await db()
        .from('orcamentos')
        .select(LISTA_COLS)
        .eq('paciente_id', pacienteId!)
        .order('ano', { ascending: false })
        .order('sequencial', { ascending: false })
        .order('versao', { ascending: false })
        .limit(50)
      if (error) throw error
      return (data ?? []).map((o) => ({ ...o, total: num(o.total) }))
    },
  })
}

/** Orçamento que gerou um atendimento (mostrado na página do atendimento). */
export function useOrcamentoDoAtendimento(atendimentoId: string | undefined) {
  return useQuery({
    queryKey: keys.doAtendimento(atendimentoId ?? ''),
    enabled: !!atendimentoId,
    queryFn: async () => {
      const { data, error } = await db()
        .from('orcamentos')
        .select('id, numero')
        .eq('atendimento_id', atendimentoId!)
        .order('versao', { ascending: false })
        .limit(1)
      if (error) throw error
      return data?.[0] ?? null
    },
  })
}

export function useOrcamento(id: string | undefined) {
  return useQuery({
    queryKey: keys.one(id ?? ''),
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await db()
        .from('orcamentos')
        .select(
          '*, pacientes(id, nome, cpf, data_nascimento, telefone, responsaveis(nome, cpf, telefone, parentesco, principal)), orcamento_itens(id, ordem, produto_id, tipo, secao, descricao, detalhe, quantidade, unidade, preco_unitario, total, produtos(preco, ativo))',
        )
        .eq('id', id!)
        .order('ordem', { referencedTable: 'orcamento_itens' })
        .maybeSingle()
      if (error) throw error
      if (!data) return null
      // As outras versões do mesmo número
      const { data: versoes, error: e2 } = await db()
        .from('orcamentos')
        .select('id, numero, versao, status, total, updated_at')
        .eq('ano', data.ano)
        .eq('sequencial', data.sequencial)
        .order('versao', { ascending: false })
      if (e2) throw e2
      return {
        ...data,
        subtotal: num(data.subtotal),
        desconto: num(data.desconto),
        desconto_valor: num(data.desconto_valor),
        total: num(data.total),
        orcamento_itens: data.orcamento_itens.map((i) => ({
          ...i,
          quantidade: num(i.quantidade),
          preco_unitario: num(i.preco_unitario),
          total: num(i.total),
          produtos: i.produtos ? { ...i.produtos, preco: num(i.produtos.preco) } : null,
        })),
        versoes: (versoes ?? []).map((v) => ({ ...v, total: num(v.total) })),
      }
    },
  })
}

export type Orcamento = NonNullable<ReturnType<typeof useOrcamento>['data']>

/** Registro do banco → formulário (preço de tabela atual para o "salvar na tabela"). */
export function toForm(o: Orcamento): OrcamentoForm {
  return {
    paciente_id: o.paciente_id,
    data_emissao: o.data_emissao,
    validade: o.validade,
    desconto_tipo: o.desconto_tipo,
    desconto: o.desconto ? formatMoneyInput(o.desconto) : '',
    condicoes_pagamento: o.condicoes_pagamento ?? '',
    prazo_entrega: o.prazo_entrega ?? '',
    observacoes: o.observacoes ?? '',
    itens: o.orcamento_itens.map((i) => ({
      produto_id: i.produto_id ?? '',
      tipo: i.tipo,
      secao: i.secao ?? '',
      descricao: i.descricao,
      detalhe: i.detalhe ?? '',
      quantidade: String(i.quantidade).replace('.', ','),
      unidade: i.unidade,
      preco_unitario: formatMoneyInput(i.preco_unitario),
      preco_tabela: i.produtos ? i.produtos.preco : null,
      salvar_na_tabela: false,
    })),
  }
}

export function useSalvarOrcamento(id?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: OrcamentoForm) => {
      const { dados, itens } = toPayload(values)
      const { data, error } = await db().rpc('salvar_orcamento', { p_id: (id ?? null) as string, p_dados: dados, p_itens: itens })
      if (error) throw error
      return data
    },
    onSuccess: () => invalidar(qc, ['produtos']),
  })
}

export function useMudarStatusOrcamento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Extract<StatusOrcamento, 'enviado' | 'recusado'> }) => {
      const { error } = await db().rpc('mudar_status_orcamento', { p_id: id, p_status: status })
      if (error) throw error
    },
    onSuccess: () => invalidar(qc),
  })
}

export function useAprovarOrcamento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await db().rpc('aprovar_orcamento', { p_id: id, p_hoje: todayIso() })
      if (error) throw error
      return data // id do atendimento
    },
    onSuccess: () => invalidar(qc, ['atendimentos']),
  })
}

export function useNovaVersao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await db().rpc('nova_versao_orcamento', { p_id: id, p_hoje: todayIso() })
      if (error) throw error
      return data // id da nova versão
    },
    onSuccess: () => invalidar(qc),
  })
}

export function useExcluirOrcamento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db().from('orcamentos').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => invalidar(qc),
  })
}
