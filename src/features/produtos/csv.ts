/**
 * Importação da tabela de preços por planilha (CSV).
 * Aceita o CSV do Excel em português (separador ";") e o padrão internacional (",").
 */
import { normalizeSearch, parseBRL } from '@/lib/br'
import type { TipoProduto } from './schema'

export const COLUNAS = ['codigo', 'nome', 'tipo', 'categoria', 'unidade', 'preco', 'descricao'] as const
type Coluna = (typeof COLUNAS)[number]

/** Cabeçalhos aceitos para cada coluna (comparados sem acento e em minúsculas). */
const APELIDOS: Record<Coluna, string[]> = {
  codigo: ['codigo', 'cod', 'cod.', 'ref', 'referencia'],
  nome: ['nome', 'produto', 'item', 'servico'],
  tipo: ['tipo'],
  categoria: ['categoria', 'grupo', 'secao'],
  unidade: ['unidade', 'un', 'und'],
  preco: ['preco', 'valor', 'preco (r$)', 'valor (r$)', 'preco r$', 'valor r$'],
  descricao: ['descricao', 'observacao', 'obs', 'detalhes'],
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
  const src = text.replace(/^﻿/, '')
  const primeira = src.split(/\r?\n/, 1)[0] ?? ''
  // O separador é o que mais aparece no cabeçalho (fora de aspas); empate favorece ";" (Excel em português).
  const sep = [';', ',', '\t'].reduce((melhor, ch) => (contarFora(primeira, ch) > contarFora(primeira, melhor) ? ch : melhor), ';')
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let aspas = false
  for (let i = 0; i < src.length; i++) {
    const c = src[i]!
    if (aspas) {
      if (c === '"' && src[i + 1] === '"') {
        cell += '"'
        i++
      } else if (c === '"') aspas = false
      else cell += c
    } else if (c === '"' && cell === '') aspas = true
    else if (c === sep) {
      row.push(cell)
      cell = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += c
  }
  if (cell !== '' || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''))
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

/** Converte as linhas da planilha em itens válidos + lista de erros por linha (linha 1 = cabeçalho). */
export function lerPlanilha(rows: string[][]): ResultadoLeitura {
  if (rows.length === 0) return { itens: [], erros: [{ linha: 1, mensagem: 'A planilha está vazia.' }] }

  const cabecalho = rows[0]!.map((h) => normalizeSearch(h))
  const idx = {} as Record<Coluna, number>
  for (const col of COLUNAS) idx[col] = cabecalho.findIndex((h) => APELIDOS[col].includes(h))
  const faltando = (['nome', 'preco'] as const).filter((c) => idx[c] < 0)
  if (faltando.length)
    return {
      itens: [],
      erros: [{ linha: 1, mensagem: `Cabeçalho sem a coluna ${faltando.map((c) => `“${c === 'preco' ? 'preço' : c}”`).join(' e ')}. Use o modelo como base.` }],
    }

  const dados = rows.slice(1)
  if (dados.length > MAX_LINHAS) return { itens: [], erros: [{ linha: 1, mensagem: `A planilha tem ${dados.length} linhas; o máximo é ${MAX_LINHAS}.` }] }

  const itens: ItemImportado[] = []
  const erros: ErroImportacao[] = []
  const vistosNome = new Map<string, number>()
  const vistosCodigo = new Map<string, number>()

  dados.forEach((r, i) => {
    const linha = i + 2
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
    const preco = precoTxt === '' ? Number.NaN : parseBRL(precoTxt)
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

  if (itens.length === 0 && erros.length === 0) erros.push({ linha: 2, mensagem: 'Nenhum produto encontrado abaixo do cabeçalho.' })
  return { itens, erros }
}
