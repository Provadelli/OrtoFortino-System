import { describe, expect, it } from 'vitest'
import { agruparSecoes, calcular, SEM_SECAO } from '../../src/features/orcamentos/calc'
import { somarDias, vencido } from '../../src/features/orcamentos/constants'
import { orcamentoSchema, orcamentoVazio, parseQtd, toPayload, type ItemForm } from '../../src/features/orcamentos/schema'

const item = (over: Partial<ItemForm>): ItemForm => ({
  produto_id: '',
  tipo: 'base',
  secao: '',
  descricao: 'Item',
  detalhe: '',
  quantidade: '1',
  unidade: 'un',
  preco_unitario: '0',
  preco_tabela: null,
  salvar_na_tabela: false,
  ...over,
})

describe('calcular (igual ao banco)', () => {
  const itens = [
    { secao: 'Órteses', quantidade: 2, preco_unitario: 1100.5 },
    { secao: 'Adicionais', quantidade: 1, preco_unitario: 80 },
    { secao: 'Órteses', quantidade: 1, preco_unitario: 0 },
  ]
  it('subtotais por seção na ordem de aparição e desconto percentual', () => {
    const r = calcular(itens, 'percentual', 10)
    expect(r.secoes).toEqual([
      { nome: 'Órteses', indices: [0, 2], subtotal: 2201 },
      { nome: 'Adicionais', indices: [1], subtotal: 80 },
    ])
    expect(r).toMatchObject({ subtotal: 2281, descontoValor: 228.1, total: 2052.9 })
  })
  it('desconto em reais nunca passa do subtotal', () => {
    expect(calcular(itens.slice(1, 2), 'valor', 5000)).toMatchObject({ subtotal: 80, descontoValor: 80, total: 0 })
  })
  it('arredonda cada item em centavos', () => {
    expect(calcular([{ secao: '', quantidade: 1.5, preco_unitario: 33.33 }], 'valor', 0).totais).toEqual([50])
  })
  it('item sem seção vai para "Outros itens"', () => {
    expect(agruparSecoes([{ secao: ' ' }])[0]!.nome).toBe(SEM_SECAO)
  })
})

describe('schema e payload', () => {
  it('quantidade com vírgula', () => {
    expect(parseQtd('1,5')).toBe(1.5)
    expect(parseQtd('0')).toBe(0)
    expect(parseQtd('abc')).toBeNaN()
  })

  it('validade padrão de 15 dias e datas sem fuso', () => {
    expect(orcamentoVazio('', '2026-12-25').validade).toBe('2027-01-09')
    expect(somarDias('2026-02-27', 2)).toBe('2026-03-01')
    expect(vencido('enviado', '2026-11-09', '2026-11-10')).toBe(true)
    expect(vencido('aprovado', '2026-11-09', '2026-11-10')).toBe(false)
  })

  it('exige paciente, itens e desconto coerente', () => {
    const base = orcamentoVazio('p1', '2026-11-10')
    expect(orcamentoSchema.safeParse(base).success).toBe(false) // sem itens
    const ok = { ...base, itens: [item({ preco_unitario: '10' })] }
    expect(orcamentoSchema.safeParse(ok).success).toBe(true)
    expect(orcamentoSchema.safeParse({ ...ok, desconto_tipo: 'percentual', desconto: '150' }).success).toBe(false)
    expect(orcamentoSchema.safeParse({ ...ok, validade: '2026-11-01' }).success).toBe(false)
    expect(orcamentoSchema.safeParse({ ...ok, itens: [item({ quantidade: '0' })] }).success).toBe(false)
  })

  it('agrupa os itens por seção e só marca "salvar na tabela" quando o preço mudou', () => {
    const v = {
      ...orcamentoVazio('p1', '2026-11-10'),
      desconto: '1.000,00',
      itens: [
        item({ produto_id: 'a', secao: 'Órteses', descricao: 'AFO', preco_unitario: '1.300,00', preco_tabela: 1250, salvar_na_tabela: true }),
        item({ secao: 'Adicionais', descricao: 'Tira', preco_unitario: '80' }),
        item({ produto_id: 'b', secao: 'Órteses', descricao: 'SMO', quantidade: '2', preco_unitario: '890,00', preco_tabela: 890, salvar_na_tabela: true }),
      ],
    }
    const p = toPayload(v)
    expect(p.dados.desconto).toBe(1000)
    expect(p.itens.map((i) => [i.descricao, i.salvar_na_tabela, i.produto_id])).toEqual([
      ['AFO', true, 'a'],
      ['SMO', false, 'b'],
      ['Tira', false, null],
    ])
    expect(p.itens[1]).toMatchObject({ quantidade: 2, preco_unitario: 890 })
  })
})
