/**
 * Desativa a verificação em duas etapas de um usuário que perdeu o celular ou o app.
 * Uso: npm run user:reset-mfa
 * Lê SUPABASE_URL e SUPABASE_SECRET_KEY do .env.local. Depois disso o usuário entra
 * só com a senha e pode reativar em Configurações com um app novo.
 */
import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const secret = process.env.SUPABASE_SECRET_KEY
if (!url || !secret) {
  console.error('Defina SUPABASE_URL e SUPABASE_SECRET_KEY no .env.local')
  process.exit(1)
}

const rl = createInterface({ input: stdin, output: stdout })
const email = (await rl.question('E-mail do usuário: ')).trim().toLowerCase()

const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } })

// Equipe pequena (1 a 2 pessoas): a primeira página da listagem basta.
const { data: lista, error: erroLista } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
if (erroLista) {
  console.error('Erro:', erroLista.message)
  process.exit(1)
}
const user = lista.users.find((u) => u.email?.toLowerCase() === email)
if (!user) {
  console.error('Nenhum usuário com esse e-mail.')
  process.exit(1)
}

const fatores = user.factors ?? []
if (fatores.length === 0) {
  console.log('Este usuário não tem verificação em duas etapas ativa. Nada a fazer.')
  rl.close()
  process.exit(0)
}

const ok = (await rl.question(`Desativar a verificação em duas etapas de ${user.email}? (s/N) `)).trim().toLowerCase()
rl.close()
if (ok !== 's') {
  console.log('Cancelado.')
  process.exit(0)
}

for (const f of fatores) {
  const { error } = await admin.auth.admin.mfa.deleteFactor({ id: f.id, userId: user.id })
  if (error) {
    console.error('Erro ao remover o autenticador:', error.message)
    process.exit(1)
  }
}
console.log(`Verificação em duas etapas desativada para ${user.email}. Peça para entrar de novo e reativar em Configurações.`)
