import { cn } from '@/lib/cn'

export type Atalho = { rotulo: string; valor: string; descricao?: string }

/**
 * Botões de preenchimento rápido abaixo de um campo (ex.: "Hoje", "+15 dias").
 * O atalho correspondente ao valor atual fica marcado (aria-pressed).
 */
export function Atalhos({ itens, atual, onEscolher, rotulo }: { itens: Atalho[]; atual?: string; onEscolher: (valor: string) => void; rotulo: string }) {
  return (
    <div role="group" aria-label={rotulo} className="flex flex-wrap gap-1.5">
      {itens.map((a) => {
        const ativo = atual === a.valor
        return (
          <button
            key={a.rotulo}
            type="button"
            aria-pressed={ativo}
            aria-label={a.descricao}
            onClick={() => onEscolher(a.valor)}
            className={cn(
              'inline-flex min-h-11 cursor-pointer items-center rounded-full border px-3 text-[13px] font-semibold transition-colors',
              ativo ? 'border-primary bg-prod-bg text-prod-fg' : 'border-line bg-white text-primary-ink hover:bg-surface-hover',
            )}
          >
            {a.rotulo}
          </button>
        )
      })}
    </div>
  )
}
