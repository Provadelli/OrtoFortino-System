import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { db } from '@/lib/supabase'
import { formatMoneyInput, normalizeSearch, todayIso } from '@/lib/br'
import { ATIVOS, STATUS, type StatusAtendimento, type StatusPagamento } from './constants'
import { fichaVazia, toPayload, type AtendimentoForm } from './schema'

export const PAGE_SIZE = 25

const keys = {
  all: ['atendimentos'] as const,
  list: (f: string[], q: string, page: number) => ['atendimentos', 'lista', [...f].sort().join(','), q, page] as const,
  one: (id: string) => ['atendimentos', 'um', id] as const,
  doPaciente: (id: string) => ['atendimentos', 'paciente', id] as const,
}

const LISTA_COLS =
  'id, numero, categoria, descricao, status, prazo_entrega, data_primeiro_contato, data_conclusao, valor, valor_pago, pagamento_status, fichas_tecnicas(tipo, produto)'

/**
 * Lista com filtros combináveis. Dentro de um grupo as opções somam (OU); entre grupos, restringem (E).
 * Sem filtros = todos os atendimentos.
 */
export function useAtendimentos(filtros: string[], q: string, page: number) {
  return useQuery({
    queryKey: keys.list(filtros, q, page),
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const busca = normalizeSearch(q)
      let query = db()
        .from('atendimentos')
        .select(`${LISTA_COLS}, pacientes!inner(id, nome, nome_busca)`, { count: 'exact' })
      if (busca) query = query.like('pacientes.nome_busca', `%${busca.replace(/[%_\\]/g, '')}%`)
      const hoje = todayIso()
      let etapas = filtros.filter((f): f is StatusAtendimento => STATUS.some((x) => x.value === f))
      const pagamentos = filtros.filter((f) => f.startsWith('pg_')).map((f) => f.slice(3) as StatusPagamento)
      const atrasados = filtros.includes('atrasados')
      const deHoje = filtros.includes('hoje')
      if (atrasados || deHoje) {
        // Prazo só faz sentido para quem ainda não foi entregue.
        etapas = (etapas.length ? etapas : ATIVOS).filter((e) => ATIVOS.includes(e))
        if (atrasados && deHoje) query = query.lte('prazo_entrega', hoje)
        else if (atrasados) query = query.lt('prazo_entrega', hoje)
        else query = query.eq('prazo_entrega', hoje)
        if (!etapas.length) etapas = ['__nenhum__' as StatusAtendimento]
      }
      if (etapas.length) query = query.in('status', etapas)
      if (pagamentos.length) {
        query = query.in('pagamento_status', pagamentos)
        // "A receber" não inclui cancelados, a menos que a etapa seja escolhida.
        if (!etapas.length && pagamentos.every((x) => x === 'pendente' || x === 'parcial')) query = query.neq('status', 'cancelado')
      }
      // Lista de trabalho (só etapas ativas ou prazo) ordena pelo prazo; o resto, pelos mais recentes.
      const porPrazo = etapas.length > 0 && etapas.every((e) => ATIVOS.includes(e))
      const ordered = porPrazo
        ? query.order('prazo_entrega', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false })
        : query.order('created_at', { ascending: false })
      const { data, error, count } = await ordered.range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)
      if (error) throw error
      return { rows: data ?? [], total: count ?? 0 }
    },
  })
}

export function useAtendimentosDoPaciente(pacienteId: string | undefined) {
  return useQuery({
    queryKey: keys.doPaciente(pacienteId ?? ''),
    enabled: !!pacienteId,
    queryFn: async () => {
      const { data, error } = await db()
        .from('atendimentos')
        .select(LISTA_COLS)
        .eq('paciente_id', pacienteId!)
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return data ?? []
    },
  })
}

export function useAtendimento(id: string | undefined) {
  return useQuery({
    queryKey: keys.one(id ?? ''),
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await db()
        .from('atendimentos')
        .select('*, fichas_tecnicas(*), pacientes(id, nome, data_nascimento, telefone)')
        .eq('id', id!)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export type Atendimento = NonNullable<ReturnType<typeof useAtendimento>['data']>

/** fichas_tecnicas vem como objeto (relação 1:1 por unique) — mas o PostgREST pode devolver array. */
export function fichaDe(a: { fichas_tecnicas: unknown }) {
  const f = a.fichas_tecnicas as Atendimento['fichas_tecnicas'] | Atendimento['fichas_tecnicas'][] | null
  return (Array.isArray(f) ? f[0] : f) ?? null
}

export function toForm(a: Atendimento): AtendimentoForm {
  const f = fichaDe(a)
  const s = (v: string | null | undefined) => v ?? ''
  return {
    paciente_id: a.paciente_id,
    categoria: a.categoria,
    descricao: s(a.descricao),
    status: a.status,
    data_primeiro_contato: a.data_primeiro_contato,
    data_fechamento: s(a.data_fechamento),
    prazo_entrega: s(a.prazo_entrega),
    data_conclusao: s(a.data_conclusao),
    valor: a.valor ? formatMoneyInput(a.valor) : '',
    valor_pago: a.valor_pago ? formatMoneyInput(a.valor_pago) : '',
    pagamento_forma: s(a.pagamento_forma),
    pagamento_parcelas: a.pagamento_parcelas ? String(a.pagamento_parcelas) : '',
    pagamento_detalhe: s(a.pagamento_detalhe),
    data_pagamento: s(a.data_pagamento),
    observacoes: s(a.observacoes),
    com_ficha: !!f,
    ficha: f
      ? {
          tipo: f.tipo,
          lateralidade: s(f.lateralidade),
          produto: s(f.produto),
          especificacoes: f.especificacoes ?? [],
          compensacao_lado: s(f.compensacao_lado),
          compensacao_medida: s(f.compensacao_medida),
          tamanho_calcado: s(f.tamanho_calcado),
          medidas_ml: s(f.medidas_ml),
          nome_na_ortese: f.nome_na_ortese,
          tema: s(f.tema),
          cor_forro: s(f.cor_forro),
          cor_tira: s(f.cor_tira),
          protese_membro: s(f.protese_membro),
          protese_nivel: s(f.protese_nivel),
          protese_lado: s(f.protese_lado),
          liner: s(f.liner),
          tamanho_pe: s(f.tamanho_pe),
          observacoes: s(f.observacoes),
        }
      : fichaVazia,
  }
}

export function useSalvarAtendimento(id?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: AtendimentoForm) => {
      const { dados, ficha } = toPayload(values)
      const { data, error } = await db().rpc('salvar_atendimento', {
        p_id: (id ?? null) as string,
        p_dados: dados,
        p_ficha: ficha as never,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  })
}

export function useMudarStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: StatusAtendimento }) => {
      const { error } = await db().from('atendimentos').update({ status }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  })
}

export function useExcluirAtendimento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db().from('atendimentos').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  })
}
