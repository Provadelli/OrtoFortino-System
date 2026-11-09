import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/Button'
import { Field, PasswordField } from '@/components/ui/Field'
import { usePageTitle } from '@/lib/usePageTitle'
import { AuthError, login, refresh } from './auth-client'
import { AuthLayout, FormAlert } from './AuthLayout'
import { loginSchema, type LoginInput } from './schemas'
import { safeNext } from './safe-next'

const preloadDashboard = () => import('@/features/dashboard/DashboardPage')

export default function LoginPage() {
  usePageTitle('Entrar')
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))
  const [serverError, setServerError] = useState<string | null>(null)
  const expired = params.get('motivo') === 'sessao-expirada'

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', remember: true },
  })

  useEffect(() => {
    // Já tem sessão válida (cookie)? Vai direto ao painel.
    let alive = true
    void refresh().then((s) => {
      if (alive && s) navigate(next, { replace: true })
    })
    // Pré-carrega o painel quando o navegador estiver ocioso.
    const idle = window.requestIdleCallback?.(() => void preloadDashboard()) ?? window.setTimeout(() => void preloadDashboard(), 1500)
    return () => {
      alive = false
      if (window.cancelIdleCallback) window.cancelIdleCallback(idle)
      else window.clearTimeout(idle)
    }
  }, [navigate, next])

  const onSubmit = handleSubmit(async ({ email, password, remember }) => {
    setServerError(null)
    try {
      await login(email, password, remember)
      navigate(next, { replace: true, viewTransition: true })
    } catch (err) {
      if (err instanceof AuthError && err.status === 429) {
        const min = Math.max(1, Math.ceil((err.retryAfter ?? 900) / 60))
        setServerError(`Muitas tentativas. Por segurança, aguarde ${min} minuto${min > 1 ? 's' : ''} e tente de novo.`)
      } else if (err instanceof AuthError && err.status === 401) {
        setServerError('E-mail ou senha incorretos. Confira e tente de novo.')
      } else {
        setServerError('Não conseguimos conectar agora. Verifique sua internet e tente de novo.')
      }
    }
  })

  return (
    <AuthLayout>
      <form noValidate onSubmit={onSubmit} className="flex w-full max-w-[400px] flex-col gap-[22px] animate-rise" aria-labelledby="titulo-login">
        <div className="flex flex-col gap-2">
          <h1 id="titulo-login" className="m-0 text-[34px] leading-[1.15] font-bold">
            Entrar
          </h1>
          <p className="m-0 text-base text-muted">Acesso restrito à equipe Orto Fortino.</p>
        </div>

        {expired && !serverError && <FormAlert tone="success">Sua sessão terminou. Entre de novo para continuar.</FormAlert>}
        {serverError && <FormAlert>{serverError}</FormAlert>}

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

        <PasswordField label="Senha" autoComplete="current-password" placeholder="Sua senha" error={errors.password?.message} {...register('password')} />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-[15px] text-ink">
            <input type="checkbox" className="m-0 size-5 cursor-pointer accent-primary" {...register('remember')} />
            Lembrar de mim
          </label>
          <Link
            to="/esqueci-senha"
            className="inline-flex min-h-11 items-center text-[15px] font-semibold text-link-pink no-underline hover:text-link-pink-hover hover:underline"
          >
            Esqueci minha senha
          </Link>
        </div>

        <Button type="submit" size="lg" loading={isSubmitting}>
          {isSubmitting ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>
    </AuthLayout>
  )
}
