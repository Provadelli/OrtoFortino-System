import { useEffect } from 'react'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { somarDias, todayIso } from '@/lib/br'
import { db } from '@/lib/supabase'

export type Aba = '7d' | '30d' | '12m'
export const ABAS: { id: Aba; rotulo: string; atual: string; anterior: string }[] = [
  { id: '7d', rotulo: '7 dias', atual: 'Últimos 7 dias', anterior: '7 dias antes' },
  { id: '30d', rotulo: '30 dias', atual: 'Últimos 30 dias', anterior: '30 dias antes' },
  { id: '12m', rotulo: '12 meses', atual: 'Últimos 12 meses', anterior: '12 meses antes' },
]

export type Coluna = { chave: string; rotulo: string; valor: number; periodo: 'anterior' | 'atual' }
export type Serie = { colunas: Coluna[]; totalAtual: number; totalAnterior: number; variacao: number | null }

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/** Primeiro dia do mês `n` meses antes de `iso`. */
function mesAntes(iso: string, n: number) {
  const [y, m] = iso.split('-').map(Number)
  const d = new Date(Date.UTC(y!, m! - 1 - n, 1))
  return d.toISOString().slice(0, 10)
}

/** Período consultado: o atual e o anterior, do mesmo tamanho. */
export function intervalo(aba: Aba, hoje: string) {
  if (aba === '12m') return { de: mesAntes(hoje, 23), ate: hoje }
  const n = aba === '7d' ? 7 : 30
  return { de: somarDias(hoje, -(2 * n - 1)), ate: hoje }
}

/** Monta as colunas (anterior + atual) a partir das somas por dia vindas do banco. */
export function montarSerie(linhas: { dia: string; total: number }[], aba: Aba, hoje: string): Serie {
  const mapa = new Map<string, number>()
  const mensal = aba === '12m'
  for (const l of linhas) {
    const k = mensal ? l.dia.slice(0, 7) : l.dia.slice(0, 10)
    mapa.set(k, (mapa.get(k) ?? 0) + Number(l.total))
  }
  const n = aba === '7d' ? 7 : aba === '30d' ? 30 : 12
  const colunas: Coluna[] = []
  for (let i = 2 * n - 1; i >= 0; i--) {
    const chave = mensal ? mesAntes(hoje, i).slice(0, 7) : somarDias(hoje, -i)
    const rotulo = mensal ? `${MESES[Number(chave.slice(5, 7)) - 1]}/${chave.slice(2, 4)}` : `${chave.slice(8, 10)}/${chave.slice(5, 7)}`
    colunas.push({ chave, rotulo, valor: mapa.get(chave) ?? 0, periodo: i >= n ? 'anterior' : 'atual' })
  }
  const soma = (p: Coluna['periodo']) => colunas.filter((c) => c.periodo === p).reduce((s, c) => s + c.valor, 0)
  const totalAtual = soma('atual')
  const totalAnterior = soma('anterior')
  const variacao = totalAnterior > 0 ? Math.round(((totalAtual - totalAnterior) / totalAnterior) * 100) : null
  return { colunas, totalAtual, totalAnterior, variacao }
}

/** Quantos pontos cada coluna leva (até `max`), proporcional ao maior valor. */
export function pontosDaColuna(valor: number, maior: number, max = 12) {
  if (valor <= 0 || maior <= 0) return 0
  return Math.max(1, Math.round((valor / maior) * max))
}

const consulta = (aba: Aba, hoje: string) => ({
  queryKey: ['atendimentos', 'painel', 'recebimentos', aba, hoje],
  queryFn: async () => {
    const { de, ate } = intervalo(aba, hoje)
    const { data, error } = await db().rpc('painel_recebimentos', { p_de: de, p_ate: ate })
    if (error) throw error
    return { ...montarSerie(data ?? [], aba, hoje), aba }
  },
})

/**
 * Série do período escolhido. Ao trocar de período, a anterior continua na tela até a nova
 * chegar (sem piscar o esqueleto), e os outros períodos são buscados de antemão.
 */
export function useRecebimentos(aba: Aba, hoje = todayIso()) {
  const qc = useQueryClient()
  const q = useQuery({ ...consulta(aba, hoje), placeholderData: keepPreviousData })
  const pronto = q.isSuccess && !q.isPlaceholderData
  useEffect(() => {
    if (!pronto) return
    for (const a of ABAS) if (a.id !== aba) void qc.prefetchQuery(consulta(a.id, hoje))
  }, [pronto, aba, hoje, qc])
  return q
}
