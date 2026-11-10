import { useQuery } from '@tanstack/react-query'
import { db } from '@/lib/supabase'
import { todayIso } from '@/lib/br'
import type { StatusOrcamento } from '@/features/orcamentos/constants'
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

export type PainelOrcamento = {
  id: string
  numero: string
  status: StatusOrcamento
  total: number
  validade: string
  updated_at: string
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
  orcamentos_abertos: number
  orcamentos_valor_aberto: number
  orcamentos_vencidos: number
  orcamentos: PainelOrcamento[]
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
        // "?? 0" / "?? []": tolera um banco ainda sem os campos de orçamento
        orcamentos_abertos: p.orcamentos_abertos ?? 0,
        orcamentos_vencidos: p.orcamentos_vencidos ?? 0,
        orcamentos_valor_aberto: Number(p.orcamentos_valor_aberto ?? 0),
        orcamentos: (p.orcamentos ?? []).map((o) => ({ ...o, total: Number(o.total) })),
      } satisfies Painel
    },
  })
}
