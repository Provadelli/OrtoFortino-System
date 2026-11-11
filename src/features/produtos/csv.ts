/**
 * Importação da tabela de preços por planilha: .xlsx do Excel ou CSV
 * (Excel em português com ";" e o padrão internacional com ",").
 */
import { normalizeSearch, parseBRL } from '@/lib/br'
import type { Produto } from './api'
import type { TipoProduto } from './schema'

export const COLUNAS = ['codigo', 'nome', 'tipo', 'categoria', 'unidade', 'preco', 'descricao'] as const
type Coluna = (typeof COLUNAS)[number]

/**
 * Reconhece o cabeçalho de cada coluna sem exigir o nome exato: sem acento, sem "(R$)",
 * pelo começo da palavra ("Preço unitário", "Valor de venda", "Cód.", "Und.", "Descrição do produto").
 * A ordem importa: a primeira regra que casar fica com a coluna.
 */
const REGRAS: [Coluna, RegExp][] = [
  ['codigo', /^(cod|codigo|ref|referencia|sku)\b/],
  ['preco', /^(preco|valor|price|vlr)\b/],
  ['tipo', /^tipo\b/],
  ['categoria', /^(categoria|grupo|secao|familia|linha)\b/],
  ['unidade', /^(unidade|un|und|unid|medida)\b/],
  ['descricao', /^(descricao|observacao|observacoes|obs|detalhe|detalhes)\b/],
  ['nome', /^(nome|produto|item|servico|material|artigo)\b/],
]

