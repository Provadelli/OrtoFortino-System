/**
 * Cálculo do orçamento na tela — mesmas regras de orcamento_recalcular() no banco:
 * total do item = round(qtd × preço, 2); desconto % = round(subtotal × % / 100, 2);
 * desconto nunca passa do subtotal. O banco recalcula ao salvar (fonte da verdade).
 */
import type { TipoDesconto } from './constants'

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

export const SEM_SECAO = 'Outros itens'

export type ItemCalculavel = { secao: string; quantidade: number; preco_unitario: number }

export type Secao = { nome: string; indices: number[]; subtotal: number }

/** Seções na ordem em que aparecem; cada item guarda o índice original (para o formulário). */
export function agruparSecoes(itens: { secao: string }[]) {
  const mapa = new Map<string, number[]>()
  itens.forEach((it, i) => {
    const nome = it.secao.trim() || SEM_SECAO
    mapa.set(nome, [...(mapa.get(nome) ?? []), i])
  })
  return [...mapa.entries()].map(([nome, indices]) => ({ nome, indices }))
}

export const totalItem = (quantidade: number, preco: number) =>
  Number.isFinite(quantidade) && Number.isFinite(preco) ? round2(quantidade * preco) : 0

export function calcular(itens: ItemCalculavel[], descontoTipo: TipoDesconto, desconto: number) {
  const totais = itens.map((i) => totalItem(i.quantidade, i.preco_unitario))
  const secoes: Secao[] = agruparSecoes(itens).map((s) => ({ ...s, subtotal: round2(s.indices.reduce((acc, i) => acc + totais[i]!, 0)) }))
  const subtotal = round2(totais.reduce((a, b) => a + b, 0))
  const d = Number.isFinite(desconto) && desconto > 0 ? desconto : 0
  const descontoValor = Math.min(subtotal, descontoTipo === 'percentual' ? round2((subtotal * Math.min(d, 100)) / 100) : round2(d))
  return { totais, secoes, subtotal, descontoValor, total: round2(subtotal - descontoValor) }
}
