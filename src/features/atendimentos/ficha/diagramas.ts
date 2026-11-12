/**
 * Bonecos da ficha técnica (redesenhados da ficha em papel "FICHA ÓRTESE ATUALIZADA").
 * Cada ponto é uma medida em cm: fica num círculo ao lado do desenho, ligado por uma linha ao lugar do corpo.
 * Coordenadas no viewBox de cada desenho; os rótulos seguem o papel.
 */

export type DiagramaId = 'pernas' | 'colete' | 'extensores' | 'encaixe'
export type Lado = 'd' | 'e'

export type Ponto = {
  id: string
  /** Nome completo do campo ("Circunferência superior"). */
  rotulo: string
  /** Texto curto dentro do círculo quando vazio ("1", "A", "T"). */
  curto: string
  /** Posição do círculo. */
  x: number
  y: number
  /** Onde a linha encosta no corpo. */
  ax: number
  ay: number
  lado?: Lado
  grupo: string
}

export type Diagrama = { id: DiagramaId; titulo: string; largura: number; altura: number; pontos: Ponto[] }

const W = 360
/** Espelha um ponto da perna direita para a esquerda. */
const espelho = (p: Ponto): Ponto => ({ ...p, id: p.id.replace(/^d_/, 'e_'), x: W - p.x, ax: W - p.ax, lado: 'e', grupo: 'Perna esquerda' })

const pernaDireita: Ponto[] = [
  { id: 'd_sup', rotulo: 'Circunferência superior', curto: '1', x: 26, y: 58, ax: 92, ay: 58, lado: 'd', grupo: 'Perna direita' },
  { id: 'd_med', rotulo: 'Circunferência do meio', curto: '2', x: 26, y: 132, ax: 94, ay: 132, lado: 'd', grupo: 'Perna direita' },
  { id: 'd_tornozelo', rotulo: 'Tornozelo', curto: '3', x: 52, y: 214, ax: 98, ay: 214, lado: 'd', grupo: 'Perna direita' },
  { id: 'd_ml', rotulo: 'ML (largura do pé)', curto: 'ML', x: 112, y: 286, ax: 112, ay: 256, lado: 'd', grupo: 'Perna direita' },
]

export const DIAGRAMAS: Record<DiagramaId, Diagrama> = {
  pernas: {
    id: 'pernas',
    titulo: 'Pernas (AFO)',
    largura: W,
    altura: 310,
    pontos: [
      ...pernaDireita,
      ...pernaDireita.map(espelho),
      { id: 'total', rotulo: 'Altura total', curto: 'T', x: 180, y: 120, ax: 180, ay: 120, grupo: 'Centro' },
      { id: 'pe', rotulo: 'Comprimento do pé', curto: 'Pé', x: 180, y: 286, ax: 180, ay: 252, grupo: 'Centro' },
    ],
  },
  colete: {
    id: 'colete',
    titulo: 'Colete',
    largura: 320,
    altura: 310,
    pontos: [
      ...[48, 92, 132, 170, 208, 250].map((y, i) => ({
        id: `c${i + 1}`,
        rotulo: `Circunferência ${i + 1}${i === 0 ? ' (topo)' : i === 5 ? ' (base)' : ''}`,
        curto: String(i + 1),
        x: 292,
        y,
        ax: 220,
        ay: y,
        grupo: 'Circunferências',
      })),
      { id: 'total', rotulo: 'Altura total', curto: 'T', x: 28, y: 150, ax: 28, ay: 150, grupo: 'Altura' },
    ],
  },
  extensores: {
    id: 'extensores',
    titulo: 'Extensores',
    largura: W,
    altura: 310,
    pontos: [
      { id: 'f_e', rotulo: 'E (raiz da coxa)', curto: 'E', x: 196, y: 160, ax: 140, ay: 160, grupo: 'Frente' },
      { id: 'f_a', rotulo: 'A (coxa)', curto: 'A', x: 196, y: 196, ax: 140, ay: 178, grupo: 'Frente' },
      { id: 'f_b', rotulo: 'B (joelho)', curto: 'B', x: 196, y: 232, ax: 140, ay: 222, grupo: 'Frente' },
      { id: 'f_c', rotulo: 'C (tornozelo)', curto: 'C', x: 196, y: 278, ax: 138, ay: 280, grupo: 'Frente' },
      { id: 'f_d', rotulo: 'D (comprimento A–C)', curto: 'D', x: 64, y: 230, ax: 108, ay: 230, grupo: 'Frente' },
      { id: 'l_a', rotulo: 'A (alto)', curto: 'A', x: 334, y: 150, ax: 290, ay: 160, grupo: 'Lateral' },
      { id: 'l_b', rotulo: 'B (baixo)', curto: 'B', x: 334, y: 214, ax: 290, ay: 210, grupo: 'Lateral' },
      { id: 'l_c', rotulo: 'C (comprimento A–B)', curto: 'C', x: 334, y: 182, ax: 296, ay: 185, grupo: 'Lateral' },
    ],
  },
  encaixe: {
    id: 'encaixe',
    titulo: 'Encaixe da prótese',
    largura: 300,
    altura: 310,
    pontos: [
      ...[78, 136, 188, 236].map((y, i) => ({
        id: `c${i + 1}`,
        rotulo: `Circunferência ${i + 1}${i === 0 ? ' (borda)' : ''}`,
        curto: String(i + 1),
        x: 262,
        y,
        ax: 214 - i * 14,
        ay: y,
        grupo: 'Circunferências',
      })),
      { id: 'total', rotulo: 'Comprimento total', curto: 'T', x: 34, y: 160, ax: 34, ay: 160, grupo: 'Comprimento' },
    ],
  },
}

