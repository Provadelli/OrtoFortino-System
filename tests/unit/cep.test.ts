import { afterEach, describe, expect, it, vi } from 'vitest'
import { buscarCep, CepIndisponivel } from '@/lib/cep'

const resposta = (corpo: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json' } }))

afterEach(() => vi.unstubAllGlobals())

describe('buscarCep (ViaCEP)', () => {
  it('converte a resposta e só envia o CEP', async () => {
    const f = vi.fn(() => resposta({ cep: '26020-560', logradouro: 'Rua Itapicuru', bairro: 'Kennedy', localidade: 'Nova Iguaçu', uf: 'RJ' }))
    vi.stubGlobal('fetch', f)
    expect(await buscarCep('26.020-560')).toEqual({ logradouro: 'Rua Itapicuru', bairro: 'Kennedy', cidade: 'Nova Iguaçu', uf: 'RJ' })
    expect(f).toHaveBeenCalledWith('https://viacep.com.br/ws/26020560/json/', expect.objectContaining({ credentials: 'omit', referrerPolicy: 'no-referrer' }))
  })

  it('CEP inexistente ou incompleto → null', async () => {
    vi.stubGlobal('fetch', vi.fn(() => resposta({ erro: 'true' })))
    expect(await buscarCep('99999999')).toBeNull()
    expect(await buscarCep('2602')).toBeNull()
  })

  it('UF desconhecida é descartada e textos são limitados', async () => {
    vi.stubGlobal('fetch', vi.fn(() => resposta({ logradouro: 'x'.repeat(500), bairro: 1, localidade: 'Cidade', uf: 'ZZ' })))
    const r = await buscarCep('01001000')
    expect(r).toMatchObject({ bairro: '', uf: '', cidade: 'Cidade' })
    expect(r!.logradouro).toHaveLength(160)
  })

  it('falha de rede ou resposta inválida → CepIndisponivel', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('offline'))))
    await expect(buscarCep('01001000')).rejects.toBeInstanceOf(CepIndisponivel)
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('<html>', { status: 200 }))))
    await expect(buscarCep('01001000')).rejects.toBeInstanceOf(CepIndisponivel)
    vi.stubGlobal('fetch', vi.fn(() => resposta({}, 503)))
    await expect(buscarCep('01001000')).rejects.toBeInstanceOf(CepIndisponivel)
  })
})
