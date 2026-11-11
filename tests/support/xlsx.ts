import { strToU8, zipSync } from 'fflate'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const coluna = (i: number) => String.fromCharCode(65 + i)

/**
 * Gera um .xlsx mínimo (1 aba) para testes: textos como inlineStr, números como célula numérica,
 * `null` = célula vazia. Linhas `[]` ficam em branco (testa a numeração das linhas).
 */
export function gerarXlsx(linhas: (string | number | null)[][]): Uint8Array {
  const rows = linhas
    .map((r, i) => {
      const cells = r
        .map((v, j) => {
          if (v === null) return ''
          const ref = `${coluna(j)}${i + 1}`
          return typeof v === 'number' ? `<c r="${ref}"><v>${v}</v></c>` : `<c r="${ref}" t="inlineStr"><is><t>${esc(v)}</t></is></c>`
        })
        .join('')
      return `<row r="${i + 1}">${cells}</row>`
    })
    .join('')
  const xml = (s: string) => strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${s}`)
  return zipSync({
    '[Content_Types].xml': xml(
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    ),
    '_rels/.rels': xml(
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    ),
    'xl/workbook.xml': xml(
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Preços" sheetId="1" r:id="rId1"/></sheets></workbook>',
    ),
    'xl/_rels/workbook.xml.rels': xml(
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    ),
    'xl/worksheets/sheet1.xml': xml(`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows}</sheetData></worksheet>`),
  })
}
