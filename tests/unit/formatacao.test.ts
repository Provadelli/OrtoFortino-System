import { describe, expect, it } from 'vitest'
import { formatDecimalTyping, formatMoneyBlur, parseBRL, somarDias } from '@/lib/br'
import { emitente, EMPRESA_PADRAO } from '@/lib/empresa'

describe('formatDecimalTyping (padrão contábil enquanto digita)', () => {
  it.each([
    ['', ''],
    ['1', '1'],
    ['1250', '1.250'],
    ['1250000', '1.250.000'],
    ['1250,', '1.250,'],
    ['1250,5', '1.250,5'],
    ['1.250,507', '1.250,50'],
    ['R$ 1.250,00', '1.250,00'],
    ['1250.50', '1.250,50'],
    ['0.5', '0,5'],
    ['1250.', '1.250,'],
    ['1.25', '125'], // apagou o último dígito de "1.250"
    ['1.2505', '12.505'],
    [',5', '0,5'],
    ['007', '7'],
    ['abc12', '12'],
    ['1,2,3', '1,23'],
  ])('%s → %s', (entrada, saida) => {
    expect(formatDecimalTyping(entrada)).toBe(saida)
  })

  it('o resultado é sempre entendido pelo parseBRL', () => {
    for (const v of ['1250', '1250,5', '1.250,507', '1250.50', '99999999,99']) expect(Number.isFinite(parseBRL(formatDecimalTyping(v)))).toBe(true)
  })
})

describe('formatMoneyBlur', () => {
  it.each([
    ['', ''],
    ['1.250', '1.250,00'],
    ['1.250,5', '1.250,50'],
    ['0,', '0,00'],
    ['abc', 'abc'],
  ])('%s → %s', (entrada, saida) => expect(formatMoneyBlur(entrada)).toBe(saida))
})

describe('somarDias', () => {
  it('atravessa mês e ano', () => {
    expect(somarDias('2026-11-25', 15)).toBe('2026-12-10')
    expect(somarDias('2026-12-20', 30)).toBe('2027-01-19')
  })
})

describe('emitente (cabeçalho do PDF)', () => {
  it('formata CNPJ, endereço com CEP e contatos', () => {
    expect(emitente(EMPRESA_PADRAO)).toEqual({
      nome: 'Orto Fortino',
      slogan: 'Órteses Funcionais',
      cnpj: 'CNPJ 34.130.423/0001-48',
      endereco: 'Rua Itapicuru, 151, Quadra B Lote 40 - Bairro Kennedy, Nova Iguaçu - RJ · CEP 26.020-560',
      contato: '(21) 96497-3837 · ortofortino@hotmail.com',
    })
  })
  it('omite linhas vazias', () => {
    const e = emitente({ ...EMPRESA_PADRAO, slogan: ' ', cnpj: null, endereco: null, cidade: null, cep: null, telefone: null, email: null })
    expect(e).toMatchObject({ slogan: null, cnpj: null, endereco: null, contato: null })
  })
})
