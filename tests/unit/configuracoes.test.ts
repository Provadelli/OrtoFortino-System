import { describe, expect, it } from 'vitest'
import { empresaPayload, empresaSchema, erroItemLista, moverItem, padroesPayload, padroesSchema } from '../../src/features/configuracoes/schema'
import { orcamentoVazio } from '../../src/features/orcamentos/schema'
import { formatCep, formatCnpj, isValidCnpj } from '../../src/lib/br'
import { EMPRESA_PADRAO, rodapeEmpresa } from '../../src/lib/empresa'

describe('CNPJ e CEP', () => {
  it('valida dígitos verificadores', () => {
    expect(isValidCnpj('34.130.423/0001-48')).toBe(true)
    expect(isValidCnpj('11.222.333/0001-81')).toBe(true)
    expect(isValidCnpj('34.130.423/0001-49')).toBe(false)
    expect(isValidCnpj('11111111111111')).toBe(false)
    expect(isValidCnpj('123')).toBe(false)
  })
  it('formata enquanto digita', () => {
    expect(formatCnpj('34130423000148')).toBe('34.130.423/0001-48')
    expect(formatCnpj('3413042')).toBe('34.130.42')
    expect(formatCnpj('341304230001489999')).toBe('34.130.423/0001-48')
    expect(formatCep('26020560')).toBe('26.020-560')
    expect(formatCep('2602')).toBe('26.02')
  })
})

describe('rodapé da empresa', () => {
  it('monta as duas linhas do PDF com os dados padrão', () => {
    expect(rodapeEmpresa(EMPRESA_PADRAO)).toEqual({
      linha1: 'Orto Fortino · Órteses Funcionais · CNPJ 34.130.423/0001-48',
      linha2: 'Rua Itapicuru, 151, Quadra B Lote 40 - Bairro Kennedy, Nova Iguaçu - RJ · CEP 26.020-560 · (21) 96497-3837 · ortofortino@hotmail.com',
    })
  })
  it('omite partes vazias sem deixar separadores soltos', () => {
    const r = rodapeEmpresa({ nome: 'Orto', slogan: null, cnpj: null, endereco: null, cidade: 'Rio - RJ', cep: null, telefone: null, email: null })
    expect(r).toEqual({ linha1: 'Orto', linha2: 'Rio - RJ' })
  })
})

describe('formulários de configurações', () => {
  const empresa = {
    empresa_nome: ' Orto Fortino ',
    empresa_slogan: '',
    empresa_cnpj: '34.130.423/0001-48',
    empresa_endereco: '',
    empresa_cidade: 'Nova Iguaçu - RJ',
    empresa_cep: '26.020-560',
    empresa_telefone: '(21) 96497-3837',
    empresa_email: 'Contato@Orto.com.br',
  }
  it('empresa: guarda só dígitos, vazio vira null e e-mail em minúsculas', () => {
    expect(empresaSchema.safeParse(empresa).success).toBe(true)
    expect(empresaPayload(empresa)).toEqual({
      empresa_nome: 'Orto Fortino',
      empresa_slogan: null,
      empresa_cnpj: '34130423000148',
      empresa_endereco: null,
      empresa_cidade: 'Nova Iguaçu - RJ',
      empresa_cep: '26020560',
      empresa_telefone: '21964973837',
      empresa_email: 'contato@orto.com.br',
    })
  })
  it('empresa: recusa CNPJ, CEP e telefone inválidos', () => {
    const r = empresaSchema.safeParse({ ...empresa, empresa_cnpj: '34.130.423/0001-40', empresa_cep: '2602', empresa_telefone: '9999' })
    expect(r.success).toBe(false)
    expect(r.error?.issues.map((i) => String(i.path[0])).sort()).toEqual(['empresa_cep', 'empresa_cnpj', 'empresa_telefone'])
  })
  it('padrões: validade entre 1 e 365 dias', () => {
    const base = { orc_condicoes_pagamento: '', orc_prazo_entrega: '', orc_observacoes: '' }
    expect(padroesSchema.safeParse({ ...base, orc_validade_dias: '30' }).success).toBe(true)
    expect(padroesSchema.safeParse({ ...base, orc_validade_dias: '0' }).success).toBe(false)
    expect(padroesSchema.safeParse({ ...base, orc_validade_dias: '400' }).success).toBe(false)
    expect(padroesSchema.safeParse({ ...base, orc_validade_dias: '1,5' }).success).toBe(false)
    expect(padroesPayload({ ...base, orc_validade_dias: '30', orc_prazo_entrega: ' 20 dias ' })).toEqual({
      orc_validade_dias: 30,
      orc_condicoes_pagamento: null,
      orc_prazo_entrega: '20 dias',
      orc_observacoes: null,
    })
  })
})

describe('listas da ficha', () => {
  it('não aceita vazio nem repetido (sem diferenciar maiúsculas e acentos)', () => {
    expect(erroItemLista('  ', [])).toMatch(/Digite/)
    expect(erroItemLista('kafo', ['KAFO'])).toMatch(/já está/)
    expect(erroItemLista('Tira de tracao', ['Tira de tração'])).toMatch(/já está/)
    expect(erroItemLista('Nova', ['KAFO'])).toBeNull()
    expect(erroItemLista('x'.repeat(81), [])).toMatch(/80/)
  })
  it('move itens sem sair dos limites', () => {
    expect(moverItem(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c'])
    expect(moverItem(['a', 'b', 'c'], 2, -1)).toEqual(['a', 'c', 'b'])
    expect(moverItem(['a', 'b'], 0, -1)).toEqual(['a', 'b'])
  })
})

describe('orçamento novo com os padrões', () => {
  it('usa validade e textos das configurações', () => {
    const v = orcamentoVazio('p1', '2026-11-11', { orc_validade_dias: 30, orc_condicoes_pagamento: '50% + 50%', orc_prazo_entrega: null, orc_observacoes: 'Obs' })
    expect(v.validade).toBe('2026-12-11')
    expect(v.condicoes_pagamento).toBe('50% + 50%')
    expect(v.prazo_entrega).toBe('')
    expect(v.observacoes).toBe('Obs')
  })
  it('sem configurações, mantém 15 dias e campos vazios', () => {
    const v = orcamentoVazio('', '2026-11-11')
    expect(v.validade).toBe('2026-11-26')
    expect(v.condicoes_pagamento).toBe('')
  })
})
