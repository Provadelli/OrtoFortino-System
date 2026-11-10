const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const longDate = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const shortDate = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' })

export const formatBRL = (value: number) => brl.format(value)

/** "Segunda-feira, 9 de novembro de 2026" */
export function formatLongDate(date: Date) {
  const s = longDate.format(date)
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** "09/11" */
export const formatDayMonth = (date: Date) => shortDate.format(date)

export function greeting(date: Date) {
  const h = date.getHours()
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

/** Mascara CPF para listagens (LGPD): ***.456.789-** */
export function maskCpf(cpf: string) {
  const d = cpf.replace(/\D/g, '')
  if (d.length !== 11) return '***.***.***-**'
  return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`
}

/** Iniciais para avatar: "Polyana S." → "PS" */
export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join('')
}

/** Nome curto para telas à vista de terceiros (LGPD): "Polyana Souza Lima" → "Polyana L." */
export function shortName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length < 2) return parts[0] ?? ''
  return `${parts[0]} ${parts[parts.length - 1]!.charAt(0).toUpperCase()}.`
}
