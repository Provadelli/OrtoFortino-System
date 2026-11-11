import { describe, expect, it } from 'vitest'
import { ageFrom, formatCpf, formatIsoDate, formatMoneyInput, formatPhone, isValidCpf, parseBRL } from '../../src/lib/br'
import { atendimentoSchema, atendimentoVazio, toPayload as toPayloadAtendimento } from '../../src/features/atendimentos/schema'
import { descreverPagamento } from '../../src/features/atendimentos/constants'
import { pacienteSchema, pacienteVazio, toPayload } from '../../src/features/pacientes/schema'

describe('CPF', () => {
  it.each(['529.982.247-25', '52998224725', '111.444.777-35'])('válido: %s', (c) => expect(isValidCpf(c)).toBe(true))
  it.each(['123.456.789-00', '111.111.111-11', '5299822472', ''])('inválido: %s', (c) => expect(isValidCpf(c)).toBe(false))
  it('formata enquanto digita', () => {
    expect(formatCpf('529')).toBe('529')
    expect(formatCpf('5299')).toBe('529.9')
    expect(formatCpf('5299822')).toBe('529.982.2')
    expect(formatCpf('52998224725')).toBe('529.982.247-25')
    expect(formatCpf('529982247259999')).toBe('529.982.247-25')
  })
})

describe('telefone', () => {
  it('celular e fixo', () => {
    expect(formatPhone('21964973837')).toBe('(21) 96497-3837')
    expect(formatPhone('2133334444')).toBe('(21) 3333-4444')
    expect(formatPhone('21')).toBe('(21')
  })
})

describe('idade', () => {
  const hoje = new Date(2026, 10, 10)
  it('antes e depois do aniversário', () => {
    expect(ageFrom('2018-11-10', hoje)).toBe(8)
    expect(ageFrom('2018-11-11', hoje)).toBe(7)
    expect(ageFrom(null, hoje)).toBeNull()
  })
  it('data BR', () => expect(formatIsoDate('2018-05-10')).toBe('10/05/2018'))
})

describe('schema do paciente', () => {
  it('exige nome da clínica quando a origem não é particular', () => {
    const r = pacienteSchema.safeParse({ ...pacienteVazio, nome: 'Ana Souza', origem: 'clinica' })
    expect(r.success).toBe(false)
  })
  it('aceita particular sem nome de clínica', () => {
    expect(pacienteSchema.safeParse({ ...pacienteVazio, nome: 'Ana Souza' }).success).toBe(true)
  })
  it('payload salva só dígitos e limpa a clínica de particular', () => {
    const p = toPayload({ ...pacienteVazio, nome: 'Ana', cpf: '529.982.247-25', telefone: '(21) 96497-3837', origem_nome: 'X' })
    expect(p.dados.cpf).toBe('52998224725')
    expect(p.dados.telefone).toBe('21964973837')
    expect(p.dados.origem_nome).toBe('')
  })
})

describe('valores em reais', () => {
  it('entende o formato brasileiro', () => {
    expect(parseBRL('1.250,00')).toBe(1250)
    expect(parseBRL('1.250')).toBe(1250)
    expect(parseBRL('12.000.000')).toBe(12000000)
    expect(parseBRL('R$ 50')).toBe(50)
    expect(parseBRL('99,9')).toBe(99.9)
    expect(parseBRL('1234.56')).toBe(1234.56)
    expect(parseBRL('')).toBe(0)
  })
  it('rejeita valores inválidos', () => {
    expect(parseBRL('abc')).toBeNaN()
    expect(parseBRL('1,2,3')).toBeNaN()
    expect(parseBRL('-10')).toBeNaN()
  })
  it('formata para o campo', () => {
    expect(formatMoneyInput(1250.5)).toBe('1.250,50')
  })
})

describe('schema do atendimento', () => {
  const base = { ...atendimentoVazio('11111111-1111-4111-8111-111111111111', '2026-11-09'), valor: '1.250,00' }
  it('não aceita pago maior que o valor', () => {
    const r = atendimentoSchema.safeParse({ ...base, valor_pago: '2.000' })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0]?.path).toEqual(['valor_pago'])
  })
  it('não aceita fechamento antes do primeiro contato', () => {
    expect(atendimentoSchema.safeParse({ ...base, data_fechamento: '2026-11-01' }).success).toBe(false)
  })
  it('sem ficha envia null e converte valores', () => {
    const p = toPayloadAtendimento({ ...base, valor_pago: '500', com_ficha: false })
    expect(p.ficha).toBeNull()
    expect(p.dados).toMatchObject({ valor: 1250, valor_pago: 500 })
  })
  it('ficha de prótese limpa campos de órtese', () => {
    const p = toPayloadAtendimento({ ...base, ficha: { ...base.ficha, tipo: 'protese', produto: 'x', especificacoes: ['90°'], tema: 'dino' } })
    expect(p.ficha).toMatchObject({ tipo: 'protese', especificacoes: [], tema: '' })
  })
  it('parcelas só seguem para crédito e boleto', () => {
    expect(toPayloadAtendimento({ ...base, pagamento_forma: 'credito', pagamento_parcelas: '3' }).dados.pagamento_parcelas).toBe('3')
    expect(toPayloadAtendimento({ ...base, pagamento_forma: 'boleto', pagamento_parcelas: '2' }).dados.pagamento_parcelas).toBe('2')
    expect(toPayloadAtendimento({ ...base, pagamento_forma: 'debito', pagamento_parcelas: '3' }).dados.pagamento_parcelas).toBe('')
    expect(toPayloadAtendimento({ ...base, pagamento_forma: '', pagamento_parcelas: '3' }).dados.pagamento_parcelas).toBe('')
  })
})

describe('forma de pagamento', () => {
  it('descreve crédito parcelado, à vista e formas antigas', () => {
    expect(descreverPagamento('credito', 3, 1250)).toMatch(/^Cartão de crédito · 3x de R\$\s416,67$/)
    expect(descreverPagamento('credito', 1, 1250)).toBe('Cartão de crédito · à vista')
    expect(descreverPagamento('debito', null, 1250)).toBe('Cartão de débito')
    expect(descreverPagamento('cartao', null, 100)).toBe('Cartão')
    expect(descreverPagamento('boleto', 2, 0)).toBe('Boleto · 2x')
    expect(descreverPagamento(null, null, 0)).toBeNull()
  })
})
