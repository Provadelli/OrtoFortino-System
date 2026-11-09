import type { Tone } from '@/components/ui/StatusChip'

/**
 * Dados de exemplo da etapa 0 (iguais ao canvas).
 * Na etapa 3 serão substituídos por consultas reais ao Supabase.
 */
export type Kpi = { label: string; value: string; sub: string; dot: string; alert?: boolean }
export type Prazo = { nome: string; produto: string; data: string; status: string; tone: Tone }
export type Etapa = { label: string; n: number; color: string }
export type Pagamento = { nome: string; forma: string; valor: string; status: string; tone: Tone }
export type Orcamento = { num: string; nome: string; itens: string; valor: string; status: string; tone: Tone; data: string }

export const kpis: Kpi[] = [
  { label: 'Em produção', value: '12', sub: '3 prontos para entrega', dot: 'bg-brand-mint' },
  { label: 'Entregas esta semana', value: '5', sub: '1 atrasada', dot: 'bg-brand-orange', alert: true },
  { label: 'A receber', value: 'R$ 8.450,00', sub: '4 pagamentos pendentes', dot: 'bg-brand-pink' },
  { label: 'Orçamentos em aberto', value: '7', sub: 'R$ 15.200,00 aguardando resposta', dot: 'bg-brand-yellow' },
]

export const prazos: Prazo[] = [
  { nome: 'Polyana S.', produto: 'AFO articulada · bilateral', data: '06/11', status: 'Atrasado', tone: 'late' },
  { nome: 'Mariana L.', produto: 'AFO fixa · bilateral · tira valgo', data: '09/11', status: 'Entrega hoje', tone: 'today' },
  { nome: 'João P.', produto: 'SMO forrada · unilateral D', data: '11/11', status: 'Em produção', tone: 'prod' },
  { nome: 'Helena R.', produto: 'KAFO · unilateral E', data: '13/11', status: 'Em produção', tone: 'prod' },
  { nome: 'Davi M.', produto: 'Palmilha sob medida', data: '14/11', status: 'Pronto', tone: 'ready' },
]

export const etapas: Etapa[] = [
  { label: 'Em contato', n: 4, color: 'bg-brand-yellow' },
  { label: 'Em produção', n: 12, color: 'bg-brand-mint' },
  { label: 'Pronto para entrega', n: 3, color: 'bg-brand-orange' },
  { label: 'Entregues no mês', n: 9, color: 'bg-brand-pink' },
]

export const pagamentos: Pagamento[] = [
  { nome: 'Helena R.', forma: 'Pix · 50% na aprovação', valor: 'R$ 2.450,00', status: 'Parcial', tone: 'today' },
  { nome: 'Gabriel T.', forma: 'Plano de saúde', valor: 'R$ 2.750,00', status: 'Pendente', tone: 'late' },
  { nome: 'João P.', forma: 'Cartão · 3x', valor: 'R$ 1.800,00', status: 'Pendente', tone: 'late' },
]

export const orcamentos: Orcamento[] = [
  { num: 'ORC-2026-0142', nome: 'Mariana L.', itens: 'AFO fixa bilateral + tira valgo', valor: 'R$ 3.200,00', status: 'Aprovado', tone: 'prod', data: '08/11' },
  { num: 'ORC-2026-0141', nome: 'Gabriel T.', itens: 'Colete OTLS', valor: 'R$ 2.750,00', status: 'Enviado', tone: 'today', data: '07/11' },
  { num: 'ORC-2026-0140', nome: 'Helena R.', itens: 'KAFO unilateral E', valor: 'R$ 4.900,00', status: 'Aprovado', tone: 'prod', data: '05/11' },
  { num: 'ORC-2026-0139', nome: 'Lucas F.', itens: 'Reparo de AFO (sem custo)', valor: 'R$ 0,00', status: 'Rascunho', tone: 'draft', data: '04/11' },
]

/** Cor do avatar segue o tom do status, como no canvas. */
export const avatarBg: Record<Tone, string> = {
  late: 'bg-late-bg',
  today: 'bg-today-bg',
  prod: 'bg-prod-bg',
  ready: 'bg-ready-bg',
  draft: 'bg-draft-bg',
}
