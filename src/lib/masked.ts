import type { ChangeEvent, FocusEvent } from 'react'
import type { UseFormRegisterReturn } from 'react-hook-form'
import { formatDecimalTyping, formatMoneyBlur } from './br'

/** Aplica máscara enquanto digita, mantendo o registro do react-hook-form. */
export function masked(reg: UseFormRegisterReturn, format: (v: string) => string): UseFormRegisterReturn {
  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    e.target.value = format(e.target.value)
    return reg.onChange(e)
  }
  return { ...reg, onChange: onChange as UseFormRegisterReturn['onChange'] }
}

/**
 * Reformata o campo sem jogar o cursor para o fim: conta quantos dígitos/vírgulas havia
 * antes do cursor e recoloca o cursor depois do mesmo número de dígitos/vírgulas.
 */
function reformatar(input: HTMLInputElement, format: (v: string) => string) {
  const antes = input.value
  const cursor = input.selectionStart ?? antes.length
  const relevantesAntes = antes.slice(0, cursor).replace(/[^\d,]/g, '').length
  const novo = format(antes)
  input.value = novo
  if (document.activeElement !== input) return
  if (cursor >= antes.length) {
    input.setSelectionRange(novo.length, novo.length)
    return
  }
  let pos = 0
  let vistos = 0
  while (pos < novo.length && vistos < relevantesAntes) {
    if (/[\d,]/.test(novo[pos]!)) vistos++
    pos++
  }
  input.setSelectionRange(pos, pos)
}

type DecimalOpts = { casas?: number; moeda?: boolean }

/**
 * Campo numérico no padrão brasileiro: milhar com ponto e vírgula decimal enquanto digita.
 * `moeda` completa os centavos ao sair do campo ("1.250" → "1.250,00").
 * O valor continua sendo texto que `parseBRL` entende — os schemas não mudam.
 */
export function decimal(reg: UseFormRegisterReturn, { casas = 2, moeda = false }: DecimalOpts = {}) {
  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    reformatar(e.target, (v) => formatDecimalTyping(v, casas))
    return reg.onChange(e)
  }
  const onBlur = (e: FocusEvent<HTMLInputElement>) => {
    if (moeda) {
      const formatado = formatMoneyBlur(e.target.value)
      if (formatado !== e.target.value) {
        e.target.value = formatado
        void reg.onChange({ target: e.target, type: 'change' })
      }
    }
    return reg.onBlur(e)
  }
  return {
    ...reg,
    onChange: onChange as UseFormRegisterReturn['onChange'],
    onBlur: onBlur as UseFormRegisterReturn['onBlur'],
    inputMode: 'decimal' as const,
    autoComplete: 'off',
    className: 'text-right tabular-nums',
  }
}

/** Atalho para dinheiro em reais. */
export const dinheiro = (reg: UseFormRegisterReturn) => decimal(reg, { moeda: true })