function chaveCabecalho(h: string) {
  return normalizeSearch(h)
    .replace(/\(.*?\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Índice de cada coluna no cabeçalho (-1 = ausente). Sem coluna de nome, "Descrição" vira o nome. */
function mapearColunas(cabecalho: string[]) {
  const idx = Object.fromEntries(COLUNAS.map((c) => [c, -1])) as Record<Coluna, number>
  cabecalho.forEach((h, i) => {
    const k = chaveCabecalho(h)
    if (!k) return
    const col = REGRAS.find(([c, re]) => idx[c] < 0 && re.test(k))?.[0]
    if (col) idx[col] = i
  })
  if (idx.nome < 0 && idx.descricao >= 0 && idx.preco >= 0) {
    idx.nome = idx.descricao
    idx.descricao = -1
  }
  return idx
}

/**
 * Preço da planilha: "R$ 1.250,00", "1250,5", "1.250" (milhar), "1250.50" e "1,250.00" (formato americano).
 * Números vindos de células do Excel chegam como "1250.5".
 */
export function parsePreco(v: string) {
  const t = v.replace(/[R$\s\u00a0]/g, '')
  if (/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(t)) return Number(t.replace(/,/g, ''))
  return parseBRL(t)
}

export const MAX_LINHAS = 2000

/** Modelo para baixar: Excel em português abre com ";" direto em colunas. */
export const MODELO_CSV =
  '﻿' +
  [
    'codigo;nome;tipo;categoria;unidade;preco;descricao',
    'AFO-01;AFO articulada;base;Órteses de membro inferior;par;1.250,00;Polipropileno com articulação',
    'SMO-01;SMO;base;Órteses de membro inferior;par;890,00;',
    'AD-01;Tira valgo;adicional;Adicionais;un;80,00;',
    'AD-02;Forro temático;adicional;Personalização;un;45,00;Tema escolhido pela criança',
  ].join('\r\n') +
  '\r\n'

/** Lê CSV respeitando aspas ("a;b", "diz ""oi"""), quebras de linha dentro de aspas e BOM. */
export function parseCsv(text: string): string[][] {
  return parseCsvComLinhas(text).rows
}

/** Igual a parseCsv, com o número da linha do arquivo em que cada registro começa (para as mensagens de erro). */
export function parseCsvComLinhas(text: string): { rows: string[][]; linhas: number[] } {
  const src = text.replace(/^﻿/, '')
  const primeira = src.split(/\r?\n/, 1)[0] ?? ''
  // O separador é o que mais aparece no cabeçalho (fora de aspas); empate favorece ";" (Excel em português).
  const sep = [';', ',', '\t'].reduce((melhor, ch) => (contarFora(primeira, ch) > contarFora(primeira, melhor) ? ch : melhor), ';')
  const rows: string[][] = []
  const linhas: number[] = []
  let row: string[] = []
  let cell = ''
  let aspas = false
  let linhaFisica = 1
  let inicioRegistro = 1
  for (let i = 0; i < src.length; i++) {
    const c = src[i]!
    if (aspas) {
      if (c === '"' && src[i + 1] === '"') {
        cell += '"'
        i++
      } else if (c === '"') aspas = false
      else {
        if (c === '\n') linhaFisica++
        cell += c
      }
    } else if (c === '"' && cell === '') aspas = true
    else if (c === sep) {
      row.push(cell)
      cell = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      linhas.push(inicioRegistro)
      linhaFisica++
      inicioRegistro = linhaFisica
      row = []
      cell = ''
    } else cell += c
  }
  if (cell !== '' || row.length) {
    row.push(cell)
    rows.push(row)
    linhas.push(inicioRegistro)
  }
  const manter = rows.map((r) => r.some((c) => c.trim() !== ''))
  return { rows: rows.filter((_, i) => manter[i]), linhas: linhas.filter((_, i) => manter[i]) }
}

function contarFora(linha: string, ch: string) {
  let n = 0
  let aspas = false
  for (const c of linha) {
    if (c === '"') aspas = !aspas
    else if (c === ch && !aspas) n++
  }
  return n
}

export type ItemImportado = {
  linha: number
  codigo: string
  nome: string
  tipo: TipoProduto
  categoria: string
  unidade: string
  preco: number
  descricao: string
}

export type ErroImportacao = { linha: number; mensagem: string }

export type ResultadoLeitura = { itens: ItemImportado[]; erros: ErroImportacao[] }

function tipoDe(v: string): TipoProduto | null {
  const t = normalizeSearch(v)
  if (t === '' || t === 'base' || t === 'produto-base' || t === 'produto base' || t === 'produto') return 'base'
  if (t === 'adicional' || t === 'adicionais' || t === 'extra' || t === 'acessorio') return 'adicional'
  return null
}

/**
 * Converte as linhas da planilha em itens válidos + lista de erros por linha.
 * O cabeçalho pode estar abaixo de linhas de título (ex.: "Tabela de preços 2026"): procura nas 10 primeiras.
 * `linhas` = número real de cada linha no arquivo (as vazias foram removidas); padrão 1, 2, 3…
 */
export function lerPlanilha(rows: string[][], linhas?: number[]): ResultadoLeitura {
  if (rows.length === 0) return { itens: [], erros: [{ linha: 1, mensagem: 'A planilha está vazia.' }] }
  const numero = (i: number) => linhas?.[i] ?? i + 1

  const inicio = rows.slice(0, 10).findIndex((r) => {
    const m = mapearColunas(r)
    return m.nome >= 0 && m.preco >= 0
  })
  if (inicio < 0) {
    const m = mapearColunas(rows[0]!)
    const faltando = (['nome', 'preco'] as const).filter((c) => m[c] < 0)
    return {
      itens: [],
      erros: [{ linha: numero(0), mensagem: `Cabeçalho sem a coluna ${faltando.map((c) => `“${c === 'preco' ? 'preço' : c}”`).join(' e ')}. Use o modelo como base.` }],
    }
  }
  const idx = mapearColunas(rows[inicio]!)

  const dados = rows.slice(inicio + 1)
  if (dados.length > MAX_LINHAS) return { itens: [], erros: [{ linha: 1, mensagem: `A planilha tem ${dados.length} linhas; o máximo é ${MAX_LINHAS}.` }] }

  const itens: ItemImportado[] = []
  const erros: ErroImportacao[] = []
  const vistosNome = new Map<string, number>()
  const vistosCodigo = new Map<string, number>()

  dados.forEach((r, i) => {
    const linha = numero(inicio + 1 + i)
    const get = (c: Coluna) => (idx[c] >= 0 ? (r[idx[c]] ?? '').trim() : '')
    const nome = get('nome')
    const codigo = get('codigo')
    const problemas: string[] = []

    if (nome.length < 2) problemas.push('nome vazio')
    else if (nome.length > 160) problemas.push('nome com mais de 160 caracteres')
    if (codigo.length > 30) problemas.push('código com mais de 30 caracteres')

    const tipo = tipoDe(get('tipo'))
    if (!tipo) problemas.push(`tipo “${get('tipo')}” desconhecido (use base ou adicional)`)

    const precoTxt = get('preco')
    const preco = precoTxt === '' ? Number.NaN : parsePreco(precoTxt)
    if (!Number.isFinite(preco) || preco < 0 || preco > 1_000_000) problemas.push(precoTxt === '' ? 'preço vazio' : `preço “${precoTxt}” inválido`)

    const categoria = get('categoria')
    const unidade = get('unidade') || 'un'
    const descricao = get('descricao')
    if (categoria.length > 80) problemas.push('categoria com mais de 80 caracteres')
    if (unidade.length > 20) problemas.push('unidade com mais de 20 caracteres')
    if (descricao.length > 1000) problemas.push('descrição com mais de 1000 caracteres')

    const chaveNome = normalizeSearch(nome)
    if (nome.length >= 2 && vistosNome.has(chaveNome)) problemas.push(`nome repetido (igual à linha ${vistosNome.get(chaveNome)})`)
    const chaveCodigo = codigo.toLowerCase()
    if (codigo && vistosCodigo.has(chaveCodigo)) problemas.push(`código repetido (igual à linha ${vistosCodigo.get(chaveCodigo)})`)

    if (problemas.length) {
      erros.push({ linha, mensagem: problemas.join('; ') })
      return
    }
    vistosNome.set(chaveNome, linha)
    if (codigo) vistosCodigo.set(chaveCodigo, linha)
    itens.push({ linha, codigo, nome, tipo: tipo!, categoria, unidade, preco, descricao })
  })

  if (itens.length === 0 && erros.length === 0) erros.push({ linha: numero(inicio) + 1, mensagem: 'Nenhum produto encontrado abaixo do cabeçalho.' })
  return { itens, erros }
}

/** Célula do Excel → texto: números com no máximo 2 casas ("1250.5"), datas em dd/mm/aaaa, vazio para nulo. */
export function celulaParaTexto(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'number') return Number.isFinite(v) ? String(Math.round(v * 100) / 100) : ''
  if (typeof v === 'boolean') return v ? 'sim' : 'não'
  if (v instanceof Date) return v.toLocaleDateString('pt-BR', { timeZone: 'UTC' })
  return String(v)
}

/** Linhas de uma planilha do Excel (1ª aba), sem as linhas vazias, com o número real de cada uma. */
export function linhasDoExcel(sheet: unknown[][]): { rows: string[][]; linhas: number[] } {
  const rows: string[][] = []
  const linhas: number[] = []
  sheet.forEach((r, i) => {
    const texto = r.map(celulaParaTexto)
    if (texto.some((c) => c.trim() !== '')) {
      rows.push(texto)
      linhas.push(i + 1)
    }
  })
  return { rows, linhas }
}

export type Mudanca = { tipo: 'novo' } | { tipo: 'preco'; antes: number } | { tipo: 'igual'; reativa: boolean }

/**
 * Mesmo critério do banco (importar_produtos): código primeiro, depois nome sem acento.
 * Também separa as linhas que o banco recusaria: o nome já é de OUTRO produto da tabela
 * (o código aponta para um, o nome para outro) ou duas linhas caem no mesmo produto.
 */
export function compararComTabela(itens: ItemImportado[], atuais: Pick<Produto, 'id' | 'codigo' | 'nome' | 'nome_busca' | 'preco' | 'ativo'>[]) {
  const porCodigo = new Map(atuais.filter((p) => p.codigo).map((p) => [p.codigo!.toLowerCase(), p]))
  const porNome = new Map(atuais.map((p) => [p.nome_busca ?? normalizeSearch(p.nome), p]))
  const usados = new Map<string, number>()
  const previa: { item: ItemImportado; mudanca: Mudanca }[] = []
  const conflitos: ErroImportacao[] = []
  for (const item of itens) {
    const peloCodigo = item.codigo ? porCodigo.get(item.codigo.toLowerCase()) : undefined
    const peloNome = porNome.get(normalizeSearch(item.nome))
    const atual = peloCodigo ?? peloNome
    if (peloCodigo && peloNome && peloCodigo.id !== peloNome.id) {
      conflitos.push({
        linha: item.linha,
        mensagem: `o código “${item.codigo}” é de “${peloCodigo.nome}”, mas o nome “${item.nome}” já é de outro produto${peloNome.codigo ? ` (código ${peloNome.codigo})` : ''}`,
      })
      continue
    }
    if (atual && usados.has(atual.id)) {
      conflitos.push({ linha: item.linha, mensagem: `atualizaria “${atual.nome}”, que a linha ${usados.get(atual.id)} já atualiza` })
      continue
    }
    if (atual) usados.set(atual.id, item.linha)
    const mudanca: Mudanca = !atual ? { tipo: 'novo' } : atual.preco !== item.preco ? { tipo: 'preco', antes: atual.preco } : { tipo: 'igual', reativa: !atual.ativo }
    previa.push({ item, mudanca })
  }
  return { previa, conflitos }
}
