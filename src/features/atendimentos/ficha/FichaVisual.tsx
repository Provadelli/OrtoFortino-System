import { useWatch, type Control } from 'react-hook-form'
import { cn } from '@/lib/cn'
import { Rabisco } from '@/components/ui/Rabisco'
import type { AtendimentoForm } from '../schema'

/** Campos da ficha que mudam o desenho (form ou banco). */
export type FichaDesenho = {
  tipo?: string | null
  produto?: string | null
  lateralidade?: string | null
  especificacoes?: string[] | null
  compensacao_lado?: string | null
  compensacao_medida?: string | null
  nome_na_ortese?: boolean | null
  tema?: string | null
  cor_forro?: string | null
  cor_tira?: string | null
  protese_membro?: string | null
  protese_nivel?: string | null
  protese_lado?: string | null
  liner?: string | null
}

export type Modelo = 'afo' | 'smo' | 'kafo' | 'hkafo' | 'extensor' | 'colete' | 'palmilha' | 'protese'

const sem = (s: string | null | undefined) =>
  (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()

export function modeloDe(tipo?: string | null, produto?: string | null): Modelo {
  const p = sem(produto)
  if (tipo === 'protese') return 'protese'
  if (tipo === 'palmilha' || p.includes('palmilha')) return 'palmilha'
  if (p.includes('colete')) return 'colete'
  if (p.includes('extensor')) return 'extensor'
  if (/h-?kafo/.test(p)) return 'hkafo'
  if (p.includes('kafo')) return 'kafo'
  if (p.includes('smo')) return 'smo'
  return 'afo'
}

// Nome de cor escrito pela equipe → cor do desenho (o mais específico primeiro).
const CORES: [string, string][] = [
  ['azul marinho', '#1f3b73'],
  ['azul claro', '#8cc8f2'],
  ['azul bebe', '#a9d6f5'],
  ['verde agua', '#8fe0cf'],
  ['verde claro', '#a8e6b8'],
  ['rosa claro', '#ffc2d6'],
  ['rosa choque', '#ff2a8a'],
  ['lilas', '#c4a8f7'],
  ['roxo', '#8a5cd6'],
  ['violeta', '#8a5cd6'],
  ['azul', '#3f86d9'],
  ['verde', '#3fbf74'],
  ['rosa', '#ff7fb0'],
  ['vermelh', '#e5383b'],
  ['amarel', '#ffd23f'],
  ['laranja', '#ff9a3c'],
  ['preto', '#2b2f33'],
  ['branco', '#ffffff'],
  ['cinza', '#a9b4b0'],
  ['bege', '#e8d5b5'],
  ['marrom', '#8b5e3c'],
  ['dourado', '#d4af37'],
  ['prata', '#c9ced3'],
  ['colorid', 'url(#arco-iris)'],
  ['arco', 'url(#arco-iris)'],
]
export function corDe(nome: string | null | undefined, padrao: string) {
  const n = sem(nome)
  if (!n) return padrao
  return CORES.find(([k]) => n.includes(k))?.[1] ?? padrao
}

const PLASTICO = '#fbfdfc'
const TRACO = '#7f958b'
const PELE = '#e7ecea'

/** Desenho reativo da órtese/prótese. Decorativo: o resumo vai no aria-label. */
export function FichaVisual({ f, className }: { f: FichaDesenho; className?: string }) {
  const modelo = modeloDe(f.tipo, f.produto)
  const forro = corDe(f.cor_forro, '#cdeedd')
  const tira = corDe(f.cor_tira, '#3d7a64')
  const specs = new Set(f.especificacoes ?? [])
  const lat = f.lateralidade || 'bilateral'
  const lados: ('D' | 'E')[] = modelo === 'protese' ? [f.protese_lado === 'E' ? 'E' : 'D'] : modelo === 'colete' ? [] : ['D', 'E']
  const ativo = (l: 'D' | 'E') => modelo === 'protese' || lat === 'bilateral' || (lat === 'unilateral_d' ? l === 'D' : l === 'E')
  const comp = f.compensacao_lado === 'D' || f.compensacao_lado === 'E' ? f.compensacao_lado : null
  const compAlt = Math.min(16, Math.max(6, (parseFloat((f.compensacao_medida ?? '').replace(',', '.')) || 1) * 5))
  const titulo =
    modelo === 'protese'
      ? `Prótese${f.protese_nivel ? (f.protese_nivel === 'transfemoral' ? ' transfemoral' : ' transtibial') : ''}`
      : modelo === 'palmilha'
        ? sem(f.produto).includes('palmilha')
          ? f.produto!.trim()
          : 'Palmilha'
        : f.produto?.trim() || 'Órtese'
  // AFO e SMO: aproxima nas pernas (só a parte de baixo interessa).
  const viewBox = modelo === 'colete' ? '0 0 240 300' : modelo === 'afo' || modelo === 'smo' ? '0 118 260 194' : '0 0 260 310'

  const resumo = [
    titulo,
    modelo !== 'protese' && modelo !== 'colete' && (lat === 'bilateral' ? 'bilateral' : lat === 'unilateral_d' ? 'lado direito' : 'lado esquerdo'),
    f.cor_forro && `forro ${f.cor_forro}`,
    f.cor_tira && `tira ${f.cor_tira}`,
    comp && `compensação ${comp}`,
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <figure className={cn('relative m-0 flex flex-col items-center gap-2 overflow-hidden rounded-card border border-line bg-white px-4 pt-4 pb-3', className)}>
      <Rabisco forma="estrela" className="absolute top-3 right-3 size-5 rotate-12 bg-giz-amarelo" />
      <figcaption className="self-start pr-6 font-display text-[15px] leading-tight font-semibold text-ink">
        <span key={titulo} className="inline-block animate-fade">
          {titulo}
        </span>
      </figcaption>
      <svg
        viewBox={viewBox}
        role="img"
        aria-label={`Prévia: ${resumo}`}
        className="h-[230px] w-full max-w-[260px] sm:h-[300px] [&_*]:transition-[fill,stroke,opacity] [&_*]:duration-300"
      >
        <defs>
          <linearGradient id="arco-iris" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#ff2a6d" />
            <stop offset="0.33" stopColor="#f5b82e" />
            <stop offset="0.66" stopColor="#35d97a" />
            <stop offset="1" stopColor="#a78bfa" />
          </linearGradient>
        </defs>
        {/* chão */}
        <path d="M10 297 Q 130 293 250 297" stroke="#dfe7e3" strokeWidth="3" fill="none" strokeLinecap="round" />
        {modelo === 'colete' ? (
          <Colete forro={forro} tira={tira} specs={specs} nome={!!f.nome_na_ortese} tema={!!f.tema?.trim()} />
        ) : (
          lados.map((l) => {
            // D à esquerda olhando para fora; E à direita. Prótese fica no centro.
            const x = modelo === 'protese' ? 70 : l === 'D' ? 4 : 136
            const espelho = modelo === 'protese' ? l === 'D' : l === 'D'
            return (
              <g key={l} transform={`translate(${x} 0)`} opacity={ativo(l) ? 1 : 0.28} className={cn(!ativo(l) && 'grayscale')}>
                <g transform={espelho ? 'translate(120 0) scale(-1 1)' : undefined}>
                  {modelo === 'protese' ? (
                    <Protese nivel={f.protese_nivel} superior={f.protese_membro === 'superior'} liner={f.liner?.trim() ? corDe(f.liner, '#c4a8f7') : null} />
                  ) : modelo === 'palmilha' ? (
                    <Palmilha forro={forro} specs={specs} comp={ativo(l) && comp === l ? compAlt : 0} />
                  ) : (
                    <Perna
                      modelo={modelo}
                      articulada={/articulad/.test(sem(f.produto))}
                      ativo={ativo(l)}
                      forro={forro}
                      tira={tira}
                      specs={specs}
                      comp={ativo(l) && comp === l ? compAlt : 0}
                      nome={!!f.nome_na_ortese}
                      tema={!!f.tema?.trim()}
                    />
                  )}
                </g>
                <text x="60" y="309" textAnchor="middle" fontSize="11" fontWeight="700" fill={ativo(l) ? '#3b4a50' : '#9aa7a1'} fontFamily="Inter, sans-serif">
                  {l === 'D' ? 'Direita' : 'Esquerda'}
                </text>
              </g>
            )
          })
        )}
      </svg>
      {modelo !== 'protese' && (f.cor_forro || f.cor_tira || f.tema) && (
        <div aria-hidden="true" className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs text-muted">
          {f.cor_forro && <Amostra cor={forro} rotulo={`Forro ${f.cor_forro}`} />}
          {f.cor_tira && <Amostra cor={tira} rotulo={`Tira ${f.cor_tira}`} />}
          {f.tema && <span>Tema: {f.tema}</span>}
        </div>
      )}
    </figure>
  )
}

function Amostra({ cor, rotulo }: { cor: string; rotulo: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="size-3 rounded-full border border-black/10"
        style={{ background: cor.startsWith('url') ? 'linear-gradient(#ff2a6d,#f5b82e,#35d97a,#a78bfa)' : cor }}
      />
      {rotulo}
    </span>
  )
}

/** Versão ligada ao formulário: redesenha a cada campo preenchido. */
export function FichaVisualAoVivo({ control, className }: { control: Control<AtendimentoForm>; className?: string }) {
  const f = useWatch({ control, name: 'ficha' })
  return <FichaVisual f={f ?? {}} className={className} />
}

/* ───────────── Peças (coordenadas locais 0–120 × 0–300; pé apontando para a direita) ───────────── */

const SILHUETA =
  'M42 0 L82 0 C 84 60 80 110 74 140 C 72 180 68 222 66 246 C 74 258 92 262 106 268 Q 114 273 108 282 L 24 282 Q 14 279 19 262 C 24 248 29 238 29 218 C 26 192 25 168 33 140 C 31 104 35 52 42 0 Z'

function Perna({
  modelo,
  articulada,
  ativo,
  forro,
  tira,
  specs,
  comp,
  nome,
  tema,
}: {
  modelo: Modelo
  articulada: boolean
  ativo: boolean
  forro: string
  tira: string
  specs: Set<string>
  comp: number
  nome: boolean
  tema: boolean
}) {
  const sobe = comp ? -comp : 0
  const topo = modelo === 'smo' ? 222 : modelo === 'extensor' ? 40 : 166
  return (
    <g transform={`translate(0 ${sobe})`}>
      <path d={SILHUETA} fill={PELE} stroke={ativo ? '#d3dcd8' : '#c7d1cc'} strokeWidth="1.5" strokeDasharray={ativo ? undefined : '4 4'} />
      {ativo && modelo === 'extensor' && <Extensor forro={forro} tira={tira} />}
      {ativo && modelo !== 'extensor' && (
        <>
          {modelo === 'hkafo' && (
            <g className="animate-pop" style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
              <rect x="22" y="-2" width="80" height="16" rx="8" fill={PLASTICO} stroke={TRACO} strokeWidth="2" />
              <rect x="26" y="2" width="72" height="8" rx="4" fill={forro} />
              <line x1="56" y1="14" x2="56" y2="44" stroke={TRACO} strokeWidth="5" strokeLinecap="round" />
              <circle cx="56" cy="22" r="6" fill="#fff" stroke={TRACO} strokeWidth="2" />
            </g>
          )}
          {(modelo === 'kafo' || modelo === 'hkafo') && (
            <g className="animate-pop" style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
              <line x1="56" y1="100" x2="56" y2="176" stroke={TRACO} strokeWidth="5" strokeLinecap="round" />
              <path d="M34 44 L80 44 C 79 70 77 92 75 112 L 36 112 C 34 90 33 66 34 44 Z" fill={PLASTICO} stroke={TRACO} strokeWidth="2" />
              <path d="M38 50 L 50 50 C 49 72 49 92 48 106 L 40 106 C 38 88 37 68 38 50 Z" fill={forro} />
              <rect x="31" y="68" width="52" height="10" rx="3" fill={tira} />
              <circle cx="56" cy="140" r="7.5" fill="#fff" stroke={TRACO} strokeWidth="2.5" />
              <circle cx="56" cy="140" r="2" fill={TRACO} />
            </g>
          )}
          {/* casca posterior + palmilha da órtese */}
          <clipPath id={`corte-${topo}`}>
            <rect x="0" y={topo} width="130" height="140" />
          </clipPath>
          <g clipPath={`url(#corte-${topo})`}>
            <path
              d="M26 150 L52 150 C 48 188 48 214 52 238 C 55 252 62 258 76 262 L 106 268 Q 113 272 109 281 L 24 283 Q 14 280 17 264 C 21 249 25 236 25 214 C 23 192 23 170 26 150 Z"
              fill={PLASTICO}
              stroke={TRACO}
              strokeWidth="2"
            />
            <path
              d="M31 150 L 45 150 C 42 190 42 216 46 240 C 49 254 58 262 72 266 L 102 272 L 29 276 Q 22 274 23 265 C 27 250 30 236 30 214 C 28 194 28 172 31 150 Z"
              fill={forro}
            />
            {tema && (
              <g fill="#fff" opacity="0.85">
                <circle cx="36" cy="200" r="2.4" />
                <circle cx="40" cy="226" r="2" />
                <path d="M34 248 l2 4 4 .5 -3 3 .8 4 -3.8-2 -3.8 2 .8-4 -3-3 4-.5z" />
              </g>
            )}
          </g>
          {/* linha de corte superior */}
          <line x1="22" y1={topo + 1} x2={modelo === 'smo' ? 60 : 54} y2={topo + 1} stroke={TRACO} strokeWidth="2" strokeLinecap="round" />
          {/* tiras: perna e antepé */}
          <rect x="22" y={topo + 10} width={modelo === 'smo' ? 50 : 52} height="10" rx="3" fill={tira} />
          <path d="M70 257 L 94 266" stroke={tira} strokeWidth="9" strokeLinecap="round" />
          {specs.has('Tira de travamento') && <path className="animate-fade" d="M28 236 L 76 256" stroke={tira} strokeWidth="8" strokeLinecap="round" />}
          {(specs.has('Tira valgo') || specs.has('Tira varo')) && (
            <path className="animate-fade" d="M40 246 Q 58 232 70 248" stroke={tira} strokeWidth="6" strokeLinecap="round" fill="none" strokeDasharray="0" />
          )}
          {specs.has('Tira de tração') && (
            <g className="animate-fade">
              <path d="M94 268 L 116 261" stroke={tira} strokeWidth="6" strokeLinecap="round" />
              <path d="M110 256 L 118 260 L 112 267" stroke={TRACO} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </g>
          )}
          {specs.has('Orifícios de ventilação') && modelo !== 'smo' && (
            <g className="animate-fade" fill="#fff" stroke={TRACO} strokeWidth="1.2">
              <circle cx="35" cy="188" r="2.6" />
              <circle cx="35" cy="200" r="2.6" />
              <circle cx="35" cy="212" r="2.6" />
            </g>
          )}
          {specs.has('Elevar arco plantar') && <path className="animate-fade" d="M54 272 Q 70 262 88 272" stroke="#f5b82e" strokeWidth="4" fill="none" strokeLinecap="round" />}
          {specs.has('90°') && (
            <g className="animate-fade" stroke="#5636c0" strokeWidth="1.6" fill="none">
              <path d="M88 236 L 88 250 L 102 250" />
              <path d="M88 245 L 93 245 L 93 250" />
            </g>
          )}
          {articulada && (
            <g className="animate-pop" style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
              <circle cx="50" cy="246" r="7" fill="#fff" stroke={TRACO} strokeWidth="2.5" />
              <circle cx="50" cy="246" r="2" fill={TRACO} />
            </g>
          )}
          {nome && modelo !== 'smo' && (
            <g className="animate-pop" style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
              <rect x="27" y="196" width="16" height="30" rx="3" fill="#fff" stroke={tira} strokeWidth="1.6" />
              <line x1="31" y1="203" x2="31" y2="219" stroke={tira} strokeWidth="1.6" strokeLinecap="round" />
              <line x1="35.5" y1="203" x2="35.5" y2="214" stroke={tira} strokeWidth="1.6" strokeLinecap="round" />
              <line x1="40" y1="203" x2="40" y2="217" stroke={tira} strokeWidth="1.6" strokeLinecap="round" />
            </g>
          )}
        </>
      )}
      {comp > 0 && (
        <g className="animate-pop" style={{ transformBox: 'fill-box', transformOrigin: 'bottom' }}>
          <rect x="18" y="283" width="94" height={comp} rx="3" fill="#ffd9a8" stroke="#e08a2e" strokeWidth="1.5" />
          <text x="65" y={283 + comp / 2 + 3.5} textAnchor="middle" fontSize="9" fontWeight="700" fill="#934600" fontFamily="Inter, sans-serif">
            compensação
          </text>
        </g>
      )}
    </g>
  )
}

function Extensor({ forro, tira }: { forro: string; tira: string }) {
  return (
    <g className="animate-pop" style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
      <path d="M24 40 L 46 40 C 44 110 42 180 40 250 L 20 250 C 22 180 24 110 24 40 Z" fill={PLASTICO} stroke={TRACO} strokeWidth="2" />
      <path d="M28 46 L 40 46 C 38 112 37 178 35 244 L 25 244 C 26 178 27 112 28 46 Z" fill={forro} />
      {[62, 112, 168, 222].map((y) => (
        <rect key={y} x="18" y={y} width={y < 140 ? 66 : 54} height="10" rx="3" fill={tira} />
      ))}
      <circle cx="70" cy="140" r="10" fill={forro} stroke={TRACO} strokeWidth="2" />
    </g>
  )
}

function Palmilha({ forro, specs, comp }: { forro: string; specs: Set<string>; comp: number }) {
  // Vista de cima, pé direito (o esquerdo é espelhado).
  return (
    <g className="animate-pop" style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
      <path
        d="M58 36 C 90 34 102 74 100 122 C 98 160 88 178 88 208 C 88 246 94 274 64 284 C 38 292 28 264 30 232 C 32 202 24 172 24 136 C 22 78 30 38 58 36 Z"
        fill={forro}
        stroke={TRACO}
        strokeWidth="2"
      />
      <path d="M58 48 C 82 47 90 80 89 122 C 88 156 78 176 78 208 C 78 240 82 262 63 270 C 46 276 40 258 41 232 C 42 204 35 174 35 138 C 34 88 40 50 58 48 Z" fill="#fff" opacity="0.35" />
      {specs.has('Elevar arco plantar') && <path className="animate-fade" d="M30 150 C 24 180 26 205 32 222" stroke="#f5b82e" strokeWidth="7" fill="none" strokeLinecap="round" />}
      {specs.has('Pés pronados') && <path className="animate-fade" d="M28 120 C 22 170 24 220 32 250" stroke="#a78bfa" strokeWidth="5" fill="none" strokeLinecap="round" />}
      {specs.has('Pés supinados') && <path className="animate-fade" d="M98 120 C 94 170 88 220 86 250" stroke="#a78bfa" strokeWidth="5" fill="none" strokeLinecap="round" />}
      {specs.has('Orifícios de ventilação') && (
        <g className="animate-fade" fill="#fff" stroke={TRACO} strokeWidth="1">
          {[80, 100, 120].flatMap((y) => [50, 66, 82].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="2.4" />))}
        </g>
      )}
      {comp > 0 && <ellipse className="animate-pop" cx="62" cy="258" rx="22" ry={8 + comp / 2} fill="#ffd9a8" stroke="#e08a2e" strokeWidth="1.5" />}
    </g>
  )
}

