import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import logo from '@/assets/pdf/logo-orto-fortino.png'
import { EMPRESA } from '@/lib/empresa'
import type { DadosPdf } from './dados'

// Paleta da marca (mesmos tons da logo) e do sistema.
const C = {
  amarelo: '#FDF114',
  laranja: '#F48534',
  rosa: '#EB278F',
  menta: '#9ED2B0',
  verde: '#1F7A5C',
  verdeEscuro: '#17604A',
  tinta: '#1F2A2E',
  suave: '#3B4A50',
  apagado: '#55636A',
  linha: '#E3ECE7',
  superficie: '#F5F8F6',
  lavado: '#F3FBF7',
}

const s = StyleSheet.create({
  page: { paddingTop: 36, paddingBottom: 72, paddingHorizontal: 40, fontFamily: 'Poppins', fontSize: 9.5, color: C.tinta },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  logo: { width: 150, height: 77.8 },
  doc: { alignItems: 'flex-end', gap: 2 },
  docRotulo: { fontSize: 8, letterSpacing: 2, color: C.apagado, fontWeight: 600 },
  docNumero: { fontSize: 20, fontWeight: 700, color: C.tinta },
  docData: { fontSize: 9, color: C.suave },
  stripe: { flexDirection: 'row', height: 3, marginTop: 14, marginBottom: 16 },
  aviso: { alignSelf: 'flex-start', borderRadius: 10, paddingVertical: 3, paddingHorizontal: 10, fontSize: 8.5, fontWeight: 600, marginBottom: 12 },
  pessoas: { flexDirection: 'row', gap: 12, marginBottom: 18 },
  caixa: { flex: 1, backgroundColor: C.superficie, borderRadius: 8, padding: 12, gap: 2 },
  rotulo: { fontSize: 7.5, letterSpacing: 1.2, color: C.apagado, fontWeight: 600, marginBottom: 2 },
  nome: { fontSize: 11, fontWeight: 600 },
  info: { fontSize: 9, color: C.suave },
  th: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.tinta, paddingBottom: 5, fontSize: 8, fontWeight: 600, color: C.apagado, letterSpacing: 0.6 },
  secao: { backgroundColor: C.lavado, paddingVertical: 4, paddingHorizontal: 6, marginTop: 6, fontSize: 8, fontWeight: 600, letterSpacing: 1, color: C.verdeEscuro },
  tr: { flexDirection: 'row', borderBottomWidth: 0.6, borderBottomColor: C.linha, paddingVertical: 6 },
  subtotalSecao: { flexDirection: 'row', justifyContent: 'flex-end', gap: 16, paddingVertical: 5, fontSize: 8.5, color: C.apagado },
  colItem: { flex: 1, paddingRight: 8, paddingLeft: 6 },
  colQtd: { width: 62, textAlign: 'right' },
  colUnit: { width: 84, textAlign: 'right' },
  colTotal: { width: 84, textAlign: 'right', paddingRight: 6 },
  detalhe: { fontSize: 8.5, color: C.apagado },
  totais: { alignSelf: 'flex-end', width: 230, marginTop: 12, gap: 3 },
  linhaTotal: { flexDirection: 'row', justifyContent: 'space-between' },
  total: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, paddingTop: 8, borderTopWidth: 1.2, borderTopColor: C.verde },
  totalTexto: { fontSize: 13, fontWeight: 700, color: C.verdeEscuro },
  condicoes: { marginTop: 22, gap: 10 },
  grade: { flexDirection: 'row', gap: 12 },
  aceite: { marginTop: 34, flexDirection: 'row', gap: 28 },
  assinatura: { flex: 1, borderTopWidth: 0.8, borderTopColor: C.suave, paddingTop: 4, fontSize: 8.5, color: C.apagado },
  rodape: { position: 'absolute', left: 40, right: 40, bottom: 24, borderTopWidth: 0.6, borderTopColor: C.linha, paddingTop: 7, fontSize: 7.5, color: C.apagado },
  pagina: { position: 'absolute', left: 40, right: 40, bottom: 35, textAlign: 'right', fontSize: 7.5, color: C.apagado },
})

const tonsAviso = {
  aprovado: { backgroundColor: '#E3F5EC', color: C.verdeEscuro },
  alerta: { backgroundColor: '#FFF4B8', color: '#6B5A00' },
}

function Campo({ rotulo, children, coluna = false }: { rotulo: string; children: string; coluna?: boolean }) {
  return (
    <View style={coluna ? { flex: 1 } : {}} wrap={false}>
      <Text style={s.rotulo}>{rotulo.toUpperCase()}</Text>
      <Text>{children}</Text>
    </View>
  )
}

