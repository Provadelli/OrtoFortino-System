/** Cada área do sistema tem uma cor de giz (ver [data-secao] em index.css). */
export type Secao = 'painel' | 'clientes' | 'atendimentos' | 'orcamentos' | 'precos' | 'config'

const PREFIXOS: [string, Secao][] = [
  ['/clientes', 'clientes'],
  ['/atendimentos', 'atendimentos'],
  ['/orcamentos', 'orcamentos'],
  ['/tabela-de-precos', 'precos'],
  ['/configuracoes', 'config'],
]

export function secaoDe(caminho: string): Secao {
  return PREFIXOS.find(([p]) => caminho === p || caminho.startsWith(p + '/'))?.[1] ?? 'painel'
}
