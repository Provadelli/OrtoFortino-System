import * as z from 'zod/mini'
import { isValidCpf, onlyDigits } from '@/lib/br'

export const ORIGENS = [
  { value: 'particular', label: 'Particular' },
  { value: 'clinica', label: 'Clínica' },
  { value: 'plano', label: 'Plano de saúde' },
] as const
export type Origem = (typeof ORIGENS)[number]['value']

export const origemLabel = (o: string) => ORIGENS.find((x) => x.value === o)?.label ?? o

const opcional = (max: number, msg = `Use no máximo ${max} caracteres.`) => z.string().check(z.trim(), z.maxLength(max, msg))

const cpfOpcional = z.string().check(
  z.refine((v) => v.trim() === '' || isValidCpf(v), 'CPF inválido. Confira os 11 números.'),
)
const telefoneOpcional = z.string().check(
  z.refine((v) => {
    const d = onlyDigits(v)
    return d.length === 0 || d.length === 10 || d.length === 11
  }, 'Telefone com DDD, como (21) 96497-3837.'),
)

export const responsavelSchema = z.object({
  id: z.optional(z.string()),
  nome: z.string().check(z.trim(), z.minLength(2, 'Informe o nome do responsável.'), z.maxLength(160)),
  cpf: cpfOpcional,
  telefone: telefoneOpcional,
  parentesco: opcional(60),
  principal: z.boolean(),
})

export const pacienteSchema = z
  .object({
    nome: z.string().check(z.trim(), z.minLength(2, 'Informe o nome completo do paciente.'), z.maxLength(160)),
    cpf: cpfOpcional,
    data_nascimento: z.string().check(
      z.refine((v) => v === '' || (v >= '1900-01-01' && v <= new Date().toISOString().slice(0, 10)), 'Data de nascimento inválida.'),
    ),
    telefone: telefoneOpcional,
    cep: z.string().check(z.refine((v) => [0, 8].includes(onlyDigits(v).length), 'CEP incompleto: são 8 números.')),
    endereco: opcional(240),
    cidade: opcional(120),
    uf: z.string(),
    origem: z.enum(['particular', 'clinica', 'plano']),
    origem_nome: opcional(160),
    medico: opcional(160),
    diagnostico: opcional(2000),
    observacoes: opcional(4000),
    consentimento: z.boolean(),
    responsaveis: z.array(responsavelSchema),
  })
  .check(
    z.refine((v) => v.origem === 'particular' || v.origem_nome.trim().length >= 2, {
      path: ['origem_nome'],
      message: 'Informe o nome da clínica ou da operadora.',
    }),
  )

export type PacienteForm = z.infer<typeof pacienteSchema>
export type ResponsavelForm = z.infer<typeof responsavelSchema>

export const pacienteVazio: PacienteForm = {
  nome: '',
  cpf: '',
  data_nascimento: '',
  telefone: '',
  cep: '',
  endereco: '',
  cidade: '',
  uf: 'RJ',
  origem: 'particular',
  origem_nome: '',
  medico: '',
  diagnostico: '',
  observacoes: '',
  consentimento: false,
  responsaveis: [],
}

/** Formulário → payload do banco (só dígitos em CPF/telefone). */
export function toPayload(v: PacienteForm) {
  const { responsaveis, ...dados } = v
  return {
    dados: {
      ...dados,
      cpf: onlyDigits(dados.cpf),
      telefone: onlyDigits(dados.telefone),
      cep: onlyDigits(dados.cep),
      origem_nome: dados.origem === 'particular' ? '' : dados.origem_nome,
    },
    responsaveis: responsaveis.map((r) => ({ ...r, cpf: onlyDigits(r.cpf), telefone: onlyDigits(r.telefone) })),
  }
}