export function OrcamentoPdf({ d }: { d: DadosPdf }) {
  return (
    <Document title={`Orçamento ${d.numero}`} author={EMPRESA.nome} subject={`Orçamento ${d.numero}`} creator={EMPRESA.nome} producer={EMPRESA.nome} language="pt-BR">
      {/* Sem lineHeight: na página ele some com o número da página (bug da biblioteca); a Poppins já tem entrelinha ~1,4. */}
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <Image src={logo} style={s.logo} />
          <View style={s.doc}>
            <Text style={s.docRotulo}>ORÇAMENTO</Text>
            <Text style={s.docNumero}>{d.numero}</Text>
            <Text style={s.docData}>Emitido em {d.emissao}</Text>
            <Text style={s.docData}>Válido até {d.validade}</Text>
          </View>
        </View>
        <View style={s.stripe}>
          {[C.amarelo, C.laranja, C.rosa, C.menta].map((cor) => (
            <View key={cor} style={{ flex: 1, backgroundColor: cor }} />
          ))}
        </View>

        {d.aviso && <Text style={[s.aviso, d.aprovado ? tonsAviso.aprovado : tonsAviso.alerta]}>{d.aviso}</Text>}

        <View style={s.pessoas}>
          {d.paciente && (
            <View style={s.caixa}>
              <Text style={s.rotulo}>PACIENTE</Text>
              <Text style={s.nome}>{d.paciente.nome}</Text>
              {d.paciente.idade && <Text style={s.info}>{d.paciente.idade}</Text>}
              {d.paciente.cpf && <Text style={s.info}>CPF {d.paciente.cpf}</Text>}
              {d.paciente.telefone && <Text style={s.info}>{d.paciente.telefone}</Text>}
            </View>
          )}
          {d.responsavel && (
            <View style={s.caixa}>
              <Text style={s.rotulo}>RESPONSÁVEL</Text>
              <Text style={s.nome}>{d.responsavel.nome}</Text>
              {d.responsavel.parentesco && <Text style={s.info}>{d.responsavel.parentesco}</Text>}
              {d.responsavel.cpf && <Text style={s.info}>CPF {d.responsavel.cpf}</Text>}
              {d.responsavel.telefone && <Text style={s.info}>{d.responsavel.telefone}</Text>}
            </View>
          )}
        </View>

        <View style={s.th}>
          <Text style={s.colItem}>ITEM</Text>
          <Text style={s.colQtd}>QTD.</Text>
          <Text style={s.colUnit}>VALOR UNIT.</Text>
          <Text style={s.colTotal}>TOTAL</Text>
        </View>
        {d.secoes.map((sec) => (
          <View key={sec.nome}>
            <Text style={s.secao} minPresenceAhead={30}>
              {sec.nome.toUpperCase()}
            </Text>
            {sec.itens.map((i, k) => (
              <View key={k} style={s.tr} wrap={false}>
                <View style={s.colItem}>
                  <Text style={{ fontWeight: 600 }}>{i.descricao}</Text>
                  {i.detalhe && <Text style={s.detalhe}>{i.detalhe}</Text>}
                </View>
                <Text style={s.colQtd}>{i.quantidade}</Text>
                <Text style={s.colUnit}>{i.unitario}</Text>
                <Text style={[s.colTotal, { fontWeight: 600 }]}>{i.total}</Text>
              </View>
            ))}
            {d.mostrarSubtotais && (
              <View style={s.subtotalSecao} wrap={false}>
                <Text>Subtotal {sec.nome}</Text>
                <Text style={{ width: 84, textAlign: 'right', paddingRight: 6, color: C.tinta, fontWeight: 600 }}>{sec.subtotal}</Text>
              </View>
            )}
          </View>
        ))}

        <View style={s.totais} wrap={false}>
          {d.desconto && (
            <>
              <View style={s.linhaTotal}>
                <Text>Subtotal</Text>
                <Text>{d.subtotal}</Text>
              </View>
              <View style={s.linhaTotal}>
                <Text style={{ color: C.verdeEscuro }}>{d.desconto.rotulo}</Text>
                <Text style={{ color: C.verdeEscuro }}>{d.desconto.valor}</Text>
              </View>
            </>
          )}
          <View style={s.total}>
            <Text style={s.totalTexto}>Total</Text>
            <Text style={s.totalTexto}>{d.total}</Text>
          </View>
        </View>

        <View style={s.condicoes}>
          <View style={s.grade}>
            <Campo coluna rotulo="Forma de pagamento">{d.condicoes || 'A combinar'}</Campo>
            <Campo coluna rotulo="Prazo de entrega">{d.prazo || 'A combinar'}</Campo>
            <Campo coluna rotulo="Validade da proposta">{`Até ${d.validade}`}</Campo>
          </View>
          {d.observacoes && <Campo rotulo="Observações">{d.observacoes}</Campo>}
        </View>

        <View style={s.aceite} wrap={false}>
          <Text style={s.assinatura}>De acordo: paciente ou responsável</Text>
          <Text style={[s.assinatura, { flex: 0.5 }]}>Data</Text>
        </View>

        <View style={s.rodape} fixed>
          <Text style={{ fontWeight: 600, color: C.suave }}>{`${EMPRESA.nome} · ${EMPRESA.slogan} · CNPJ ${EMPRESA.cnpj}`}</Text>
          <Text>{`${EMPRESA.endereco}, ${EMPRESA.cidade} · CEP ${EMPRESA.cep} · ${EMPRESA.telefone}`}</Text>
        </View>
        <Text style={s.pagina} fixed render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
      </Page>
    </Document>
  )
}
