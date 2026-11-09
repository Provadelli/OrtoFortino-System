import { describe, expect, it } from 'vitest'
import { loginSchema, resetSchema } from '../../src/features/auth/schemas'
import { safeNext } from '../../src/features/auth/safe-next'
import { formatLongDate, greeting, initials, maskCpf } from '../../src/lib/format'

describe('safeNext (anti open-redirect)', () => {
  it('aceita caminhos internos', () => expect(safeNext('/clientes?x=1')).toBe('/clientes?x=1'))
  it.each([null, '', 'https://mal.com', '//mal.com', '/\\mal.com', 'javascript:alert(1)'])('rejeita %s', (v) =>
    expect(safeNext(v)).toBe('/painel'),
  )
})

describe('loginSchema', () => {
  it('normaliza e valida e-mail', () => {
    const r = loginSchema.safeParse({ email: '  equipe@ortofortino.com.br ', password: 'x', remember: true })
    expect(r.success && r.data.email).toBe('equipe@ortofortino.com.br')
  })
  it('recusa e-mail inválido', () => expect(loginSchema.safeParse({ email: 'abc', password: 'x', remember: false }).success).toBe(false))
})

describe('resetSchema', () => {
  it('exige 12+ caracteres, letra e número', () => {
    expect(resetSchema.safeParse({ password: 'curta1', confirm: 'curta1' }).success).toBe(false)
    expect(resetSchema.safeParse({ password: 'somenteletrasaqui', confirm: 'somenteletrasaqui' }).success).toBe(false)
    expect(resetSchema.safeParse({ password: 'senhaForte2026', confirm: 'senhaForte2026' }).success).toBe(true)
  })
  it('exige confirmação igual', () => expect(resetSchema.safeParse({ password: 'senhaForte2026', confirm: 'outra' }).success).toBe(false))
})

describe('format', () => {
  it('mascara CPF', () => expect(maskCpf('123.456.789-09')).toBe('***.456.789-**'))
  it('data por extenso', () => expect(formatLongDate(new Date(2026, 10, 9))).toBe('Segunda-feira, 9 de novembro de 2026'))
  it('saudação', () => {
    expect(greeting(new Date(2026, 0, 1, 9))).toBe('Bom dia')
    expect(greeting(new Date(2026, 0, 1, 14))).toBe('Boa tarde')
    expect(greeting(new Date(2026, 0, 1, 20))).toBe('Boa noite')
  })
  it('iniciais', () => expect(initials('Polyana S.')).toBe('PS'))
})
