import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { DIAGRAMAS, pontosAtivos, type DiagramaId, type Lado, type Ponto } from './diagramas'

type Props = {
  id: DiagramaId
  lateralidade: string
  valores: Record<string, string>
  /** Ponto destacado (campo focado). */
  foco?: string | null
  /** Sem ele, o boneco é só visual (detalhe do atendimento). */
  onPonto?: (p: Ponto) => void
  className?: string
}

const ladoNome: Record<Lado, string> = { d: 'perna direita', e: 'perna esquerda' }

/** Rótulo completo de um ponto, para leitor de tela e listas. */
export const nomePonto = (p: Ponto) => (p.lado ? `${p.rotulo}, ${ladoNome[p.lado]}` : p.rotulo)

/**
 * Boneco da ficha: desenho em traço fino + círculos de medida ligados ao corpo.
 * Medida preenchida = círculo cheio com o valor e a linha "desenhada" até o corpo.
 */
export function Diagrama({ id, lateralidade, valores, foco, onPonto, className }: Props) {
  const d = DIAGRAMAS[id]
  const ativos = pontosAtivos(d, lateralidade)
  const ladoInativo: Lado | null = id === 'pernas' ? (lateralidade === 'unilateral_d' ? 'e' : lateralidade === 'unilateral_e' ? 'd' : null) : null

  return (
    <div className={cn('relative mx-auto w-full max-w-[420px] select-none', className)} style={{ aspectRatio: `${d.largura} / ${d.altura}` }}>
      <svg viewBox={`0 0 ${d.largura} ${d.altura}`} className="absolute inset-0 size-full" aria-hidden="true" focusable="false">
        <g fill="#fff" stroke="#9fb3aa" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          {DESENHOS[id](ladoInativo)}
        </g>
        {ativos.map((p) => {
          const cheio = !!(valores[p.id] ?? '').trim()
          if (Math.hypot(p.x - p.ax, p.y - p.ay) < 4) return null
          return (
            <g key={p.id}>
              <line x1={p.ax} y1={p.ay} x2={p.x} y2={p.y} stroke="#c9d8d1" strokeWidth={1.5} strokeDasharray="3 4" />
              <line
                x1={p.ax}
                y1={p.ay}
                x2={p.x}
                y2={p.y}
                stroke="var(--color-primary)"
                strokeWidth={2}
                pathLength={1}
                strokeDasharray="1"
                strokeDashoffset={cheio ? 0 : 1}
                className="transition-[stroke-dashoffset] duration-500 ease-[var(--ease-out-soft)]"
              />
              <circle cx={p.ax} cy={p.ay} r={3} fill={cheio ? 'var(--color-primary)' : '#c9d8d1'} className="transition-[fill] duration-300" />
            </g>
          )
        })}
      </svg>

      {ativos.map((p) => {
        const valor = (valores[p.id] ?? '').trim()
        const cheio = !!valor
        const classe = cn(
          'absolute flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 text-[11px] leading-none font-bold tabular-nums transition-[background-color,border-color,color,box-shadow,transform] duration-200',
          cheio ? 'border-primary bg-primary text-white' : 'border-dashed border-field-hover bg-white text-ink-soft',
          foco === p.id && 'scale-110 shadow-[0_0_0_4px_rgb(31_122_92/0.22)]',
        )
        const conteudo = cheio ? (valor.length > 4 ? valor.slice(0, 4) : valor) : p.curto
        const pos = { left: `${(p.x / d.largura) * 100}%`, top: `${(p.y / d.altura) * 100}%` }
        return onPonto ? (
          <button
            key={p.id}
            type="button"
            onClick={() => onPonto(p)}
            aria-label={`${nomePonto(p)}: ${cheio ? `${valor} cm` : 'vazio'}`}
            className={cn(classe, 'cursor-pointer hover:scale-110 hover:border-primary')}
            style={pos}
          >
            <span key={cheio ? 'v' : 'c'} className={cheio ? 'animate-pop' : undefined}>
              {conteudo}
            </span>
          </button>
        ) : (
          <span key={p.id} aria-hidden="true" className={classe} style={pos}>
            {conteudo}
          </span>
        )
      })}
    </div>
  )
}

/* ───── Desenhos (traço simples, a partir da ficha em papel) ───── */

const apagado = (ativo: boolean) => ({ opacity: ativo ? 1 : 0.25, style: { transition: 'opacity 300ms' } })

