/** Mensagem amigável para uma exclusão que falhou (erros do Postgres/PostgREST ou de rede). */
export function mensagemErroExclusao(err: unknown): string {
  const code = typeof err === 'object' && err !== null && 'code' in err ? String((err as { code: unknown }).code) : ''
  if (code === '42501') return 'Você não tem permissão para excluir isto.'
  if (code === '55000') return 'O registro mudou de situação em outra tela. Atualize a página e tente de novo.'
  if (code === '23503' || code === '23001') return 'Este registro ainda é usado por outros dados e não pôde ser excluído. Atualize a página e tente de novo.'
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'Sem conexão com a internet. Confira a rede e tente de novo.'
  return 'Não foi possível excluir agora. Tente de novo.'
}

/** Compara o texto digitado com o esperado, ignorando caixa, acentos e espaços nas pontas. */
export function textoConfere(digitado: string, esperado: string): boolean {
  const norm = (s: string) =>
    s
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase()
  return norm(digitado) === norm(esperado)
}
