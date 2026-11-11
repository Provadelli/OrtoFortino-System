import type { Tone } from '@/components/ui/StatusChip'
import type { GrupoFiltro } from '@/components/ui/Filtros'
import type { Database } from '@/lib/database.types'

type Enums = Database['public']['Enums']
export type StatusOrcamento = Enums['status_orcamento']
export type TipoDesconto = Enums['tipo_desconto']

export const STATUS_ORCAMENTO: Record<StatusOrcamento, { label: string; tone: Tone }> = {
  rascunho: { label: 'Rascunho', tone: 'draft' },
  enviado: { label: 'Enviado', tone: 'info' },
  aprovado: { label: 'Aprovado', tone: 'prod' },
  recusado: { label: 'Recusado', tone: 'late' },
  substituido: { label: 'Substituído', tone: 'draft' },
}

/** Filtros que podem ser adicionados à lista (sem nenhum, aparecem todos os orçamentos). */
export const GRUPOS_FILTRO_ORCAMENTO: GrupoFiltro[] = [
  {
    id: 'situacao',
    titulo: 'Situação',
    opcoes: (['rascunho', 'enviado', 'aprovado', 'recusado'] as const).map((v) => ({ valor: v, rotulo: STATUS_ORCAMENTO[v].label, tom: STATUS_ORCAMENTO[v].tone })),
  },
  { id: 'validade', titulo: 'Validade', opcoes: [{ valor: 'vencidos', rotulo: 'Vencidos', tom: 'today' }] },
]
/** Links antigos (?filtro=abertos) → filtros novos. */
export const LEGADO_FILTRO_ORCAMENTO: Record<string, string[]> = {
  abertos: ['rascunho', 'enviado'],
  aprovados: ['aprovado'],
  recusados: ['recusado'],
  todos: [],
}

/** Rascunho e enviado podem ser editados; aprovado/recusado só por nova versão. */
export const editavel = (s: StatusOrcamento) => s === 'rascunho' || s === 'enviado'

/** Em aberto e com a validade no passado. */
export const vencido = (s: StatusOrcamento, validade: string, hoje: string) => editavel(s) && validade < hoje

export const VALIDADE_PADRAO_DIAS = 15

export { somarDias } from '@/lib/br'
