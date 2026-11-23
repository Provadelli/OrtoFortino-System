import { describe, expect, it } from 'vitest'
import { mensagemErroExclusao, textoConfere } from '@/lib/exclusao'

describe('mensagemErroExclusao', () => {
  it('traduz códigos do Postgres', () => {
    expect(mensagemErroExclusao({ code: '42501' })).toMatch(/permissão/)
    expect(mensagemErroExclusao({ code: '55000' })).toMatch(/outra tela/)
    expect(mensagemErroExclusao({ code: '23503' })).toMatch(/ainda é usado/)
    expect(mensagemErroExclusao({ code: '23001' })).toMatch(/ainda é usado/)
  })
  it('usa mensagem genérica para o resto', () => {
    expect(mensagemErroExclusao(new Error('x'))).toBe('Não foi possível excluir agora. Tente de novo.')
    expect(mensagemErroExclusao(null)).toBe('Não foi possível excluir agora. Tente de novo.')
  })
})

describe('textoConfere', () => {
  it('ignora caixa, acentos e espaços extras', () => {
    expect(textoConfere('  maria  da SILVA ', 'Maria da Silva')).toBe(true)
    expect(textoConfere('joao', 'João')).toBe(true)
  })
  it('recusa texto diferente ou vazio', () => {
    expect(textoConfere('', 'Maria')).toBe(false)
    expect(textoConfere('Mari', 'Maria')).toBe(false)
  })
})
