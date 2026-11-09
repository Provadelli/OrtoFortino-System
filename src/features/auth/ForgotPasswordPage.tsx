import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from 'react-router'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { ArrowLeftIcon } from '@/components/ui/icons'
import { usePageTitle } from '@/lib/usePageTitle'
import { forgotPassword } from './auth-client'
import { AuthLayout, FormAlert } from './AuthLayout'
import { forgotSchema, type ForgotInput } from './schemas'

export default function ForgotPasswordPage() {
  usePageTitle('Recuperar senha')
  const [sent, setSent] = useState(false)
  const [failed, setFailed] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotInput>({ resolver: zodResolver(forgotSchema), defaultValues: { email: '' } })

  const onSubmit = handleSubmit(async ({ email }) => {
    setFailed(false)
    try {
      await forgotPassword(email)
      setSent(true)
    } catch {
      setFailed(true)
    }
  })

  return (
    <AuthLayout>
      <form noValidate onSubmit={onSubmit} className="flex w-full max-w-[400px] flex-col gap-[22px] animate-rise" aria-labelledby="titulo-recuperar">
        <Link to="/login" className="-ml-1 inline-flex min-h-11 items-center gap-2 self-start text-[15px] font-semibold text-primary-ink no-underline hover:underline">
          <ArrowLeftIcon /> Voltar para o login
        </Link>
        <div className="flex flex-col gap-2">
          <h1 id="titulo-recuperar" className="m-0 text-[34px] leading-[1.15] font-bold">
            Recuperar senha
          </h1>
          <p className="m-0 text-base text-muted">Enviaremos um link para você criar uma nova senha.</p>
        </div>

        {sent ? (
          <FormAlert tone="success">
            Se este e-mail estiver cadastrado, você vai receber o link em alguns minutos. Confira também a caixa de spam.
          </FormAlert>
        ) : (
          <>
            {failed && <FormAlert>Não conseguimos enviar agora. Tente de novo em instantes.</FormAlert>}
            <Field
              label="E-mail"
              type="email"
              inputMode="email"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="voce@ortofortino.com.br"
              error={errors.email?.message}
              {...register('email')}
            />
            <Button type="submit" size="lg" loading={isSubmitting}>
              {isSubmitting ? 'Enviando…' : 'Enviar link'}
            </Button>
          </>
        )}
      </form>
    </AuthLayout>
  )
}
