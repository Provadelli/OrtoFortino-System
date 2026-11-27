import { ageFrom, formatAge, formatCep, formatCnpj, formatCpf, formatIsoDate, formatPhone, onlyDigits } from '@/lib/br'
import { EMPRESA_PADRAO, emitente, rodapeEmpresa, type Empresa } from '@/lib/empresa'
import { formatBRL } from '@/lib/format'
import { agruparSecoes } from '../calc'
import type { StatusOrcamento } from '../constants'

/** O mínimo do orçamento que o PDF precisa (vem de useOrcamento). */
export type OrcamentoParaPdf = {
  numero: string
  status: StatusOrcamento
  data_emissao: string
  validade: string
  aprovado_em: string | null
  desconto_tipo: 'valor' | 'percentual'
  desconto: number
  subtotal: number
  desconto_valor: number
  total: number
  condicoes_pagamento: string | null
  prazo_entrega: string | null
  observacoes: string | null
  pacientes: {
    nome: string
    tipo_documento?: string | null
    cpf?: string | null
    cnpj?: string | null
    data_nascimento: string | null
    telefone: string | null
    cep?: string | null
    endereco?: string | null
    cidade?: string | null
    uf?: string | null
    responsaveis?: { nome: string; cpf: string | null; telefone: string | null; parentesco: string | null; principal: boolean }[] | null
  } | null
  orcamento_itens: { secao: string | null; descricao: string; detalhe: string | null; quantidade: number; unidade: string; preco_unitario: number; total: number }[]
}

const qtd = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
const pct = (n: number) => `${n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`

/** "ORC-2026-0012 - Helena Ribeiro.pdf" (sem caracteres proibidos em nomes de arquivo). */
export function nomeArquivoPdf(numero: string, paciente: string | undefined) {
  const nome = (paciente ?? '').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim()
  return `${numero}${nome ? ` - ${nome}` : ''}.pdf`
}

/** "Rua X, 10 - Centro · Niterói/RJ · CEP 24.000-000" (partes vazias são omitidas). */
export function enderecoPdf(p: { cep?: string | null; endereco?: string | null; cidade?: string | null; uf?: string | null }) {
  const cidadeUf = [p.cidade?.trim(), p.uf?.trim()].filter(Boolean).join('/')
  const cep = p.cep && onlyDigits(p.cep).length === 8 ? `CEP ${formatCep(p.cep)}` : ''
  const partes = [p.endereco?.trim(), cidadeUf, cep].filter(Boolean)
  return partes.length ? partes.join(' · ') : null
}

/** Converte o orçamento no conteúdo pronto do PDF (textos já formatados). */
export function dadosPdf(o: OrcamentoParaPdf, hoje = new Date(), empresa: Empresa = EMPRESA_PADRAO) {
  const p = o.pacientes
  const idade = ageFrom(p?.data_nascimento, hoje)
  const menor = idade !== null && idade < 18
  // Regra da Fase 1: paciente menor de idade sai com o responsável principal.
  const resp = menor ? ((p?.responsaveis ?? []).find((r) => r.principal) ?? p?.responsaveis?.[0] ?? null) : null

  const secoes = agruparSecoes(o.orcamento_itens.map((i) => ({ secao: i.secao ?? '' }))).map((s) => {
    const itens = s.indices.map((i) => o.orcamento_itens[i]!)
    return {
      nome: s.nome,
      subtotal: formatBRL(itens.reduce((a, i) => a + i.total, 0)),
      itens: itens.map((i) => ({
        descricao: i.descricao,
        detalhe: i.detalhe,
        quantidade: `${qtd(i.quantidade)} ${i.unidade}`,
        unitario: formatBRL(i.preco_unitario),
        total: formatBRL(i.total),
      })),
    }
  })

  const aviso =
    o.status === 'rascunho'
      ? 'Rascunho: valores sujeitos a alteração'
      : o.status === 'substituido'
        ? 'Versão substituída por uma mais recente'
        : o.status === 'recusado'
          ? 'Orçamento recusado'
          : o.status === 'aprovado'
            ? `Aprovado${o.aprovado_em ? ` em ${formatIsoDate(o.aprovado_em)}` : ''}`
            : null

  return {
    numero: o.numero,
    emissao: formatIsoDate(o.data_emissao),
    validade: formatIsoDate(o.validade),
    aviso,
    aprovado: o.status === 'aprovado',
    paciente: p
      ? {
          nome: p.nome,
          idade: p.data_nascimento ? `${formatAge(idade)} (nasc. ${formatIsoDate(p.data_nascimento)})` : null,
          documento: p.tipo_documento === 'cnpj' ? (p.cnpj ? `CNPJ ${formatCnpj(p.cnpj)}` : null) : p.cpf ? `CPF ${formatCpf(p.cpf)}` : null,
          telefone: p.telefone ? formatPhone(p.telefone) : null,
          endereco: enderecoPdf(p),
        }
      : null,
    responsavel: resp
      ? {
          nome: resp.nome,
          parentesco: resp.parentesco,
          cpf: resp.cpf ? formatCpf(resp.cpf) : null,
          telefone: resp.telefone ? formatPhone(resp.telefone) : null,
        }
      : null,
    secoes,
    mostrarSubtotais: secoes.length > 1,
    subtotal: formatBRL(o.subtotal),
    desconto:
      o.desconto_valor > 0
        ? { rotulo: o.desconto_tipo === 'percentual' ? `Desconto (${pct(o.desconto)})` : 'Desconto', valor: `− ${formatBRL(o.desconto_valor)}` }
        : null,
    total: formatBRL(o.total),
    condicoes: o.condicoes_pagamento,
    prazo: o.prazo_entrega,
    observacoes: o.observacoes,
    arquivo: nomeArquivoPdf(o.numero, p?.nome),
    empresa: { ...emitente(empresa), ...rodapeEmpresa(empresa) },
  }
}

export type DadosPdf = ReturnType<typeof dadosPdf>
