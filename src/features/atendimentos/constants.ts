import type { Tone } from '@/components/ui/StatusChip'
import type { GrupoFiltro } from '@/components/ui/Filtros'
import type { Database } from '@/lib/database.types'

type Enums = Database['public']['Enums']
export type Categoria = Enums['categoria_atendimento']
export type StatusAtendimento = Enums['status_atendimento']
export type StatusPagamento = Enums['status_pagamento']
export type FormaPagamento = Enums['forma_pagamento']
export type TipoFicha = Enums['tipo_ficha']
export type Lateralidade = Enums['lateralidade']

export const CATEGORIAS: { value: Categoria; label: string }[] = [
  { value: 'confeccao', label: 'Confecção' },
  { value: 'ajuste', label: 'Ajuste' },
  { value: 'reparo', label: 'Reparo' },
  { value: 'manutencao', label: 'Manutenção' },
]

export const STATUS: { value: StatusAtendimento; label: string; tone: Tone }[] = [
  { value: 'em_contato', label: 'Em contato', tone: 'draft' },
  { value: 'em_producao', label: 'Em produção', tone: 'info' },
  { value: 'pronto', label: 'Pronto', tone: 'ready' },
  { value: 'entregue', label: 'Entregue', tone: 'prod' },
  { value: 'cancelado', label: 'Cancelado', tone: 'late' },
]

/** Fluxo normal: cada status avança para o próximo. */
export const PROXIMO: Partial<Record<StatusAtendimento, { status: StatusAtendimento; acao: string }>> = {
  em_contato: { status: 'em_producao', acao: 'Iniciar produção' },
  em_producao: { status: 'pronto', acao: 'Marcar como pronto' },
  pronto: { status: 'entregue', acao: 'Registrar entrega' },
}

export const ATIVOS: StatusAtendimento[] = ['em_contato', 'em_producao', 'pronto']

export const PAGAMENTO: Record<StatusPagamento, { label: string; tone: Tone }> = {
  pendente: { label: 'Pendente', tone: 'late' },
  parcial: { label: 'Parcial', tone: 'today' },
  pago: { label: 'Pago', tone: 'prod' },
  isento: { label: 'Sem custo', tone: 'draft' },
}

/** Formas oferecidas no formulário, em grupos (o antigo "cartao" só aparece em registros já salvos). */
export const FORMAS: { value: FormaPagamento; label: string; grupo: 'vista' | 'cartao' | 'outros' }[] = [
  { value: 'pix', label: 'Pix', grupo: 'vista' },
  { value: 'dinheiro', label: 'Dinheiro', grupo: 'vista' },
  { value: 'credito', label: 'Cartão de crédito', grupo: 'cartao' },
  { value: 'debito', label: 'Cartão de débito', grupo: 'cartao' },
  { value: 'boleto', label: 'Boleto', grupo: 'outros' },
  { value: 'convenio', label: 'Convênio', grupo: 'outros' },
]
/** Todas as formas, inclusive a antiga, para exibir registros existentes. */
export const FORMAS_TODAS: { value: FormaPagamento; label: string }[] = [...FORMAS, { value: 'cartao', label: 'Cartão' }]
/** Formas que podem ser parceladas. */
export const PARCELAVEIS: FormaPagamento[] = ['credito', 'boleto']
export const MAX_PARCELAS = 12

/** "Cartão de crédito · 3x de R$ 416,67" — texto curto da forma de pagamento. */
export function descreverPagamento(forma: FormaPagamento | null | undefined, parcelas: number | null | undefined, valor: number) {
  if (!forma) return null
  const nome = label(FORMAS_TODAS, forma)
  if (!PARCELAVEIS.includes(forma) || !parcelas) return nome
  if (parcelas === 1) return `${nome} · à vista`
  const cada = valor > 0 ? ` de ${(valor / parcelas).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}` : ''
  return `${nome} · ${parcelas}x${cada}`
}

export const TIPOS: { value: TipoFicha; label: string }[] = [
  { value: 'ortese', label: 'Órtese' },
  { value: 'palmilha', label: 'Palmilha' },
  { value: 'protese', label: 'Prótese' },
]

export const LATERALIDADES: { value: Lateralidade; label: string }[] = [
  { value: 'bilateral', label: 'Bilateral' },
  { value: 'unilateral_d', label: 'Unilateral D' },
  { value: 'unilateral_e', label: 'Unilateral E' },
]

/** Produtos da ficha em papel (o campo aceita texto livre também). */
export const PRODUTOS = [
  'AFO fixa',
  'AFO articulada',
  'KAFO',
  'H-KAFO',
  'SMO forrada',
  'SMO c/ flexível',
  'Colete OTLS',
  'Extensores',
  'Palmilha sob medida',
]

export const ESPECIFICACOES = [
  '90°',
  'Tira valgo',
  'Tira varo',
  'Tira de travamento',
  'Tira de tração',
  'Pés pronados',
  'Pés supinados',
  'Orifícios de ventilação',
  'Elevar arco plantar',
  'Acomodar equino',
]

/** Filtros que podem ser adicionados à lista (sem nenhum, aparecem todos os atendimentos). */
export const GRUPOS_FILTRO_ATENDIMENTO: GrupoFiltro[] = [
  { id: 'etapa', titulo: 'Etapa', opcoes: STATUS.map((x) => ({ valor: x.value, rotulo: x.label, tom: x.tone })) },
  {
    id: 'prazo',
    titulo: 'Prazo de entrega',
    opcoes: [
      { valor: 'atrasados', rotulo: 'Atrasados', tom: 'late' },
      { valor: 'hoje', rotulo: 'Entrega hoje', tom: 'today' },
    ],
  },
  {
    id: 'pagamento',
    titulo: 'Pagamento',
    opcoes: (['pendente', 'parcial', 'pago', 'isento'] as const).map((v) => ({ valor: `pg_${v}`, rotulo: PAGAMENTO[v].label, tom: PAGAMENTO[v].tone })),
  },
]
/** Links antigos (?filtro=atrasados, ?pagamento=pendente) → filtros novos. */
export const LEGADO_FILTRO_ATENDIMENTO: Record<string, string[]> = {
  andamento: [...ATIVOS],
  atrasados: ['atrasados'],
  pagamento: ['pg_pendente', 'pg_parcial'],
  finalizados: ['entregue', 'cancelado'],
  todos: [],
}

export const label = <T extends string>(list: { value: T; label: string }[], v: T | null | undefined) =>
  list.find((x) => x.value === v)?.label ?? '—'
export const statusInfo = (s: StatusAtendimento) => STATUS.find((x) => x.value === s)!

/** Prazo: "Atrasado" / "Hoje" / null — só para atendimentos ativos. */
export function prazoAlerta(status: StatusAtendimento, prazo: string | null, hoje: string): { label: string; tone: Tone } | null {
  if (!prazo || !ATIVOS.includes(status)) return null
  if (prazo < hoje) return { label: 'Atrasado', tone: 'late' }
  if (prazo === hoje) return { label: 'Entrega hoje', tone: 'today' }
  return null
}

/** "AFO articulada" + bilateral → "AFO articulada bilateral" (sugestão para a descrição curta). */
export function descricaoSugerida(produto: string, lateralidade: string | null | undefined) {
  const p = produto.trim()
  if (!p) return ''
  const lado = LATERALIDADES.find((l) => l.value === lateralidade)?.label
  return lado ? `${p} ${lado.charAt(0).toLowerCase()}${lado.slice(1)}` : p
}
