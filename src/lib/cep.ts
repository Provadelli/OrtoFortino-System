import { onlyDigits, UFS } from './br'

export type EnderecoCep = { logradouro: string; bairro: string; cidade: string; uf: string }

/** Erro de rede/serviço (diferente de "CEP não existe", que devolve null). */
export class CepIndisponivel extends Error {}

const texto = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

/**
 * Consulta o ViaCEP (serviço público e gratuito). Só o CEP sai do sistema.
 * Devolve null quando o CEP não existe; lança CepIndisponivel em falha de rede ou resposta estranha.
 */
export async function buscarCep(cep: string, signal?: AbortSignal): Promise<EnderecoCep | null> {
  const d = onlyDigits(cep)
  if (d.length !== 8) return null
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 6000)
  const cancelar = () => ctrl.abort()
  signal?.addEventListener('abort', cancelar, { once: true })
  let res: Response
  try {
    res = await fetch(`https://viacep.com.br/ws/${d}/json/`, { signal: ctrl.signal, credentials: 'omit', referrerPolicy: 'no-referrer' })
  } catch (e) {
    if (signal?.aborted) throw e
    throw new CepIndisponivel('sem resposta')
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', cancelar)
  }
  if (res.status === 400) return null
  if (!res.ok) throw new CepIndisponivel(`HTTP ${res.status}`)
  let corpo: unknown
  try {
    corpo = await res.json()
  } catch {
    throw new CepIndisponivel('resposta inválida')
  }
  if (typeof corpo !== 'object' || corpo === null) throw new CepIndisponivel('resposta inválida')
  const r = corpo as Record<string, unknown>
  if (r.erro === true || r.erro === 'true') return null
  const uf = texto(r.uf, 2).toUpperCase()
  return {
    logradouro: texto(r.logradouro, 160),
    bairro: texto(r.bairro, 80),
    cidade: texto(r.localidade, 120),
    uf: (UFS as readonly string[]).includes(uf) ? uf : '',
  }
}