/** Qual boneco usar: prótese → encaixe; colete; extensores; o resto (AFO, KAFO, SMO, palmilha) → pernas. */
export function diagramaPara(tipo: string, produto: string): DiagramaId {
  if (tipo === 'protese') return 'encaixe'
  const p = produto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
  if (p.includes('colete')) return 'colete'
  if (p.includes('extensor')) return 'extensores'
  return 'pernas'
}

/** Pontos em uso: na perna unilateral, só o lado escolhido conta. */
export function pontosAtivos(d: Diagrama, lateralidade: string) {
  if (d.id !== 'pernas') return d.pontos
  if (lateralidade === 'unilateral_d') return d.pontos.filter((p) => p.lado !== 'e')
  if (lateralidade === 'unilateral_e') return d.pontos.filter((p) => p.lado !== 'd')
  return d.pontos
}

export type MedidasForm = Partial<Record<DiagramaId, Record<string, string>>>

/** Quantos pontos em uso já têm medida. */
export function progresso(medidas: MedidasForm | undefined, d: Diagrama, lateralidade: string) {
  const ativos = pontosAtivos(d, lateralidade)
  const valores = medidas?.[d.id] ?? {}
  const preenchidos = ativos.filter((p) => (valores[p.id] ?? '').trim()).length
  return { preenchidos, total: ativos.length }
}

/** Para salvar: só as medidas do boneco em uso, dos pontos ativos, sem vazios. Formato plano "pernas.d_sup". */
export function medidasParaSalvar(medidas: MedidasForm | undefined, d: Diagrama, lateralidade: string) {
  const valores = medidas?.[d.id] ?? {}
  const out: Record<string, string> = {}
  for (const p of pontosAtivos(d, lateralidade)) {
    const v = (valores[p.id] ?? '').trim()
    if (v) out[`${d.id}.${p.id}`] = v.slice(0, 12)
  }
  return out
}

/** Do banco ("pernas.d_sup": "24") para o formulário ({ pernas: { d_sup: "24" } }). */
export function medidasDoBanco(json: unknown): MedidasForm {
  const out: MedidasForm = {}
  if (!json || typeof json !== 'object' || Array.isArray(json)) return out
  for (const [k, v] of Object.entries(json as Record<string, unknown>)) {
    const [diag, ponto] = k.split('.')
    if (!diag || !ponto || typeof v !== 'string' || !(diag in DIAGRAMAS)) continue
    const id = diag as DiagramaId
    out[id] = { ...out[id], [ponto]: v }
  }
  return out
}
