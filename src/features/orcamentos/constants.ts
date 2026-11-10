import type { Tone } from '@/components/ui/StatusChip'
import type { Database } from '@/lib/database.types'

type Enums = Database['public']['Enums']
export type StatusOrcamento = Enums['status_orcamento']
export type TipoDesconto = Enums['tipo_desconto']

export const STATUS_ORCAMENTO: Record<StatusOrcamento, { label: string; tone: Tone }> = {
  rascunho: { label: 'Rascunho', tone: 'draft' },
  enviado: { label: 'Enviado', tone: 'today' },
  aprovado: { label: 'Aprovado', tone: 'prod' },
  recusado: { label: 'Recusado', tone: 'late' },
  substituido: { label: 'Substituído', tone: 'draft' },
}

export const FILTROS_ORCAMENTO = [
  { value: 'abertos', label: 'Em aberto' },
  { value: 'aprovados', label: 'Aprovados' },
  { value: 'recusados', label: 'Recusados' },
  { value: 'todos', label: 'Todos' },
] as const
export type FiltroOrcamento = (typeof FILTROS_ORCAMENTO)[number]['value']

/** Rascunho e enviado podem ser editados; aprovado/recusado só por nova versão. */
export const editavel = (s: StatusOrcamento) => s === 'rascunho' || s === 'enviado'

/** Em aberto e com a validade no passado. */
export const vencido = (s: StatusOrcamento, validade: string, hoje: string) => editavel(s) && validade < hoje

export const VALIDADE_PADRAO_DIAS = 15

/** "2026-11-10" + 15 dias → "2026-11-25" (sem fuso). */
export function somarDias(iso: string, dias: number) {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y!, m! - 1, d! + dias))
  return dt.toISOString().slice(0, 10)
}
