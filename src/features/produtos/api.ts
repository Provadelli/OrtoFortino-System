import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatMoneyInput } from '@/lib/br'
import { db } from '@/lib/supabase'
import type { ItemImportado } from './csv'
import { toPayload, type ProdutoForm } from './schema'

const keys = {
  all: ['produtos'] as const,
  lista: ['produtos', 'lista'] as const,
  one: (id: string) => ['produtos', 'um', id] as const,
}

const COLS = 'id, codigo, nome, nome_busca, tipo, categoria, descricao, unidade, preco, ativo, updated_at'

/**
 * A tabela de preços é pequena (dezenas a poucas centenas de itens):
 * carrega tudo de uma vez e filtra/agrupa no navegador — busca instantânea e
 * o mesmo cache serve ao seletor de produtos dos orçamentos (Fase 5).
 */
export function useProdutos() {
  return useQuery({
    queryKey: keys.lista,
    queryFn: async () => {
      const { data, error } = await db().from('produtos').select(COLS).order('categoria', { nullsFirst: false }).order('nome_busca').limit(5000)
      if (error) throw error
      // numeric pode chegar como string
      return (data ?? []).map((p) => ({ ...p, preco: Number(p.preco) }))
    },
  })
}

export type Produto = NonNullable<ReturnType<typeof useProdutos>['data']>[number]

export function useProduto(id: string | undefined) {
  return useQuery({
    queryKey: keys.one(id ?? ''),
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await db()
        .from('produtos')
        .select(`${COLS}, historico_precos(id, preco_anterior, preco_novo, origem, alterado_em)`)
        .eq('id', id!)
        .order('alterado_em', { referencedTable: 'historico_precos', ascending: false })
        .limit(50, { referencedTable: 'historico_precos' })
        .maybeSingle()
      if (error) throw error
      if (!data) return null
      return {
        ...data,
        preco: Number(data.preco),
        historico_precos: (data.historico_precos ?? []).map((h) => ({
          ...h,
          preco_novo: Number(h.preco_novo),
          preco_anterior: h.preco_anterior === null ? null : Number(h.preco_anterior),
        })),
      }
    },
  })
}

export type ProdutoDetalhe = NonNullable<ReturnType<typeof useProduto>['data']>

export function toForm(p: ProdutoDetalhe): ProdutoForm {
  return {
    nome: p.nome,
    codigo: p.codigo ?? '',
    tipo: p.tipo,
    categoria: p.categoria ?? '',
    unidade: p.unidade,
    preco: formatMoneyInput(p.preco),
    descricao: p.descricao ?? '',
  }
}

export function useSalvarProduto(id?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: ProdutoForm) => {
      const payload = toPayload(values)
      const q = id ? db().from('produtos').update(payload).eq('id', id) : db().from('produtos').insert(payload)
      const { data, error } = await q.select('id').single()
      if (error) throw error
      return data.id
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  })
}

export function useAlternarAtivo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await db().from('produtos').update({ ativo }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  })
}

export function useExcluirProduto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db().from('produtos').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  })
}

export type ResultadoImportacao = { criados: number; atualizados: number; inalterados: number }

export function useImportarProdutos() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (itens: ItemImportado[]) => {
      const p_itens = itens.map(({ linha: _linha, ...item }) => item)
      const { data, error } = await db().rpc('importar_produtos', { p_itens })
      if (error) throw error
      return data as ResultadoImportacao
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  })
}
