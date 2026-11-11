import { useEffect, useRef, useState } from 'react'
import type { FieldValues, UseFormReturn } from 'react-hook-form'

/**
 * Rascunho automático de formulários ("continuar de onde parou").
 *
 * Guarda no sessionStorage, e não no localStorage, de propósito (LGPD): os formulários têm CPF e
 * dados de saúde, e o sessionStorage some quando a aba é fechada. Também é apagado ao sair do sistema.
 */
const PREFIXO = 'of:rascunho:'
const VALIDADE_MS = 24 * 60 * 60 * 1000
const ESPERA_MS = 300

type Salvo<T> = { v: 1; base: string | null; salvoEm: number; valores: T }

function store(): Storage | null {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

/** Lê o rascunho; descarta se venceu ou se o registro mudou no servidor desde então (`base` = updated_at). */
export function lerRascunho<T>(chave: string, base: string | null, agora = Date.now()): Salvo<T> | null {
  const s = store()
  try {
    const bruto = s?.getItem(PREFIXO + chave)
    if (!bruto) return null
    const r = JSON.parse(bruto) as Salvo<T>
    if (r?.v !== 1 || agora - r.salvoEm > VALIDADE_MS || r.base !== base) {
      s?.removeItem(PREFIXO + chave)
      return null
    }
    return r
  } catch {
    return null
  }
}

export function gravarRascunho<T>(chave: string, base: string | null, valores: T, agora = Date.now()) {
  try {
    store()?.setItem(PREFIXO + chave, JSON.stringify({ v: 1, base, salvoEm: agora, valores } satisfies Salvo<T>))
  } catch {
    // Sem espaço ou armazenamento bloqueado: o formulário segue funcionando, só sem rascunho.
  }
}

export function apagarRascunho(chave: string) {
  try {
    store()?.removeItem(PREFIXO + chave)
  } catch {
    // idem
  }
}

/** Apaga todos os rascunhos (ao sair do sistema). */
export function limparRascunhos() {
  const s = store()
  if (!s) return
  try {
    for (const k of Object.keys(s)) if (k.startsWith(PREFIXO)) s.removeItem(k)
  } catch {
    // idem
  }
}

/**
 * Liga o rascunho a um formulário do react-hook-form.
 * - Ao abrir, restaura o que estava sendo preenchido (o formulário continua "alterado" em relação ao original).
 * - Enquanto digita, salva (com uma pequena espera) e também ao sair da tela.
 * - `concluir()` depois de salvar com sucesso; `descartar()` volta ao original.
 */
export function useRascunho<T extends FieldValues>(form: UseFormReturn<T>, chave: string, inicial: T, base: string | null = null) {
  const { reset, watch, getValues } = form
  const [restauradoEm, setRestauradoEm] = useState<number | null>(null)
  const encerrado = useRef(false)
  const pendente = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Valores fixos da montagem (o componente é recriado quando muda de registro).
  const fixo = useRef({ chave, base, inicial, inicialJson: JSON.stringify(inicial) })

  useEffect(() => {
    const { chave, base } = fixo.current
    const r = lerRascunho<T>(chave, base)
    if (!r) return
    reset(r.valores, { keepDefaultValues: true })
    setRestauradoEm(r.salvoEm)
  }, [reset])

  useEffect(() => {
    const { chave, base, inicialJson } = fixo.current
    const salvarAgora = () => {
      pendente.current = null
      if (encerrado.current) return
      const v = getValues()
      if (JSON.stringify(v) === inicialJson) apagarRascunho(chave)
      else gravarRascunho(chave, base, v)
    }
    const sub = watch(() => {
      if (pendente.current) clearTimeout(pendente.current)
      pendente.current = setTimeout(salvarAgora, ESPERA_MS)
    })
    return () => {
      sub.unsubscribe()
      // Saiu da tela antes da espera terminar: salva já.
      if (pendente.current) {
        clearTimeout(pendente.current)
        salvarAgora()
      }
    }
  }, [watch, getValues])

  return {
    restauradoEm,
    concluir() {
      encerrado.current = true
      if (pendente.current) clearTimeout(pendente.current)
      apagarRascunho(fixo.current.chave)
    },
    descartar() {
      apagarRascunho(fixo.current.chave)
      setRestauradoEm(null)
      reset(fixo.current.inicial)
    },
  }
}