function Colete({ forro, tira, specs, nome, tema }: { forro: string; tira: string; specs: Set<string>; nome: boolean; tema: boolean }) {
  return (
    <g className="animate-pop" style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
      <path d="M72 6 Q 120 -4 168 6 L 178 30 Q 120 22 62 30 Z" fill={PELE} />
      <path d="M66 30 Q 120 18 174 30 L 182 120 Q 174 170 182 226 L 178 276 Q 120 290 62 276 L 58 226 Q 66 170 58 120 Z" fill={PLASTICO} stroke={TRACO} strokeWidth="2.5" />
      <path d="M76 42 Q 120 32 164 42 L 170 122 Q 163 170 170 222 L 166 264 Q 120 276 74 264 L 70 222 Q 77 170 70 122 Z" fill={forro} />
      {tema && (
        <g fill="#fff" opacity="0.8">
          <circle cx="96" cy="70" r="3" />
          <circle cx="148" cy="190" r="3" />
          <path d="M138 66 l3 6 6 .8 -4.5 4.3 1.1 6 -5.6-3 -5.6 3 1.1-6 -4.5-4.3 6-.8z" />
        </g>
      )}
      {[96, 158, 220].map((y) => (
        <g key={y}>
          <rect x="52" y={y} width="136" height="13" rx="4" fill={tira} />
          <rect x="114" y={y + 1.5} width="12" height="10" rx="2" fill="#fff" stroke={TRACO} strokeWidth="1.2" />
        </g>
      ))}
      {specs.has('Orifícios de ventilação') && (
        <g className="animate-fade" fill="#fff" stroke={TRACO} strokeWidth="1.2">
          {[128, 140, 188, 200].flatMap((y) => [92, 108, 132, 148].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="3" />))}
        </g>
      )}
      {nome && <rect className="animate-pop" x="100" y="54" width="40" height="16" rx="4" fill="#fff" stroke={tira} strokeWidth="1.6" />}
    </g>
  )
}

