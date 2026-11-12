import { useId, useState } from 'react'
import type { UseFormRegister } from 'react-hook-form'
import { Field } from '@/components/ui/Field'
import { decimal } from '@/lib/masked'
import type { AtendimentoForm } from '../schema'
import { Diagrama, nomePonto } from './Diagrama'
import { DIAGRAMAS, diagramaPara, pontosAtivos, progresso, type MedidasForm, type Ponto } from './diagramas'

type Props = {
  tipo: string
  produto: string
  lateralidade: string
  medidas: MedidasForm | undefined
  register: UseFormRegister<AtendimentoForm>
}

/**
 * Medidas pelo boneco: o desenho muda com o produto/tipo, esmaece o lado não usado e
 * se completa conforme as medidas são digitadas. Clicar num círculo leva ao campo dele.
 */
export function MedidasFicha({ tipo, produto, lateralidade, medidas, register }: Props) {
  const base = useId()
  const [foco, setFoco] = useState<string | null>(null)
  const id = diagramaPara(tipo, produto)
  const d = DIAGRAMAS[id]
  const ativos = pontosAtivos(d, lateralidade)
  const { preenchidos, total } = progresso(medidas, d, lateralidade)
  const valores = medidas?.[id] ?? {}
  const campoId = (p: Ponto) => `${base}-${id}-${p.id}`
  const grupos = [...new Set(ativos.map((p) => p.grupo))]

  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-4 rounded-field border border-line bg-surface/50 p-4 sm:p-5">
      <legend className="px-1 text-sm font-semibold text-ink">Medidas · {d.titulo}</legend>

      <div className="flex flex-wrap items-center gap-3" aria-live="polite">
        <div className="h-2 min-w-[120px] flex-1 overflow-hidden rounded-full bg-line" aria-hidden="true">
          <div
            className="h-full origin-left rounded-full bg-primary transition-transform duration-500 ease-[var(--ease-out-soft)]"
            style={{ transform: `scaleX(${total ? preenchidos / total : 0})` }}
          />
        </div>
        <span className="text-sm font-semibold text-ink-soft tabular-nums">
          {preenchidos} de {total} medidas
        </span>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="rounded-field bg-white p-2">
          <Diagrama
            key={id}
            id={id}
            lateralidade={lateralidade}
            valores={valores}
            foco={foco}
            onPonto={(p) => document.getElementById(campoId(p))?.focus()}
            className="animate-fade"
          />
          <p className="m-0 mt-1 text-center text-xs text-muted">Toque num círculo para preencher a medida (em cm).</p>
        </div>

        <div className="flex flex-col gap-4">
          {grupos.map((g) => (
            <div key={g} role="group" aria-labelledby={`${base}-${g}`} className="flex flex-col gap-2">
              <span id={`${base}-${g}`} className="text-xs font-semibold tracking-[0.06em] text-muted uppercase">
                {g}
              </span>
              <div className="grid grid-cols-2 gap-3">
                {ativos
                  .filter((p) => p.grupo === g)
                  .map((p) => (
                    <Field
                      key={p.id}
                      id={campoId(p)}
                      label={p.rotulo}
                      aria-label={nomePonto(p)}
                      suffix="cm"
                      placeholder="0,0"
                      maxLength={8}
                      onFocus={() => setFoco(p.id)}
                      {...decimal(register(`ficha.medidas.${id}.${p.id}`, { onBlur: () => setFoco(null) }), { casas: 1 })}
                    />
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </fieldset>
  )
}
