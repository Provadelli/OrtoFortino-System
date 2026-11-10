import { describe, expect, it } from 'vitest'
import { lerPlanilha, MODELO_CSV, parseCsv } from '../../src/features/produtos/csv'
import { produtoSchema, produtoVazio, toPayload } from '../../src/features/produtos/schema'

describe('parseCsv', () => {
  it('Excel em português: ";" e BOM', () => {
    expect(parseCsv('﻿nome;preco\r\nAFO;1.250,00\r\n')).toEqual([
      ['nome', 'preco'],
      ['AFO', '1.250,00'],
    ])
  })
  it('vírgula, aspas, aspas escapadas e quebra de linha dentro de aspas', () => {
    expect(parseCsv('nome,preco,descricao\n"AFO, articulada",1250.00,"diz ""oi""\nlinha 2"\n')).toEqual([
      ['nome', 'preco', 'descricao'],
      ['AFO, articulada', '1250.00', 'diz "oi"\nlinha 2'],
    ])
  })
  it('tabulação (colado do Excel) e linhas vazias ignoradas', () => {
    expect(parseCsv('nome\tpreco\n\nSMO\t890\n;;\n')).toEqual([
      ['nome', 'preco'],
      ['SMO', '890'],
      [';;'],
    ])
  })
  it('última linha sem quebra', () => {
    expect(parseCsv('nome;preco\nSMO;890')).toEqual([
      ['nome', 'preco'],
      ['SMO', '890'],
    ])
  })
})

describe('lerPlanilha', () => {
  it('lê o modelo sem erros', () => {
    const { itens, erros } = lerPlanilha(parseCsv(MODELO_CSV))
    expect(erros).toEqual([])
    expect(itens).toHaveLength(4)
    expect(itens[0]).toMatchObject({ linha: 2, codigo: 'AFO-01', nome: 'AFO articulada', tipo: 'base', unidade: 'par', preco: 1250 })
    expect(itens[2]).toMatchObject({ tipo: 'adicional', preco: 80 })
  })

  it('aceita cabeçalhos alternativos, acentos e colunas em outra ordem', () => {
    const { itens, erros } = lerPlanilha([
      ['Valor (R$)', 'Produto', 'Tipo', 'Categoria'],
      ['R$ 45', 'Forro temático', 'Adicional', 'Personalização'],
      ['1250', 'AFO', '', ''],
    ])
    expect(erros).toEqual([])
    expect(itens).toEqual([
      { linha: 2, codigo: '', nome: 'Forro temático', tipo: 'adicional', categoria: 'Personalização', unidade: 'un', preco: 45, descricao: '' },
      { linha: 3, codigo: '', nome: 'AFO', tipo: 'base', categoria: '', unidade: 'un', preco: 1250, descricao: '' },
    ])
  })

  it('aponta erros por linha e mantém as linhas boas', () => {
    const { itens, erros } = lerPlanilha([
      ['codigo', 'nome', 'tipo', 'preco'],
      ['A1', 'AFO', 'base', '1.250,00'],
      ['A2', '', 'base', '10'],
      ['A3', 'SMO', 'outro', 'abc'],
      ['A1', 'afo', 'base', '5'],
      ['A4', 'Palmilha', 'base', ''],
    ])
    expect(itens.map((i) => i.nome)).toEqual(['AFO'])
    expect(erros).toEqual([
      { linha: 3, mensagem: 'nome vazio' },
      { linha: 4, mensagem: 'tipo “outro” desconhecido (use base ou adicional); preço “abc” inválido' },
      { linha: 5, mensagem: 'nome repetido (igual à linha 2); código repetido (igual à linha 2)' },
      { linha: 6, mensagem: 'preço vazio' },
    ])
  })

  it('exige as colunas nome e preço', () => {
    expect(lerPlanilha([['codigo', 'descricao'], ['A', 'B']]).erros[0]!.mensagem).toMatch(/“nome” e “preço”/)
  })

  it('planilha vazia ou só com cabeçalho', () => {
    expect(lerPlanilha([]).erros[0]!.mensagem).toBe('A planilha está vazia.')
    expect(lerPlanilha([['nome', 'preco']]).erros[0]!.mensagem).toMatch(/Nenhum produto/)
  })
})

describe('produtoSchema', () => {
  it('valida preço no padrão brasileiro e converte o payload', () => {
    const v = { ...produtoVazio, nome: ' AFO articulada ', preco: '1.250,50', categoria: '  ' }
    expect(produtoSchema.safeParse(v).success).toBe(true)
    expect(toPayload(v)).toMatchObject({ nome: 'AFO articulada', preco: 1250.5, categoria: null, codigo: null, unidade: 'un' })
  })
  it('recusa preço vazio, negativo ou mal formatado', () => {
    for (const preco of ['', '-5', '12,345', 'abc']) expect(produtoSchema.safeParse({ ...produtoVazio, nome: 'AFO', preco }).success, preco).toBe(false)
    expect(produtoSchema.safeParse({ ...produtoVazio, nome: 'AFO', preco: '0' }).success).toBe(true)
  })
})
