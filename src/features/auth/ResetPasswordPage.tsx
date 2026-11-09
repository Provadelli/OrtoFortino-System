import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/Button'
import { PasswordField } from '@/components/ui/Field'
import { usePageTitle } from '@/lib/usePageTitle'
import { resetPassword } from './auth-client'
import { AuthLayout, FormAlert } from './AuthLayout'
import { resetSchema, type ResetInput } from './schemas'

export default function ResetPasswordPage() {
  usePageTitle('Nova senha')
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const tokenHash = params.get('token_hash') ?? ''
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetInput>({ resolver: zodResolver(resetSchema), defaultValues: { password: '', confirm: '' } })

  const onSubmit = handleSubmit(async ({ password }) => {
    setError(null)
    try {
      await resetPassword(tokenHash, password)
      navigate('/painel', { replace: true })
    } catch {
      setError('Este link expirou ou já foi usado. Peça um novo link de recuperação.')
    }
  })

  return (
    <AuthLayout>
      <form noValidate onSubmit={onSubmit} className="flex w-full max-w-[400px] flex-col gap-[22px] animate-rise" aria-labelledby="titulo-nova">
        <div className="flex flex-col gap-2">
          <h1 id="titulo-nova" className="m-0 text-[34px] leading-[1.15] font-bold">
            Criar nova senha
          </h1>
          <p className="m-0 text-base text-muted">Escolha uma senha forte, que você não usa em outros sites.</p>
        </div>

        {!tokenHash ? (
          <>
            <FormAlert>Link inválido. Abra o link que enviamos por e-mail ou peça um novo.</FormAlert>
            <Link to="/esqueci-senha" className="text-[15px] font-semibold text-primary-ink">
              Pedir novo link
            </Link>
          </>
        ) : (
          <>
            {error && (
              <FormAlert>
                {error}{' '}
                <Link to="/esqueci-senha" className="text-late-fg underline">
                  Pedir novo link
                </Link>
              </FormAlert>
            )}
            <PasswordField
              label="Nova senha"
              autoComplete="new-password"
              hint="Pelo menos 12 caracteres, com letras e números."
              error={errors.password?.message}
              {...register('password')}
            />
            <PasswordField label="Confirme a nova senha" autoComplete="new-password" error={errors.confirm?.message} {...register('confirm')} />
            <Button type="submit" size="lg" loading={isSubmitting}>
              {isSubmitting ? 'Salvando…' : 'Salvar e entrar'}
            </Button>
          </>
        )}
      </form>
    </AuthLayout>
  )
}
