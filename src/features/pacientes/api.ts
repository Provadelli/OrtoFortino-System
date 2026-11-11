import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { db } from '@/lib/supabase'
import { formatCep, formatCpf, formatPhone } from '@/lib/br'
import { toPayload, type PacienteForm } from './schema'

export const PAGE_SIZE = 25

const keys = {
  all: ['pacientes'] as const,
  list: (q: string, page: number) => ['pacientes', 'lista', q, page] as const,
  one: (id: string) => ['pacientes', 'um', id] as const,
}

export function usePacientes(q: string, page: number) {
  return useQuery({
    queryKey: keys.list(q, page),
    queryFn: async () => {
      const { data, error } = await db().rpc('buscar_pacientes', { q, lim: PAGE_SIZE, pular: page * PAGE_SIZE })
      if (error) throw error
      return { rows: data ?? [], total: data?.[0]?.total ?? 0 }
    },
    placeholderData: keepPreviousData,
  })
}

export function usePaciente(id: string | undefined) {
  return useQuery({
    queryKey: keys.one(id ?? ''),
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await db()
        .from('pacientes')
        .select('*, responsaveis(id, nome, cpf, telefone, parentesco, principal, created_at)')
        .eq('id', id!)
        .order('principal', { referencedTable: 'responsaveis', ascending: false })
        .order('created_at', { referencedTable: 'responsaveis', ascending: true })
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export type Paciente = NonNullable<ReturnType<typeof usePaciente>['data']>

/** Registro do banco → valores do formulário (com máscaras aplicadas). */
export function toForm(p: Paciente): PacienteForm {
  return {
    nome: p.nome,
    cpf: p.cpf ? formatCpf(p.cpf) : '',
    data_nascimento: p.data_nascimento ?? '',
    telefone: p.telefone ? formatPhone(p.telefone) : '',
    cep: p.cep ? formatCep(p.cep) : '',
    endereco: p.endereco ?? '',
    cidade: p.cidade ?? '',
    uf: p.uf ?? '',
    origem: p.origem,
    origem_nome: p.origem_nome ?? '',
    medico: p.medico ?? '',
    diagnostico: p.diagnostico ?? '',
    observacoes: p.observacoes ?? '',
    consentimento: true,
    responsaveis: p.responsaveis.map((r) => ({
      id: r.id,
      nome: r.nome,
      cpf: r.cpf ? formatCpf(r.cpf) : '',
      telefone: r.telefone ? formatPhone(r.telefone) : '',
      parentesco: r.parentesco ?? '',
      principal: r.principal,
    })),
  }
}

export function useSalvarPaciente(id?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: PacienteForm) => {
      const { dados, responsaveis } = toPayload(values)
      const { data, error } = await db().rpc('salvar_paciente', {
        p_id: (id ?? null) as string,
        p_dados: dados,
        p_responsaveis: responsaveis,
      })
      if (error) throw error
      return data
    },
    onSuccess: (savedId) => {
      void qc.invalidateQueries({ queryKey: keys.all })
      if (savedId) void qc.invalidateQueries({ queryKey: keys.one(savedId) })
    },
  })
}

export function useExcluirPaciente() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db().from('pacientes').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  })
}

/** Clínicas/operadoras e médicos já usados em outros cadastros (para sugerir no formulário). */
export function useSugestoesPaciente() {
  return useQuery({
    queryKey: ['pacientes', 'sugestoes'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await db().rpc('sugestoes_paciente')
      if (error) throw error
      const r = (data ?? {}) as { origens?: unknown; medicos?: unknown }
      const lista = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])
      return { origens: lista(r.origens), medicos: lista(r.medicos) }
    },
  })
}
