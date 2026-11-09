/**
 * Cria um usuário da equipe (não existe cadastro público).
 * Uso: npm run user:create
 * Lê SUPABASE_URL e SUPABASE_SECRET_KEY do .env.local. A senha é digitada sem eco
 * e nunca fica no histórico do terminal.
 */
import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import { createClient } from '@supabase/supabase-js'
import { passwordRule } from '../src/features/auth/schemas.ts'

const url = process.env.SUPABASE_URL
const secret = process.env.SUPABASE_SECRET_KEY
if (!url || !secret) {
  console.error('Defina SUPABASE_URL e SUPABASE_SECRET_KEY no .env.local')
  process.exit(1)
}

const rl = createInterface({ input: stdin, output: stdout })
const email = (await rl.question('E-mail: ')).trim()
const nome = (await rl.question('Nome (exibido no painel): ')).trim()

// Lê a senha sem mostrar na tela
async function askHidden(q: string) {
  const out = rl as unknown as { _writeToOutput: (s: string) => void; output: NodeJS.WriteStream }
  const original = out._writeToOutput
  out._writeToOutput = (s: string) => {
    if (s.startsWith(q)) out.output.write(q)
    else out.output.write('*')
  }
  const answer = await rl.question(q)
  out._writeToOutput = original
  stdout.write('\n')
  return answer
}

const password = await askHidden('Senha (12+ caracteres, letras e números): ')
rl.close()

const check = passwordRule.safeParse(password)
if (!check.success) {
  console.error('Senha fraca:', check.error.issues.map((i) => i.message).join(' '))
  process.exit(1)
}

const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } })
const { data, error } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { nome },
})
if (error) {
  console.error('Erro:', error.message)
  process.exit(1)
}
console.log(`Usuário criado: ${data.user.email} (${data.user.id})`)
