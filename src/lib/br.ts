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
