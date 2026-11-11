/** Utilidades brasileiras: CPF, telefone, idade. */

export const onlyDigits = (v: string) => v.replace(/\D/g, '')

export function isValidCpf(value: string) {
  const c = onlyDigits(value)
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false
  const dv = (n: number) => {
    let s = 0
    for (let i = 0; i < n; i++) s += Number(c[i]) * (n + 1 - i)
    const r = (s * 10) % 11
    return r === 10 ? 0 : r
  }
  return dv(9) === Number(c[9]) && dv(10) === Number(c[10])
}

/** "52998224725" → "529.982.247-25" (formata enquanto digita) */
export function formatCpf(value: string) {
  const d = onlyDigits(value).slice(0, 11)
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2')
}

export function isValidCnpj(value: string) {
  const c = onlyDigits(value)
  if (c.length !== 14 || /^(\d)\1{13}$/.test(c)) return false
  const dv = (n: number) => {
    let s = 0
    let peso = n - 7
    for (let i = 0; i < n; i++) {
      s += Number(c[i]) * peso--
      if (peso < 2) peso = 9
    }
    const r = s % 11
    return r < 2 ? 0 : 11 - r
  }
  return dv(12) === Number(c[12]) && dv(13) === Number(c[13])
}

/** "34130423000148" → "34.130.423/0001-48" (formata enquanto digita) */
export function formatCnpj(value: string) {
  return onlyDigits(value)
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
}

/** "26020560" → "26.020-560" (formato usado nos documentos da empresa) */
export function formatCep(value: string) {
  return onlyDigits(value)
    .slice(0, 8)
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2-$3')
}

/** "21964973837" → "(21) 96497-3837"; fixo "2133334444" → "(21) 3333-4444" */
export function formatPhone(value: string) {
  const d = onlyDigits(value).slice(0, 11)
  if (d.length <= 2) return d.length ? `(${d}` : ''
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

/** Idade em anos completos a partir de "AAAA-MM-DD". */
export function ageFrom(isoDate: string | null | undefined, today = new Date()) {
  if (!isoDate) return null
  const [y, m, d] = isoDate.split('-').map(Number)
  if (!y || !m || !d) return null
  let age = today.getFullYear() - y
  const beforeBirthday = today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)
  if (beforeBirthday) age--
  return age >= 0 ? age : null
}

export function formatAge(age: number | null) {
  if (age === null) return '—'
  return age === 1 ? '1 ano' : `${age} anos`
}

/** "2018-05-10" → "10/05/2018" */
export function formatIsoDate(iso: string | null | undefined) {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

export const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const

/** "1.234,56" | "1.250" | "1234.56" | "R$ 50" → número (NaN se inválido; "" → 0) */
export function parseBRL(value: string) {
  const s = value.replace(/[R$\s]/g, '')
  if (s === '') return 0
  // vírgula = decimal; sem vírgula, "1.250" / "12.000.000" = milhar (padrão brasileiro)
  const normalized = s.includes(',') || /^\d{1,3}(\.\d{3})+$/.test(s) ? s.replace(/\./g, '').replace(',', '.') : s
  return /^\d+(\.\d{1,2})?$/.test(normalized) ? Number(normalized) : Number.NaN
}

/** 1234.5 → "1.234,50" (para preencher campos de valor) */
export const formatMoneyInput = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Data local de hoje em "AAAA-MM-DD" (sem o desvio de fuso do toISOString). */
export function todayIso(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Normaliza texto para busca: minúsculas e sem acento (igual ao nome_busca do banco). */
export const normalizeSearch = (v: string) => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