function Protese({ nivel, superior, liner }: { nivel?: string | null; superior: boolean; liner: string | null }) {
  if (superior)
    return (
      <g className="animate-pop" style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
        <path d="M44 0 L 80 0 C 80 40 78 70 76 92 L 46 92 C 44 70 43 40 44 0 Z" fill={PELE} />
        <path d="M40 70 L 84 70 L 80 150 Q 62 160 44 150 Z" fill={PLASTICO} stroke={TRACO} strokeWidth="2" />
        {liner && <path className="animate-fade" d="M46 74 L 78 74 L 75 140 Q 62 146 49 140 Z" fill={liner} opacity="0.8" />}
        <rect x="55" y="150" width="14" height="70" rx="5" fill="#c9d3ce" stroke={TRACO} strokeWidth="1.5" />
        <path d="M44 220 Q 62 210 80 220 L 84 262 Q 82 280 66 282 Q 46 282 44 262 Z" fill="#f0e2d4" stroke={TRACO} strokeWidth="2" />
      </g>
    )
  const femoral = nivel === 'transfemoral'
  return (
    <g className="animate-pop" style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
      <path d={femoral ? 'M42 0 L 82 0 C 82 30 80 60 76 84 L 40 84 C 38 60 38 30 42 0 Z' : 'M42 0 L 82 0 C 84 60 80 110 74 140 C 73 160 70 178 68 190 L 36 190 C 34 172 32 158 33 140 C 31 104 35 52 42 0 Z'} fill={PELE} />
      {femoral ? (
        <>
          <path d="M30 40 L 90 40 L 82 128 Q 60 140 38 128 Z" fill={PLASTICO} stroke={TRACO} strokeWidth="2" />
          {liner && <path className="animate-fade" d="M38 46 L 82 46 L 76 120 Q 60 128 44 120 Z" fill={liner} opacity="0.8" />}
          <rect x="44" y="132" width="32" height="26" rx="10" fill="#dfe7e3" stroke={TRACO} strokeWidth="2" />
          <circle cx="60" cy="145" r="4" fill={TRACO} />
          <rect x="54" y="158" width="12" height="104" rx="4" fill="#c9d3ce" stroke={TRACO} strokeWidth="1.5" />
        </>
      ) : (
        <>
          <path d="M28 130 L 82 130 L 74 214 Q 54 226 36 214 Z" fill={PLASTICO} stroke={TRACO} strokeWidth="2" />
          {liner && <path className="animate-fade" d="M35 136 L 76 136 L 69 206 Q 54 214 41 206 Z" fill={liner} opacity="0.8" />}
          <rect x="49" y="218" width="12" height="44" rx="4" fill="#c9d3ce" stroke={TRACO} strokeWidth="1.5" />
        </>
      )}
      <path d="M40 262 L 66 262 C 80 266 98 268 108 274 Q 112 282 104 283 L 30 283 Q 22 280 26 270 Z" fill="#f0e2d4" stroke={TRACO} strokeWidth="2" />
    </g>
  )
}
