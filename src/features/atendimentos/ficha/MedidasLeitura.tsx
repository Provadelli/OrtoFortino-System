import { Diagrama, nomePonto } from './Diagrama'
import { DIAGRAMAS, diagramaPara, medidasDoBanco, pontosAtivos } from './diagramas'

type Props = { tipo: string; produto: string | null; lateralidade: string | null; medidas: unknown }

/** Boneco com as medidas salvas (somente leitura) + a mesma lista em texto. */
export function MedidasLeitura({ tipo, produto, lateralidade, medidas }: Props) {
  const id = diagramaPara(tipo, produto ?? '')
  const d = DIAGRAMAS[id]
  const valores = medidasDoBanco(medidas)[id] ?? {}
  const pontos = pontosAtivos(d, tipo === 'protese' ? '' : (lateralidade ?? '')).filter((p) => (valores[p.id] ?? '').trim())
  if (!pontos.length) return null

  return (
    <section aria-labelledby="t-medidas" className="mt-6 grid items-start gap-5 border-t border-line-soft pt-5 md:grid-cols-[minmax(0,320px)_1fr]">
      <h3 id="t-medidas" className="sr-only">
        Medidas · {d.titulo}
      </h3>
      <div className="rounded-field bg-surface p-2">
        <Diagrama id={id} lateralidade={tipo === 'protese' ? '' : (lateralidade ?? '')} valores={valores} />
      </div>
      <div className="flex flex-col gap-3">
        <p className="m-0 text-[13px] font-semibold text-muted" aria-hidden="true">
          Medidas · {d.titulo}
        </p>
        <dl className="m-0 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
          {pontos.map((p) => (
            <div key={p.id} className="flex flex-col gap-0.5">
              <dt className="text-[13px] text-muted">{nomePonto(p)}</dt>
              <dd className="m-0 text-[15px] font-semibold tabular-nums">{valores[p.id]} cm</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
