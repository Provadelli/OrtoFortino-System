import { describe, expect, it } from 'vitest'
import { ageFrom, formatCpf, formatIsoDate, formatPhone, isValidCpf } from '../../src/lib/br'
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
