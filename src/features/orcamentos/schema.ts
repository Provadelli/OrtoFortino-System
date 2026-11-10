import * as z from 'zod/mini'
import { parseBRL, todayIso } from '@/lib/br'
import { agruparSecoes } from './calc'
import { somarDias, VALIDADE_PADRAO_DIAS } from './constants'

const texto = (max: number) => z.string().check(z.trim(), z.maxLength(max, `Use no máximo ${max} caracteres.`))

const dinheiro = (msg: string) =>
  z.string().check(
    z.refine((v) => {
      const n = parseBRL(v)
      return v.trim() !== '' && Number.isFinite(n) && n >= 0 && n <= 1_000_000
    }, msg),
  )

/** "2" | "1,5" | "0,5" → número (quantidade aceita vírgula decimal). */
export function parseQtd(v: string) {
  const s = v.trim().replace(',', '.')
  return /^\d+(\.\d{1,2})?$/.test(s) ? Number(s) : Number.NaN
}

export const itemSchema = z.object({
  produto_id: z.string(),
  tipo: z.enum(['base', 'adicional']),
  secao: texto(80),
  descricao: z.string().check(z.trim(), z.minLength(1, 'Descreva o item.'), z.maxLength(160, 'Use no máximo 160 caracteres.')),
  detalhe: texto(1000),
  quantidade: z.string().check(
    z.refine((v) => {
      const n = parseQtd(v)
      return n > 0 && n <= 10_000
    }, 'Quantidade inválida.'),
  ),
  unidade: z.string().check(z.trim(), z.minLength(1, 'Informe a unidade.'), z.maxLength(20)),
  preco_unitario: dinheiro('Preço inválido. Use o formato 1.250,00.'),
  /** Preço da tabela no momento em que o item entrou (null = item avulso). */
  preco_tabela: z.nullable(z.number()),
  salvar_na_tabela: z.boolean(),
})

export const orcamentoSchema = z
  .object({
    paciente_id: z.string().check(z.minLength(1, 'Escolha o paciente.')),
    data_emissao: z.string().check(z.minLength(10, 'Informe a data de emissão.')),
    validade: z.string().check(z.minLength(10, 'Informe a validade.')),
    desconto_tipo: z.enum(['valor', 'percentual']),
    desconto: z.string(),
    condicoes_pagamento: texto(400),
    prazo_entrega: texto(120),
    observacoes: texto(4000),
    itens: z.array(itemSchema).check(z.minLength(1, 'Inclua pelo menos um item.')),
  })
  .check(
    z.refine((v) => v.validade >= v.data_emissao, { path: ['validade'], message: 'A validade não pode ser antes da emissão.' }),
    z.refine(
      (v) => {
        if (v.desconto.trim() === '') return true
        const n = parseBRL(v.desconto)
        return Number.isFinite(n) && n >= 0 && (v.desconto_tipo === 'valor' || n <= 100)
      },
      { path: ['desconto'], message: 'Desconto inválido.' },
    ),
  )

export type OrcamentoForm = z.infer<typeof orcamentoSchema>
export type ItemForm = z.infer<typeof itemSchema>

export function orcamentoVazio(pacienteId = '', hoje = todayIso()): OrcamentoForm {
  return {
    paciente_id: pacienteId,
    data_emissao: hoje,
    validade: somarDias(hoje, VALIDADE_PADRAO_DIAS),
    desconto_tipo: 'valor',
    desconto: '',
    condicoes_pagamento: '',
    prazo_entrega: '',
    observacoes: '',
    itens: [],
  }
}

/** Formulário → argumentos de salvar_orcamento (itens já agrupados por seção). */
export function toPayload(v: OrcamentoForm) {
  const ordenados = agruparSecoes(v.itens).flatMap((s) => s.indices.map((i) => v.itens[i]!))
  return {
    dados: {
      paciente_id: v.paciente_id,
      data_emissao: v.data_emissao,
      validade: v.validade,
      desconto_tipo: v.desconto_tipo,
      desconto: v.desconto.trim() === '' ? 0 : parseBRL(v.desconto),
      condicoes_pagamento: v.condicoes_pagamento,
      prazo_entrega: v.prazo_entrega,
      observacoes: v.observacoes,
    },
    itens: ordenados.map((i) => ({
      produto_id: i.produto_id || null,
      tipo: i.tipo,
      secao: i.secao,
      descricao: i.descricao.trim(),
      detalhe: i.detalhe,
      quantidade: parseQtd(i.quantidade),
      unidade: i.unidade.trim(),
      preco_unitario: parseBRL(i.preco_unitario),
      salvar_na_tabela: !!i.produto_id && i.salvar_na_tabela && i.preco_tabela !== parseBRL(i.preco_unitario),
    })),
  }
}
