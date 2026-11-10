import * as z from 'zod/mini'
import type { Tone } from '@/components/ui/StatusChip'
import { parseBRL } from '@/lib/br'
import type { Database } from '@/lib/database.types'

export type TipoProduto = Database['public']['Enums']['tipo_produto']

export const TIPOS_PRODUTO: { value: TipoProduto; label: string; plural: string; tone: Tone }[] = [
  { value: 'base', label: 'Produto-base', plural: 'Produtos-base', tone: 'prod' },
  { value: 'adicional', label: 'Adicional', plural: 'Adicionais', tone: 'today' },
]

export const tipoInfo = (t: TipoProduto) => TIPOS_PRODUTO.find((x) => x.value === t) ?? TIPOS_PRODUTO[0]!

/** Sugestões de unidade (o campo aceita qualquer texto curto). */
export const UNIDADES = ['un', 'par', 'peça', 'kit', 'sessão', 'cm', 'm']

export const SEM_CATEGORIA = 'Sem categoria'

const opcional = (max: number) => z.string().check(z.trim(), z.maxLength(max, `Use no máximo ${max} caracteres.`))

export const produtoSchema = z.object({
  nome: z.string().check(z.trim(), z.minLength(2, 'Informe o nome do produto.'), z.maxLength(160, 'Use no máximo 160 caracteres.')),
  codigo: opcional(30),
  tipo: z.enum(['base', 'adicional']),
  categoria: opcional(80),
  unidade: z.string().check(z.trim(), z.minLength(1, 'Informe a unidade (ex.: un, par).'), z.maxLength(20, 'Use no máximo 20 caracteres.')),
  preco: z.string().check(
    z.refine((v) => v.trim() !== '', 'Informe o preço (pode ser 0,00).'),
    z.refine((v) => {
      const n = parseBRL(v)
      return Number.isFinite(n) && n >= 0 && n <= 1_000_000
    }, 'Preço inválido. Use o formato 1.250,00.'),
  ),
  descricao: opcional(1000),
  ativo: z.boolean(),
})

export type ProdutoForm = z.infer<typeof produtoSchema>

export const produtoVazio: ProdutoForm = {
  nome: '',
  codigo: '',
  tipo: 'base',
  categoria: '',
  unidade: 'un',
  preco: '',
  descricao: '',
  ativo: true,
}

/** Formulário → colunas da tabela produtos. */
export function toPayload(v: ProdutoForm) {
  const vazio = (s: string) => (s.trim() === '' ? null : s.trim())
  return {
    nome: v.nome.trim(),
    codigo: vazio(v.codigo),
    tipo: v.tipo,
    categoria: vazio(v.categoria),
    unidade: v.unidade.trim(),
    preco: parseBRL(v.preco),
    descricao: vazio(v.descricao),
    ativo: v.ativo,
  }
}
