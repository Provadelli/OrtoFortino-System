import { handler, json } from './_lib/http.js'
import { adminClient } from './_lib/supabase.js'

/**
 * Dados públicos da empresa (nome e telefone) para o rodapé das telas de login,
 * que abrem antes de existir sessão. Só esses dois campos saem daqui.
 */
export const GET = handler(async () => {
  const { data, error } = await adminClient().from('configuracoes').select('empresa_nome, empresa_telefone').eq('id', true).maybeSingle()
  if (error || !data) return json({ nome: null, telefone: null })
  return json({ nome: data.empresa_nome, telefone: data.empresa_telefone }, 200, { 'Cache-Control': 'public, max-age=300' })
})
