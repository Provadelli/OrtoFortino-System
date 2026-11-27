import { afterEach, describe, expect, it, vi } from 'vitest'
import { buscarCnpj, CnpjIndisponivel } from '@/lib/cnpj'
import { maskCnpj } from '@/lib/format'
import { pacienteSchema, pacienteVazio, toPayload } from '@/features/pacientes/schema'

const resposta = (corpo: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json' } }))

afterEach(() => vi.unstubAllGlobals())

describe('buscarCnpj (BrasilAPI)', () => {
  it('converte a resposta e só envia o CNPJ', async () => {
    const f = vi.fn(() =>
      resposta({
        razao_social: 'ORTO FORTINO LTDA',
        nome_fantasia: 'ORTO FORTINO',
        cep: '26020560',
        descricao_tipo_de_logradouro: 'RUA',
        logradouro: 'DOS OLIVEIRAS',
        numero: '120',
        complemento: 'SALA 2',
        bairro: 'CENTRO',
        municipio: 'NOVA IGUACU',
        uf: 'rj',
        ddd_telefone_1: '2133334444',
      }),
    )
    vi.stubGlobal('fetch', f)
    expect(await buscarCnpj('34.130.423/0001-48')).toEqual({
      razaoSocial: 'ORTO FORTINO LTDA',
      nomeFantasia: 'ORTO FORTINO',
      cep: '26020560',
      endereco: 'Rua dos Oliveiras, 120, Sala 2 - Centro',
      cidade: 'Nova Iguacu',
      uf: 'RJ',
      telefone: '2133334444',
    })
    expect(f).toHaveBeenCalledWith('https://brasilapi.com.br/api/cnpj/v1/34130423000148', expect.objectContaining({ credentials: 'omit', referrerPolicy: 'no-referrer' }))
  })

  it('CNPJ inexistente (404) ou incompleto → null', async () => {
    vi.stubGlobal('fetch', vi.fn(() => resposta({ message: 'CNPJ não encontrado' }, 404)))
    expect(await buscarCnpj('34130423000148')).toBeNull()
    expect(await buscarCnpj('3413')).toBeNull()
  })

  it('falha de rede, 5xx ou resposta sem razão social → CnpjIndisponivel', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('offline'))))
    await expect(buscarCnpj('34130423000148')).rejects.toBeInstanceOf(CnpjIndisponivel)
    vi.stubGlobal('fetch', vi.fn(() => resposta({}, 500)))
    await expect(buscarCnpj('34130423000148')).rejects.toBeInstanceOf(CnpjIndisponivel)
    vi.stubGlobal('fetch', vi.fn(() => resposta({ cep: '1' })))
    await expect(buscarCnpj('34130423000148')).rejects.toBeInstanceOf(CnpjIndisponivel)
  })
})

describe('paciente com CNPJ', () => {
  const valido = { ...pacienteVazio, nome: 'Orto Fortino Ltda', consentimento: true }

  it('valida o CNPJ e envia só o documento do tipo escolhido, só com dígitos', () => {
    const v = { ...valido, tipo_documento: 'cnpj' as const, cnpj: '34.130.423/0001-48', cpf: '529.982.247-25' }
    expect(pacienteSchema.safeParse(v).success).toBe(true)
    const { dados } = toPayload(v)
    expect(dados).toMatchObject({ tipo_documento: 'cnpj', cnpj: '34130423000148', cpf: '' })
  })

  it('rejeita CNPJ com dígito verificador errado', () => {
    expect(pacienteSchema.safeParse({ ...valido, tipo_documento: 'cnpj', cnpj: '34.130.423/0001-49' }).success).toBe(false)
  })

  it('máscara de listagem', () => {
    expect(maskCnpj('34130423000148')).toBe('**.130.423/0001-**')
  })
})
