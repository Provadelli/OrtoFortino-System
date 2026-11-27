import { describe, expect, it } from 'vitest'
import { dadosPdf, nomeArquivoPdf, type OrcamentoParaPdf } from '@/features/orcamentos/pdf/dados'

const HOJE = new Date(2026, 10, 10) // 10/11/2026

const base: OrcamentoParaPdf = {
  numero: 'ORC-2026-0012',
  status: 'enviado',
  data_emissao: '2026-11-10',
  validade: '2026-11-25',
  aprovado_em: null,
  desconto_tipo: 'percentual',
  desconto: 10,
  subtotal: 1330,
  desconto_valor: 133,
  total: 1197,
  condicoes_pagamento: '50% na aprovação',
  prazo_entrega: '20 dias úteis',
  observacoes: null,
  pacientes: {
    nome: 'Helena Ribeiro',
    cpf: '52998224725',
    data_nascimento: '2018-05-10',
    telefone: '21964973837',
    responsaveis: [
      { nome: 'João Ribeiro', cpf: null, telefone: null, parentesco: 'Pai', principal: false },
      { nome: 'Marina Ribeiro', cpf: '11144477735', telefone: '21981180919', parentesco: 'Mãe', principal: true },
    ],
  },
  orcamento_itens: [
    { secao: 'Órteses', descricao: 'AFO articulada', detalhe: 'tema dinossauros', quantidade: 1, unidade: 'par', preco_unitario: 1250, total: 1250 },
    { secao: 'Adicionais', descricao: 'Tira valgo', detalhe: null, quantidade: 1.5, unidade: 'un', preco_unitario: 80, total: 120 },
    { secao: null, descricao: 'Avulso', detalhe: null, quantidade: 1, unidade: 'un', preco_unitario: 10, total: 10 },
  ],
}

describe('dados do PDF do orçamento', () => {
  it('formata datas, valores, documento e telefone', () => {
    const d = dadosPdf(base, HOJE)
    expect(d.emissao).toBe('10/11/2026')
    expect(d.validade).toBe('25/11/2026')
    expect(d.paciente).toMatchObject({ nome: 'Helena Ribeiro', documento: 'CPF 529.982.247-25', telefone: '(21) 96497-3837', idade: '8 anos (nasc. 10/05/2018)' })
    expect(d.total).toMatch(/^R\$\s1\.197,00$/)
    expect(d.desconto?.rotulo).toBe('Desconto (10%)')
    expect(d.desconto?.valor).toMatch(/^− R\$\s133,00$/)
  })

  it('paciente menor sai com o responsável principal', () => {
    expect(dadosPdf(base, HOJE).responsavel).toEqual({ nome: 'Marina Ribeiro', parentesco: 'Mãe', cpf: '111.444.777-35', telefone: '(21) 98118-0919' })
  })

  it('paciente adulto não leva responsável', () => {
    const adulto = { ...base, pacientes: { ...base.pacientes!, data_nascimento: '1990-01-01' } }
    expect(dadosPdf(adulto, HOJE).responsavel).toBeNull()
  })

  it('agrupa itens por seção, com quantidade e subtotais', () => {
    const d = dadosPdf(base, HOJE)
    expect(d.secoes.map((s) => s.nome)).toEqual(['Órteses', 'Adicionais', 'Outros itens'])
    expect(d.secoes[1]!.itens[0]!.quantidade).toBe('1,5 un')
    expect(d.secoes[1]!.subtotal).toMatch(/120,00/)
    expect(d.mostrarSubtotais).toBe(true)
  })

  it('sem desconto não mostra a linha de desconto', () => {
    expect(dadosPdf({ ...base, desconto: 0, desconto_valor: 0, total: 1330 }, HOJE).desconto).toBeNull()
  })

  it('avisa quando não é uma proposta definitiva', () => {
    expect(dadosPdf({ ...base, status: 'rascunho' }, HOJE).aviso).toMatch(/Rascunho/)
    expect(dadosPdf({ ...base, status: 'substituido' }, HOJE).aviso).toMatch(/substituída/)
    expect(dadosPdf({ ...base, status: 'aprovado', aprovado_em: '2026-11-12T13:00:00Z' }, HOJE).aviso).toBe('Aprovado em 12/11/2026')
    expect(dadosPdf(base, HOJE).aviso).toBeNull()
  })

  it('nome do arquivo sem caracteres proibidos', () => {
    expect(nomeArquivoPdf('ORC-2026-0012', 'Ana / Maria: "teste"')).toBe('ORC-2026-0012 - Ana Maria teste.pdf')
    expect(nomeArquivoPdf('ORC-2026-0012-v2', undefined)).toBe('ORC-2026-0012-v2.pdf')
  })
})

describe('endereço e CNPJ no PDF', () => {
  it('monta o endereço do cliente, omitindo partes vazias', () => {
    const d = dadosPdf({ ...base, pacientes: { ...base.pacientes!, endereco: 'Rua A, 10 - Centro', cidade: 'Niterói', uf: 'RJ', cep: '24020000' } }, HOJE)
    expect(d.paciente?.endereco).toBe('Rua A, 10 - Centro · Niterói/RJ · CEP 24.020-000')
    expect(dadosPdf({ ...base, pacientes: { ...base.pacientes!, cidade: 'Niterói' } }, HOJE).paciente?.endereco).toBe('Niterói')
    expect(dadosPdf(base, HOJE).paciente?.endereco).toBeNull()
  })

  it('cliente PJ sai com CNPJ no lugar do CPF', () => {
    const d = dadosPdf({ ...base, pacientes: { ...base.pacientes!, tipo_documento: 'cnpj', cnpj: '34130423000148', cpf: null } }, HOJE)
    expect(d.paciente?.documento).toBe('CNPJ 34.130.423/0001-48')
  })
})
