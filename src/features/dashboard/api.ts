import { useQuery } from '@tanstack/react-query'
import { db } from '@/lib/supabase'
import { todayIso } from '@/lib/br'
import type { Categoria, FormaPagamento, StatusAtendimento, StatusPagamento } from '@/features/atendimentos/constants'

export type PainelPrazo = {
  id: string
  numero: number
  status: StatusAtendimento
  prazo_entrega: string
  categoria: Categoria
  servico: string | null
  paciente: string
}

export type PainelReceber = {
  id: string
  numero: number
  pagamento_status: StatusPagamento
  pagamento_forma: FormaPagamento | null
  pagamento_detalhe: string | null
  restante: number
  paciente: string
}

export type Painel = {
  em_contato: number
  em_producao: number
  prontos: number
  entregues_mes: number
  entregas_semana: number
  atrasados: number
  a_receber: number
  pagamentos_abertos: number
  prazos: PainelPrazo[]
  receber: PainelReceber[]
}

/** Resumo do painel numa única chamada (função painel_resumo no banco). */
export function usePainel(hoje = todayIso()) {
  return useQuery({
    queryKey: ['atendimentos', 'painel', hoje], // prefixo 'atendimentos': salvar/mudar status já invalida o painel
    queryFn: async () => {
      const { data, error } = await db().rpc('painel_resumo', { p_hoje: hoje })
      if (error) throw error
      const p = data as unknown as Painel
      // numeric do Postgres pode chegar como string
      return {
        ...p,
        a_receber: Number(p.a_receber),
        receber: p.receber.map((r) => ({ ...r, restante: Number(r.restante) })),
      } satisfies Painel
    },
  })
}
