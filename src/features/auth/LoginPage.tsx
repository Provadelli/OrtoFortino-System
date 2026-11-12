import { useEffect, useState, type CSSProperties } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/Button'
import { Field, PasswordField } from '@/components/ui/Field'
import { cn } from '@/lib/cn'
import { linkSuporte } from '@/lib/suporte'
import { RabiscoTracado } from '@/components/ui/Rabisco'
import { usePageTitle } from '@/lib/usePageTitle'
import { AuthError, login, loginMfa, refresh } from './auth-client'
import { AuthLayout, FormAlert } from './AuthLayout'
import { limparCodigo, loginSchema, mfaCodeSchema, type LoginInput, type MfaCodeInput } from './schemas'
import { safeNext } from './safe-next'

const preloadDashboard = () => import('@/features/dashboard/DashboardPage')

export default function LoginPage() {
  usePageTitle('Entrar')
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))
  const [serverError, setServerError] = useState<string | null>(null)
  const expired = params.get('motivo') === 'sessao-expirada'
  const senhaAlterada = params.get('motivo') === 'senha-alterada'
  // Quem ativou o autenticador passa por uma 2ª etapa: o código de 6 dígitos.
  const [etapa, setEtapa] = useState<'senha' | 'codigo'>('senha')

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
      if ((await login(email, password, remember)) === 'mfa') {
        setEtapa('codigo')
        return
      }
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

  if (etapa === 'codigo')
    return (
      <AuthLayout>
        <EtapaCodigo
          onEntrou={() => navigate(next, { replace: true, viewTransition: true })}
          onVoltar={(msg) => {
            setServerError(msg)
            setEtapa('senha')
          }}
        />
      </AuthLayout>
    )

  return (
    <AuthLayout>
      <form noValidate onSubmit={onSubmit} className="flex w-full max-w-[400px] flex-col gap-[22px]" aria-labelledby="titulo-login">
        <div className="flex flex-col gap-2 animate-rise">
          <h1 id="titulo-login" className="m-0 text-[34px] leading-[1.15] font-bold">
            Entrar
          </h1>
          <RabiscoTracado forma="sublinhado" cor="var(--color-giz-rosa)" atraso={450} duracao={450} className="-mt-1 h-3.5 w-24" />
          <p className="m-0 text-base text-muted">Acesso restrito à equipe Orto Fortino.</p>
        </div>

        {expired && !serverError && <FormAlert tone="success">Sua sessão terminou. Entre de novo para continuar.</FormAlert>}
        {senhaAlterada && !serverError && <FormAlert tone="success">Senha alterada. Entre com a nova senha.</FormAlert>}
        {serverError && <FormAlert>{serverError}</FormAlert>}

        <div {...entrada(1)}>
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
        </div>

        <div {...entrada(2)}>
          <PasswordField label="Senha" autoComplete="current-password" placeholder="Sua senha" error={errors.password?.message} {...register('password')} />
        </div>

        <div {...entrada(3, 'flex flex-wrap items-center justify-between gap-3')}>
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

        <Button type="submit" size="lg" loading={isSubmitting} {...entrada(4)}>
          {isSubmitting ? 'Entrando…' : 'Entrar'}
        </Button>

        <p {...entrada(5, 'm-0 text-center text-sm text-muted')}>
          Problemas para entrar?{' '}
          <a href={linkSuporte('/login')} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary-ink underline underline-offset-4">
            Acionar suporte
            <span className="sr-only"> (abre o WhatsApp em nova aba)</span>
          </a>
        </p>
      </form>
    </AuthLayout>
  )
}

/** Entrada escalonada dos blocos do formulário (70 ms entre cada um; nada com "reduzir movimento"). */
const entrada = (i: number, className?: string) => ({
  className: cn('animate-rise stagger', className),
  style: { '--i': i } as CSSProperties,
})

function EtapaCodigo({ onEntrou, onVoltar }: { onEntrou: () => void; onVoltar: (msg: string | null) => void }) {
  usePageTitle('Código de verificação')
  const [serverError, setServerError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setFocus,
    resetField,
    formState: { errors, isSubmitting },
  } = useForm<MfaCodeInput>({
    resolver: zodResolver(mfaCodeSchema),
    defaultValues: { code: '' },
  })

  useEffect(() => setFocus('code'), [setFocus])

  const onSubmit = handleSubmit(async ({ code }) => {
    setServerError(null)
    try {
      await loginMfa(limparCodigo(code))
      onEntrou()
    } catch (err) {
      if (err instanceof AuthError && err.status === 401) return onVoltar(err.message)
      if (err instanceof AuthError && err.status === 429) {
        const min = Math.max(1, Math.ceil((err.retryAfter ?? 900) / 60))
        setServerError(`Muitas tentativas. Por segurança, aguarde ${min} minuto${min > 1 ? 's' : ''} e tente de novo.`)
      } else if (err instanceof AuthError && err.status === 400) {
        setServerError('Código incorreto ou expirado. Confira o app e digite o código atual.')
      } else {
        setServerError('Não conseguimos conectar agora. Verifique sua internet e tente de novo.')
      }
      resetField('code')
      setFocus('code')
    }
  })

  return (
    <form noValidate onSubmit={onSubmit} className="flex w-full max-w-[400px] flex-col gap-[22px] animate-rise" aria-labelledby="titulo-codigo">
      <div className="flex flex-col gap-2">
        <h1 id="titulo-codigo" className="m-0 text-[34px] leading-[1.15] font-bold">
          Verificação em duas etapas
        </h1>
        <p className="m-0 text-base text-muted">Abra o app autenticador no celular e digite o código de 6 números da Orto Fortino.</p>
      </div>

      {serverError && <FormAlert>{serverError}</FormAlert>}

      <Field
        label="Código do autenticador"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={7}
        placeholder="000000"
        className="font-display text-xl tracking-[0.3em] tabular-nums"
        error={errors.code?.message}
        {...register('code')}
      />

      <Button type="submit" size="lg" loading={isSubmitting}>
        {isSubmitting ? 'Confirmando…' : 'Confirmar e entrar'}
      </Button>
      <Button variant="ghost" onClick={() => onVoltar(null)}>
        Voltar e usar outra conta
      </Button>
      <p className="m-0 text-[13px] text-muted">Perdeu o celular ou o app? Fale com o responsável pelo sistema para desativar a verificação da sua conta.</p>
    </form>
  )
}
