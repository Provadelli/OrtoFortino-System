import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apagarRascunho, gravarRascunho, lerRascunho, limparRascunhos } from '@/lib/rascunho'

// sessionStorage em memória (os testes unitários rodam no Node)
function memoria(): Storage {
  const m = new Map<string, string>()
  const s = {
    get length() {
      return m.size
    },
    clear: () => m.clear(),
    getItem: (k: string) => m.get(k) ?? null,
    key: (i: number) => [...m.keys()][i] ?? null,
    removeItem: (k: string) => void m.delete(k),
    setItem: (k: string, v: string) => void m.set(k, String(v)),
  }
  // Object.keys(sessionStorage) lista as chaves: imita com um Proxy
  return new Proxy(s, { ownKeys: () => [...m.keys()], getOwnPropertyDescriptor: (_, k) => (m.has(String(k)) ? { enumerable: true, configurable: true, value: m.get(String(k)) } : undefined) }) as Storage
}

const T0 = Date.UTC(2026, 10, 10, 12)

describe('rascunho automático', () => {
  let store: Storage
  beforeEach(() => {
    store = memoria()
    vi.stubGlobal('window', { sessionStorage: store })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('grava e lê de volta', () => {
    gravarRascunho('orcamento:novo', null, { nome: 'Helena' }, T0)
    expect(lerRascunho('orcamento:novo', null, T0 + 1000)).toEqual({ v: 1, base: null, salvoEm: T0, valores: { nome: 'Helena' } })
  })

  it('descarta depois de 24 horas', () => {
    gravarRascunho('orcamento:novo', null, { a: 1 }, T0)
    expect(lerRascunho('orcamento:novo', null, T0 + 25 * 3600_000)).toBeNull()
    expect(store.getItem('of:rascunho:orcamento:novo')).toBeNull()
  })

  it('descarta se o registro mudou no servidor desde o rascunho', () => {
    gravarRascunho('atendimento:1', '2026-11-10T10:00:00Z', { a: 1 }, T0)
    expect(lerRascunho('atendimento:1', '2026-11-10T11:00:00Z', T0)).toBeNull()
  })

  it('ignora conteúdo corrompido sem quebrar', () => {
    store.setItem('of:rascunho:paciente:novo', '{nao é json')
    expect(lerRascunho('paciente:novo', null, T0)).toBeNull()
  })

  it('apaga um e limpa todos ao sair, sem mexer em outras chaves', () => {
    gravarRascunho('a', null, 1, T0)
    gravarRascunho('b', null, 2, T0)
    store.setItem('outra-coisa', 'x')
    apagarRascunho('a')
    expect(lerRascunho('a', null, T0)).toBeNull()
    limparRascunhos()
    expect(lerRascunho('b', null, T0)).toBeNull()
    expect(store.getItem('outra-coisa')).toBe('x')
  })

  it('sem armazenamento disponível não quebra', () => {
    vi.stubGlobal('window', {
      get sessionStorage(): Storage {
        throw new Error('bloqueado')
      },
    })
    expect(() => gravarRascunho('x', null, 1)).not.toThrow()
    expect(lerRascunho('x', null)).toBeNull()
  })
})
