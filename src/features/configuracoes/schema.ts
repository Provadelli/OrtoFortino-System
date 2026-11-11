import * as z from 'zod/mini'
import { formatCep, formatCnpj, formatPhone, isValidCnpj, onlyDigits } from '@/lib/br'
import type { Database } from '@/lib/database.types'

export type Configuracoes = Database['public']['Tables']['configuracoes']['Row']
export type ConfiguracoesUpdate = Database['public']['Tables']['configuracoes']['Update']

const opcional = (max: number) => z.string().check(z.trim(), z.maxLength(max, `Use no máximo ${max} caracteres.`))
const vazioOu = (ok: (v: string) => boolean, msg: string) => z.string().check(z.trim(), z.refine((v) => v === '' || ok(v), msg))
const nulo = (v: string) => (v.trim() === '' ? null : v.trim())
const digitos = (v: string) => (onlyDigits(v) === '' ? null : onlyDigits(v))

// ───── Empresa ─────
export const empresaSchema = z.object({
  empresa_nome: z.string().check(z.trim(), z.minLength(2, 'Informe o nome da empresa.'), z.maxLength(80, 'Use no máximo 80 caracteres.')),
  empresa_slogan: opcional(80),
  empresa_cnpj: vazioOu(isValidCnpj, 'CNPJ inválido. Confira os números.'),
  empresa_endereco: opcional(160),
  empresa_cidade: opcional(80),
  empresa_cep: vazioOu((v) => onlyDigits(v).length === 8, 'O CEP tem 8 números.'),
  empresa_telefone: vazioOu((v) => [10, 11].includes(onlyDigits(v).length), 'Telefone com DDD, como (21) 96497-3837.'),
  empresa_email: vazioOu((v) => v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v), 'Digite um e-mail válido.'),
})
export type EmpresaForm = z.infer<typeof empresaSchema>

export const empresaForm = (c: Configuracoes): EmpresaForm => ({
  empresa_nome: c.empresa_nome,
  empresa_slogan: c.empresa_slogan ?? '',
  empresa_cnpj: formatCnpj(c.empresa_cnpj ?? ''),
  empresa_endereco: c.empresa_endereco ?? '',
  empresa_cidade: c.empresa_cidade ?? '',
  empresa_cep: formatCep(c.empresa_cep ?? ''),
  empresa_telefone: formatPhone(c.empresa_telefone ?? ''),
  empresa_email: c.empresa_email ?? '',
})

export const empresaPayload = (v: EmpresaForm): ConfiguracoesUpdate => ({
  empresa_nome: v.empresa_nome.trim(),
  empresa_slogan: nulo(v.empresa_slogan),
  empresa_cnpj: digitos(v.empresa_cnpj),
  empresa_endereco: nulo(v.empresa_endereco),
  empresa_cidade: nulo(v.empresa_cidade),
  empresa_cep: digitos(v.empresa_cep),
  empresa_telefone: digitos(v.empresa_telefone),
  empresa_email: nulo(v.empresa_email)?.toLowerCase() ?? null,
})

// ───── Padrões do orçamento ─────
export const padroesSchema = z.object({
  orc_validade_dias: z.string().check(
    z.trim(),
    z.refine((v) => /^\d{1,3}$/.test(v) && Number(v) >= 1 && Number(v) <= 365, 'Use um número de 1 a 365 dias.'),
  ),
  orc_condicoes_pagamento: opcional(400),
  orc_prazo_entrega: opcional(120),
  orc_observacoes: opcional(4000),
})
export type PadroesForm = z.infer<typeof padroesSchema>

export const padroesForm = (c: Configuracoes): PadroesForm => ({
  orc_validade_dias: String(c.orc_validade_dias),
  orc_condicoes_pagamento: c.orc_condicoes_pagamento ?? '',
  orc_prazo_entrega: c.orc_prazo_entrega ?? '',
  orc_observacoes: c.orc_observacoes ?? '',
})

export const padroesPayload = (v: PadroesForm): ConfiguracoesUpdate => ({
  orc_validade_dias: Number(v.orc_validade_dias),
  orc_condicoes_pagamento: nulo(v.orc_condicoes_pagamento),
  orc_prazo_entrega: nulo(v.orc_prazo_entrega),
  orc_observacoes: nulo(v.orc_observacoes),
})

// ───── Listas da ficha ─────
export const MAX_ITENS_LISTA = 80
export const MAX_TEXTO_ITEM = 80

/** Valida um item novo da lista; devolve a mensagem de erro ou null. */
export function erroItemLista(item: string, lista: string[]) {
  const v = item.trim()
  if (!v) return 'Digite o texto do item.'
  if (v.length > MAX_TEXTO_ITEM) return `Use no máximo ${MAX_TEXTO_ITEM} caracteres.`
  if (lista.some((x) => x.localeCompare(v, 'pt-BR', { sensitivity: 'base' }) === 0)) return 'Este item já está na lista.'
  if (lista.length >= MAX_ITENS_LISTA) return `A lista aceita até ${MAX_ITENS_LISTA} itens.`
  return null
}

/** Move o item `i` uma posição para cima (-1) ou para baixo (+1). */
export function moverItem<T>(lista: T[], i: number, direcao: -1 | 1) {
  const j = i + direcao
  if (j < 0 || j >= lista.length) return lista
  const nova = [...lista]
  ;[nova[i], nova[j]] = [nova[j]!, nova[i]!]
  return nova
}

// ───── Minha conta ─────
export const nomeSchema = z.object({
  nome: z.string().check(z.trim(), z.minLength(2, 'Informe seu nome.'), z.maxLength(80, 'Use no máximo 80 caracteres.')),
})
export type NomeForm = z.infer<typeof nomeSchema>
