// Carregado sob demanda (import dinâmico) ao clicar em "Baixar PDF": a biblioteca de PDF é pesada
// e não precisa entrar no carregamento inicial do sistema.
import { Buffer } from 'buffer'
import { Font, pdf } from '@react-pdf/renderer'
import poppins400 from '@fontsource/poppins/files/poppins-latin-400-normal.woff?url'
import poppins600 from '@fontsource/poppins/files/poppins-latin-600-normal.woff?url'
import poppins700 from '@fontsource/poppins/files/poppins-latin-700-normal.woff?url'
import { dadosPdf, type OrcamentoParaPdf } from './dados'
import { OrcamentoPdf } from './OrcamentoPdf'

// A biblioteca de PDF consulta `Buffer` (do Node) ao carregar imagens; no navegador ele não existe.
const g = globalThis as { Buffer?: unknown }
g.Buffer ??= Buffer

Font.register({
  family: 'Poppins',
  fonts: [
    { src: poppins400, fontWeight: 400 },
    { src: poppins600, fontWeight: 600 },
    { src: poppins700, fontWeight: 700 },
  ],
})
// Sem hifenização automática (as regras padrão são do inglês).
Font.registerHyphenationCallback((palavra) => [palavra])

/** Gera o PDF do orçamento e devolve o arquivo e o nome sugerido. */
export async function gerarPdfOrcamento(o: OrcamentoParaPdf) {
  const d = dadosPdf(o)
  const blob = await pdf(<OrcamentoPdf d={d} />).toBlob()
  return { blob, nome: d.arquivo }
}
