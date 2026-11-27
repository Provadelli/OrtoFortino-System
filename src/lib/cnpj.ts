import { onlyDigits, UFS } from './br'

export type EmpresaCnpj = {
  /** Razão social (nome oficial). */
  razaoSocial: string
  nomeFantasia: string
  cep: string
  /** "Rua X, 10, sala 2 - Centro" (mesmo formato do campo Endereço do cadastro). */
  endereco: string
  cidade: string
  uf: string
  telefone: string
}

/** Erro de rede/serviço (diferente de "CNPJ não existe", que devolve null). */
export class CnpjIndisponivel extends Error {}

const texto = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const MINUSCULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e'])

/** "RUA DOS OLIVEIRAS" → "Rua dos Oliveiras" (a Receita devolve tudo em maiúsculas). */
export function capitalizar(s: string) {
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w, i) => (i > 0 && MINUSCULAS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ')
}

/**
 * Consulta a BrasilAPI (serviço público e gratuito, dados da Receita Federal). Só o CNPJ sai do sistema.
 * Devolve null quando o CNPJ não existe (404/400); lança CnpjIndisponivel em falha de rede ou resposta estranha.
 */
export async function buscarCnpj(cnpj: string, signal?: AbortSignal): Promise<EmpresaCnpj | null> {
  const d = onlyDigits(cnpj)
  if (d.length !== 14) return null
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 8000)
  const cancelar = () => ctrl.abort()
  signal?.addEventListener('abort', cancelar, { once: true })
  let res: Response
  try {
    res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${d}`, { signal: ctrl.signal, credentials: 'omit', referrerPolicy: 'no-referrer' })
  } catch (e) {
    if (signal?.aborted) throw e
    throw new CnpjIndisponivel('sem resposta')
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', cancelar)
  }
  if (res.status === 404 || res.status === 400) return null
  if (!res.ok) throw new CnpjIndisponivel(`HTTP ${res.status}`)
  let corpo: unknown
  try {
    corpo = await res.json()
  } catch {
    throw new CnpjIndisponivel('resposta inválida')
  }
  if (typeof corpo !== 'object' || corpo === null) throw new CnpjIndisponivel('resposta inválida')
  const r = corpo as Record<string, unknown>
  const razaoSocial = texto(r.razao_social, 160)
  if (!razaoSocial) throw new CnpjIndisponivel('resposta inválida')

  const rua = capitalizar([texto(r.descricao_tipo_de_logradouro, 30), texto(r.logradouro, 160)].filter(Boolean).join(' '))
  const numero = texto(r.numero, 20)
  const complemento = capitalizar(texto(r.complemento, 80))
  const bairro = capitalizar(texto(r.bairro, 80))
  const ruaNumero = [rua, numero && numero.toUpperCase() !== 'S/N' ? numero : '', complemento].filter(Boolean).join(', ')
  const uf = texto(r.uf, 2).toUpperCase()
  const cep = onlyDigits(texto(r.cep, 12))
  return {
    razaoSocial,
    nomeFantasia: texto(r.nome_fantasia, 160),
    cep: cep.length === 8 ? cep : '',
    endereco: [ruaNumero, bairro].filter(Boolean).join(' - ').slice(0, 240),
    cidade: capitalizar(texto(r.municipio, 120)),
    uf: (UFS as readonly string[]).includes(uf) ? uf : '',
    telefone: onlyDigits(texto(r.ddd_telefone_1, 20)),
  }
}
