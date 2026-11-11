import type { ChangeEvent } from 'react'
import type { UseFormRegisterReturn } from 'react-hook-form'

/** Aplica máscara enquanto digita, mantendo o registro do react-hook-form. */
export function masked(reg: UseFormRegisterReturn, format: (v: string) => string): UseFormRegisterReturn {
  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    e.target.value = format(e.target.value)
    return reg.onChange(e)
  }
  return { ...reg, onChange: onChange as UseFormRegisterReturn['onChange'] }
}
