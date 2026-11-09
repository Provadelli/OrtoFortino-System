// zod/mini: mesma validação, ~85% menor no bundle (importa só o que usa).
import * as z from 'zod/mini'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

const email = z.string().check(
  z.trim(),
  z.minLength(1, 'Informe seu e-mail.'),
  z.maxLength(254, 'E-mail muito longo.'),
  z.regex(EMAIL, 'Digite um e-mail válido, como nome@ortofortino.com.br.'),
)

export const loginSchema = z.object({
  email,
  password: z.string().check(z.minLength(1, 'Informe sua senha.'), z.maxLength(128, 'Senha muito longa.')),
  remember: z.boolean(),
})
export type LoginInput = z.infer<typeof loginSchema>

export const forgotSchema = z.object({ email })
export type ForgotInput = z.infer<typeof forgotSchema>

/** Política de senha: 12+ caracteres, com letras e números. */
export const passwordRule = z.string().check(
  z.minLength(12, 'Use pelo menos 12 caracteres.'),
  z.maxLength(128, 'Use no máximo 128 caracteres.'),
  z.regex(/[a-zA-Z]/, 'Inclua pelo menos uma letra.'),
  z.regex(/\d/, 'Inclua pelo menos um número.'),
)

export const resetSchema = z
  .object({ password: passwordRule, confirm: z.string() })
  .check(z.refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'As senhas não são iguais.' }))
export type ResetInput = z.infer<typeof resetSchema>
