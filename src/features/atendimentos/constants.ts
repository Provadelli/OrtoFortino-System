import type { Tone } from '@/components/ui/StatusChip'
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
  { value: 'em_producao', label: 'Em produção', tone: 'prod' },
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

export const FORMAS: { value: FormaPagamento; label: string }[] = [
  { value: 'pix', label: 'Pix' },
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'cartao', label: 'Cartão' },
  { value: 'boleto', label: 'Boleto' },
  { value: 'convenio', label: 'Convênio' },
]

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

export const FILTROS = [
  { value: 'andamento', label: 'Em andamento' },
  { value: 'atrasados', label: 'Atrasados' },
  { value: 'pagamento', label: 'A receber' },
  { value: 'finalizados', label: 'Finalizados' },
  { value: 'todos', label: 'Todos' },
] as const
export type Filtro = (typeof FILTROS)[number]['value']

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
