import * as z from 'zod/mini'
import { DIAGRAMAS, diagramaPara, medidasParaSalvar } from './ficha/diagramas'
import { parseBRL } from '@/lib/br'

const texto = (max: number) => z.string().check(z.trim(), z.maxLength(max, `Use no máximo ${max} caracteres.`))
const data = z.string()
const dinheiro = z.string().check(
  z.refine((v) => {
    const n = parseBRL(v)
    return Number.isFinite(n) && n >= 0 && n <= 1_000_000
  }, 'Valor inválido. Use, por exemplo, 1.250,00.'),
)

export const fichaSchema = z.object({
  tipo: z.enum(['ortese', 'palmilha', 'protese']),
  lateralidade: z.string(),
  produto: texto(120),
  especificacoes: z.array(z.string()),
  compensacao_lado: z.string(),
  compensacao_medida: texto(40),
  tamanho_calcado: texto(20),
  medidas_ml: texto(400),
  nome_na_ortese: z.boolean(),
  tema: texto(80),
  cor_forro: texto(60),
  cor_tira: texto(60),
  protese_membro: z.string(),
  protese_nivel: z.string(),
  protese_lado: z.string(),
  liner: texto(80),
  tamanho_pe: texto(20),
  observacoes: texto(4000),
  /** Medidas do boneco: { pernas: { d_sup: "24,5" } } (em cm). */
  medidas: z.record(z.string(), z.record(z.string(), z.string())),
})

export const atendimentoSchema = z
  .object({
    paciente_id: z.string().check(z.minLength(1, 'Escolha o paciente.')),
    categoria: z.enum(['confeccao', 'ajuste', 'reparo', 'manutencao']),
    descricao: texto(240),
    status: z.enum(['em_contato', 'em_producao', 'pronto', 'entregue', 'cancelado']),
    data_primeiro_contato: data.check(z.minLength(10, 'Informe a data do primeiro contato.')),
    data_fechamento: data,
    prazo_entrega: data,
    data_conclusao: data,
    valor: dinheiro,
    valor_pago: dinheiro,
    pagamento_forma: z.string(),
    pagamento_parcelas: z.string(),
    pagamento_detalhe: texto(120),
    data_pagamento: data,
    observacoes: texto(4000),
    com_ficha: z.boolean(),
    ficha: fichaSchema,
  })
  .check(
    z.refine((v) => !v.data_fechamento || v.data_fechamento >= v.data_primeiro_contato, {
      path: ['data_fechamento'],
      message: 'O fechamento não pode ser antes do primeiro contato.',
    }),
    z.refine((v) => !v.data_conclusao || v.data_conclusao >= v.data_primeiro_contato, {
      path: ['data_conclusao'],
      message: 'A conclusão não pode ser antes do primeiro contato.',
    }),
    z.refine((v) => !(parseBRL(v.valor_pago) > parseBRL(v.valor)), {
      path: ['valor_pago'],
      message: 'O valor pago é maior que o valor do atendimento.',
    }),
  )

export type AtendimentoForm = z.infer<typeof atendimentoSchema>
export type FichaForm = z.infer<typeof fichaSchema>

export const fichaVazia: FichaForm = {
  tipo: 'ortese',
  lateralidade: '',
  produto: '',
  especificacoes: [],
  compensacao_lado: '',
  compensacao_medida: '',
  tamanho_calcado: '',
  medidas_ml: '',
  nome_na_ortese: false,
  tema: '',
  cor_forro: '',
  cor_tira: '',
  protese_membro: '',
  protese_nivel: '',
  protese_lado: '',
  liner: '',
  tamanho_pe: '',
  observacoes: '',
  medidas: {},
}

export const atendimentoVazio = (pacienteId: string, hoje: string): AtendimentoForm => ({
  paciente_id: pacienteId,
  categoria: 'confeccao',
  descricao: '',
  status: 'em_contato',
  data_primeiro_contato: hoje,
  data_fechamento: '',
  prazo_entrega: '',
  data_conclusao: '',
  valor: '',
  valor_pago: '',
  pagamento_forma: '',
  pagamento_parcelas: '',
  pagamento_detalhe: '',
  data_pagamento: '',
  observacoes: '',
  com_ficha: true,
  ficha: fichaVazia,
})

/** Limpa campos que não se aplicam ao tipo de ficha escolhido. */
/** Só as medidas do boneco em uso (pelo produto/tipo e lateralidade), no formato plano do banco. */
function medidasDaFicha(f: FichaForm) {
  const d = DIAGRAMAS[diagramaPara(f.tipo, f.produto)]
  return medidasParaSalvar(f.medidas, d, f.tipo === 'protese' ? '' : f.lateralidade)
}

function limparFicha(f: FichaForm): FichaForm {
  const base = { ...f }
  if (f.tipo === 'protese') {
    Object.assign(base, {
      lateralidade: '', especificacoes: [], compensacao_lado: '', compensacao_medida: '', tamanho_calcado: '',
      medidas_ml: '', nome_na_ortese: false, tema: '', cor_forro: '', cor_tira: '',
    })
  } else {
    Object.assign(base, { protese_membro: '', protese_nivel: '', protese_lado: '', liner: '', tamanho_pe: '' })
  }
  if (!base.compensacao_lado) base.compensacao_medida = ''
  return base
}

export function toPayload(v: AtendimentoForm) {
  const { com_ficha, ficha, ...dados } = v
  return {
    dados: {
      ...dados,
      valor: parseBRL(dados.valor),
      valor_pago: parseBRL(dados.valor_pago),
      // Parcelas só valem para crédito e boleto.
      pagamento_parcelas: (dados.pagamento_forma === 'credito' || dados.pagamento_forma === 'boleto') && dados.pagamento_parcelas ? dados.pagamento_parcelas : '',
    },
    ficha: com_ficha ? { ...limparFicha(ficha), medidas: medidasDaFicha(ficha) } : null,
  }
}