/** Uma órtese AFO vista de frente: calha da perna, duas tiras e a base do pé. */
function Afo({ cx, ativo, nome }: { cx: number; ativo: boolean; nome: string }) {
  return (
    <g {...apagado(ativo)}>
      <text x={cx} y={14} textAnchor="middle" fontSize={12} fontWeight={700} fill="#55636a" stroke="none">
        {nome}
      </text>
      <rect x={cx - 25} y={24} width={50} height={196} rx={22} />
      <path d={`M${cx - 18} 34 Q${cx} 28 ${cx + 18} 34`} fill="none" stroke="#c9d8d1" />
      <rect x={cx - 31} y={50} width={62} height={15} rx={7.5} fill="#e7f3ee" />
      <rect x={cx - 31} y={164} width={62} height={15} rx={7.5} fill="#e7f3ee" />
      <path d={`M${cx - 22} 214 q-2 18 -16 26 q-6 6 0 12 h76 q6 -6 0 -12 q-14 -8 -16 -26`} />
      <path d={`M${cx - 30} 258 h60`} stroke="#c9d8d1" />
    </g>
  )
}

function Seta({ x, y1, y2 }: { x: number; y1: number; y2: number }) {
  return (
    <g stroke="#c9d8d1" fill="none" strokeWidth={1.5}>
      <path d={`M${x} ${y1} V${y2}`} />
      <path d={`M${x - 5} ${y1 + 7} L${x} ${y1} L${x + 5} ${y1 + 7} M${x - 5} ${y2 - 7} L${x} ${y2} L${x + 5} ${y2 - 7}`} />
    </g>
  )
}

const DESENHOS: Record<DiagramaId, (ladoInativo: Lado | null) => ReactNode> = {
  pernas: (inativo) => (
    <>
      <Afo cx={120} ativo={inativo !== 'd'} nome="Direita" />
      <Afo cx={240} ativo={inativo !== 'e'} nome="Esquerda" />
      <Seta x={180} y1={26} y2={220} />
    </>
  ),
  colete: () => (
    <>
      <path d="M104 28 C140 18 180 18 216 28 C226 70 210 110 214 150 C218 190 230 222 222 272 C186 284 134 284 98 272 C90 222 102 190 106 150 C110 110 94 70 104 28 Z" />
      {[48, 92, 132, 170, 208, 250].map((y) => (
        <path key={y} d={`M${y < 120 ? 104 : 100} ${y} Q160 ${y + 8} ${y < 120 ? 214 : 220} ${y}`} fill="none" stroke="#c9d8d1" />
      ))}
      <path d="M150 64 h20 M146 236 h28" stroke="#9fb3aa" strokeWidth={3} />
      <Seta x={58} y1={26} y2={274} />
    </>
  ),
  extensores: () => (
    <>
      {/* Frente */}
      <circle cx={120} cy={34} r={15} />
      <rect x={100} y={54} width={40} height={92} rx={16} />
      <path d="M100 66 L80 140 M140 66 L160 140" strokeWidth={11} stroke="#dfe9e4" />
      <path d="M111 146 L108 288 M131 146 L136 288" strokeWidth={15} stroke="#dfe9e4" />
      <path d="M131 166 L135 284" strokeWidth={15} stroke="#bfe6d2" />
      <path d="M102 176 C96 200 96 260 102 282" fill="none" stroke="#c9d8d1" strokeWidth={1.5} />
      {/* Lateral */}
      <circle cx={288} cy={34} r={15} />
      <rect x={276} y={54} width={26} height={92} rx={12} />
      <path d="M290 146 L292 288" strokeWidth={15} stroke="#dfe9e4" />
      <path d="M290 156 L291 212" strokeWidth={15} stroke="#bfe6d2" />
      <path d="M288 66 L294 138" strokeWidth={10} stroke="#dfe9e4" />
      <text x={120} y={306} textAnchor="middle" fontSize={11} fontWeight={700} fill="#55636a" stroke="none">
        Frente
      </text>
      <text x={290} y={306} textAnchor="middle" fontSize={11} fontWeight={700} fill="#55636a" stroke="none">
        Lateral
      </text>
    </>
  ),
  encaixe: () => (
    <>
      <path d="M80 52 C80 160 108 256 150 282 C192 256 220 160 220 52" />
      <ellipse cx={150} cy={52} rx={70} ry={18} fill="#e7f3ee" />
      {[78, 136, 188, 236].map((y, i) => (
        <path key={y} d={`M${86 + i * 14} ${y} Q150 ${y + 10} ${214 - i * 14} ${y}`} fill="none" stroke="#c9d8d1" />
      ))}
      <Seta x={56} y1={36} y2={282} />
    </>
  ),
}
