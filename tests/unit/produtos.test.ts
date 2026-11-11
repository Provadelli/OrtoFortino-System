import { describe, expect, it } from 'vitest'
import { celulaParaTexto, compararComTabela, lerPlanilha, linhasDoExcel, MODELO_CSV, parseCsv, parseCsvComLinhas, parsePreco } from '../../src/features/produtos/csv'
import { readSheet } from 'read-excel-file/browser'
import { gerarXlsx } from '../support/xlsx'
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

describe('importação: planilhas do mundo real', () => {
  it('cabeçalhos variados, linhas de título acima e "Descrição" como nome', () => {
    const { itens, erros } = lerPlanilha(
      [
        ['Tabela de preços Orto Fortino 2026'],
        ['Cód.', 'Descrição do produto', 'Und.', 'Preço unitário (R$)', 'Grupo'],
        ['AFO-01', 'AFO articulada', 'par', 'R$ 1.250,00', 'Órteses'],
      ],
      [1, 3, 4],
    )
    expect(erros).toEqual([])
    expect(itens).toEqual([
      { linha: 4, codigo: 'AFO-01', nome: 'AFO articulada', tipo: 'base', categoria: 'Órteses', unidade: 'par', preco: 1250, descricao: '' },
    ])
  })

  it.each([
    ['R$ 1.250,00', 1250],
    ['1250,5', 1250.5],
    ['1.250', 1250],
    ['1250.50', 1250.5],
    ['1,250.00', 1250],
    ['80', 80],
    ['R$\u00a090,00', 90],
  ])('preço %s → %s', (txt, n) => expect(parsePreco(txt)).toBe(n))

  it('numera as linhas pelo arquivo mesmo com linhas em branco no meio', () => {
    const { rows, linhas } = parseCsvComLinhas('nome;preco\n\nAFO;10\n"SMO\ncom quebra";x\nKAFO;20\n')
    expect(linhas).toEqual([1, 3, 4, 6])
    expect(lerPlanilha(rows, linhas).erros).toEqual([{ linha: 4, mensagem: 'preço “x” inválido' }])
  })

  it('células do Excel: números, vazios e datas', () => {
    expect(celulaParaTexto(1250.499999)).toBe('1250.5')
    expect(celulaParaTexto(null)).toBe('')
    expect(celulaParaTexto(new Date(Date.UTC(2026, 10, 11)))).toBe('11/11/2026')
    expect(linhasDoExcel([['nome', 'preco'], [null, null], ['AFO', 1250]])).toEqual({ rows: [['nome', 'preco'], ['AFO', '1250']], linhas: [1, 3] })
  })

  it('lê um .xlsx de verdade (1ª aba)', async () => {
    const arquivo = gerarXlsx([['Código', 'Produto', 'Valor'], [], ['AD-01', 'Tira valgo', 80], ['AFO-01', 'AFO articulada', 1250.5]])
    const { rows, linhas } = linhasDoExcel(await readSheet(new Blob([arquivo.slice().buffer])))
    const { itens, erros } = lerPlanilha(rows, linhas)
    expect(erros).toEqual([])
    expect(itens.map((i) => [i.linha, i.codigo, i.nome, i.preco])).toEqual([
      [3, 'AD-01', 'Tira valgo', 80],
      [4, 'AFO-01', 'AFO articulada', 1250.5],
    ])
  })
})

describe('compararComTabela', () => {
  const atuais = [
    { id: 'a', codigo: 'AFO-01', nome: 'AFO articulada', nome_busca: 'afo articulada', preco: 1250, ativo: true },
    { id: 'b', codigo: 'SMO-01', nome: 'SMO', nome_busca: 'smo', preco: 890, ativo: false },
  ]
  const item = (linha: number, codigo: string, nome: string, preco: number) => ({ linha, codigo, nome, tipo: 'base' as const, categoria: '', unidade: 'un', preco, descricao: '' })

  it('novo, reajuste, igual (reativa) e conflitos', () => {
    const { previa, conflitos } = compararComTabela(
      [item(2, '', 'KAFO', 2000), item(3, 'AFO-01', 'AFO articulada', 1300), item(4, '', 'SMO', 890), item(5, 'AFO-01', 'SMO', 1), item(6, '', 'afo articulada', 1)],
      atuais,
    )
    expect(previa.map((p) => [p.item.linha, p.mudanca])).toEqual([
      [2, { tipo: 'novo' }],
      [3, { tipo: 'preco', antes: 1250 }],
      [4, { tipo: 'igual', reativa: true }],
    ])
    expect(conflitos).toEqual([
      { linha: 5, mensagem: 'o código “AFO-01” é de “AFO articulada”, mas o nome “SMO” já é de outro produto (código SMO-01)' },
      { linha: 6, mensagem: 'atualizaria “AFO articulada”, que a linha 3 já atualiza' },
    ])
  })
})
