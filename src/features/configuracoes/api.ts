import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { EMPRESA_PADRAO, type Empresa } from '@/lib/empresa'
import { db } from '@/lib/supabase'
import type { Configuracoes, ConfiguracoesUpdate } from './schema'

/**
 * Linha única de configurações. Muda raramente: fica 5 min em cache e é
 * compartilhada pelo PDF, pelo orçamento novo e pela ficha técnica.
 */
export const configuracoesQuery = queryOptions({
  queryKey: ['configuracoes'] as const,
  staleTime: 5 * 60_000,
  queryFn: async () => {
    const { data, error } = await db().from('configuracoes').select('*').eq('id', true).maybeSingle()
    if (error) throw error
    return data
  },
})

export const useConfiguracoes = () => useQuery(configuracoesQuery)

export function useSalvarConfiguracoes() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (patch: ConfiguracoesUpdate) => {
      const { data, error } = await db().from('configuracoes').update(patch).eq('id', true).select('*').single()
      if (error) throw error
      return data
    },
    onSuccess: (data) => qc.setQueryData(configuracoesQuery.queryKey, data),
  })
}

/** Dados da empresa para documentos; sem configuração carregada, usa os valores de reserva. */
export function empresaDe(c: Configuracoes | null | undefined): Empresa {
  if (!c) return EMPRESA_PADRAO
  return {
    nome: c.empresa_nome,
    slogan: c.empresa_slogan,
    cnpj: c.empresa_cnpj,
    endereco: c.empresa_endereco,
    cidade: c.empresa_cidade,
    cep: c.empresa_cep,
    telefone: c.empresa_telefone,
    email: c.empresa_email,
  }
}
