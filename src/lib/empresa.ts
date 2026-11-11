import { formatCep, formatCnpj, formatPhone } from './br'

/**
 * Dados da empresa como ficam guardados em `configuracoes` (números só com dígitos).
 * Editáveis em Configurações; estes valores são o reserva enquanto a tabela não carrega
 * (ex.: rodapé do login, antes de qualquer sessão).
 */
export type Empresa = {
  nome: string
  slogan: string | null
  cnpj: string | null
  endereco: string | null
  cidade: string | null
  cep: string | null
  telefone: string | null
  email: string | null
}

export const EMPRESA_PADRAO: Empresa = {
  nome: 'Orto Fortino',
  slogan: 'Órteses Funcionais',
  cnpj: '34130423000148',
  endereco: 'Rua Itapicuru, 151, Quadra B Lote 40 - Bairro Kennedy',
  cidade: 'Nova Iguaçu - RJ',
  cep: '26020560',
  telefone: '21964973837',
  email: 'ortofortino@hotmail.com',
}

/** Linhas do rodapé dos documentos, já formatadas e sem partes vazias. */
export function rodapeEmpresa(e: Empresa) {
  const junta = (partes: (string | null | undefined)[]) => partes.filter((p) => p && p.trim()).join(' · ')
  return {
    linha1: junta([e.nome, e.slogan, e.cnpj ? `CNPJ ${formatCnpj(e.cnpj)}` : null]),
    linha2: junta([
      [e.endereco, e.cidade].filter((p) => p && p.trim()).join(', ') || null,
      e.cep ? `CEP ${formatCep(e.cep)}` : null,
      e.telefone ? formatPhone(e.telefone) : null,
      e.email,
    ]),
  }
}
