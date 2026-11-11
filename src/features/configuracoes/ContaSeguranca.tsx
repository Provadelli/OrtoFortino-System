import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/Button'
import { Field, PasswordField } from '@/components/ui/Field'
import { Section } from '@/components/ui/FormControls'
import { ShieldIcon } from '@/components/ui/icons'
import { StatusChip } from '@/components/ui/StatusChip'
import { alterarNome, alterarSenha, AuthError, mfaAtivar, mfaDesativar, mfaIniciar, type NovoAutenticador } from '@/features/auth/auth-client'
import { limparCodigo, mfaCodeSchema, trocarSenhaSchema, type MfaCodeInput, type TrocarSenhaInput } from '@/features/auth/schemas'
import { useSession } from '@/features/auth/useSession'
import { Retorno, Rodape } from './Retorno'
import { nomeSchema, type NomeForm } from './schema'

/** Mensagem amigável para os erros do BFF. */
function mensagem(err: unknown) {
  if (err instanceof AuthError) {
    if (err.status === 429) {
      const min = Math.max(1, Math.ceil((err.retryAfter ?? 900) / 60))
      return `Muitas tentativas. Por segurança, aguarde ${min} minuto${min > 1 ? 's' : ''} e tente de novo.`
    }
    if (err.status < 500) return err.message
  }
  return 'Não foi possível concluir agora. Verifique sua conexão e tente de novo.'
}

// ───── Minha conta ─────

export function ContaSection() {
  const session = useSession()
  const email = session?.user.email ?? ''
  return (
    <Section id="sec-conta" title="Minha conta" description={email ? `Você entra com ${email}.` : undefined}>
      <NomeForm nome={session?.user.nome ?? ''} />
      <div className="border-t border-line-soft" />
      <SenhaForm email={email} />
    </Section>
  )
}

function NomeForm({ nome }: { nome: string }) {
  const [ok, setOk] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<NomeForm>({ resolver: zodResolver(nomeSchema), defaultValues: { nome }, mode: 'onTouched' })

  const onSubmit = handleSubmit(async ({ nome: novo }) => {
    setOk(null)
    setErro(null)
    try {
      await alterarNome(novo.trim())
      reset({ nome: novo.trim() })
      setOk('Nome atualizado.')
    } catch (err) {
      setErro(mensagem(err))
    }
  })

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4" aria-labelledby="titulo-nome">
      <h3 id="titulo-nome" className="m-0 text-base font-semibold">
        Nome exibido
      </h3>
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-[min(100%,280px)] flex-1">
          <Field label="Seu nome" autoComplete="name" hint="Aparece no menu, ao lado do botão Sair." error={errors.nome?.message} {...register('nome')} />
        </div>
        <Button type="submit" variant="outline" className="mt-[30px] h-[50px]" loading={isSubmitting} disabled={!isDirty}>
          {isSubmitting ? 'Salvando…' : 'Salvar nome'}
        </Button>
      </div>
      <Retorno ok={ok} erro={erro} />
    </form>
  )
}

function SenhaForm({ email }: { email: string }) {
  const navigate = useNavigate()
  const [ok, setOk] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<TrocarSenhaInput>({ resolver: zodResolver(trocarSenhaSchema), defaultValues: { atual: '', nova: '', confirmar: '' }, mode: 'onTouched' })

  const onSubmit = handleSubmit(async ({ atual, nova }) => {
    setOk(null)
    setErro(null)
    try {
      if ((await alterarSenha(atual, nova)) === 'relogin') {
        navigate('/login?motivo=senha-alterada', { replace: true })
        return
      }
      reset()
      setOk('Senha alterada. Se você estava conectado em outro aparelho, entre de novo por lá.')
    } catch (err) {
      if (err instanceof AuthError && err.status === 400 && /atual/i.test(err.message)) {
        setError('atual', { message: err.message }, { shouldFocus: true })
      } else {
        setErro(mensagem(err))
      }
    }
  })

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4" aria-labelledby="titulo-senha">
      <div className="flex flex-col gap-1">
        <h3 id="titulo-senha" className="m-0 text-base font-semibold">
          Trocar senha
        </h3>
        <p className="m-0 text-sm text-muted">Pelo menos 12 caracteres, com letras e números. As sessões em outros aparelhos são encerradas.</p>
      </div>
      {/* Ajuda gerenciadores de senha a salvar a senha nova para o e-mail certo. */}
      <input type="text" name="username" autoComplete="username" value={email} readOnly hidden />
      <div className="grid gap-5 sm:grid-cols-3">
        <PasswordField label="Senha atual" autoComplete="current-password" error={errors.atual?.message} {...register('atual')} />
        <PasswordField label="Nova senha" autoComplete="new-password" error={errors.nova?.message} {...register('nova')} />
        <PasswordField label="Repita a nova senha" autoComplete="new-password" error={errors.confirmar?.message} {...register('confirmar')} />
      </div>
      <Retorno ok={ok} erro={erro} />
      <Rodape>
        <Button type="submit" loading={isSubmitting}>
          {isSubmitting ? 'Salvando…' : 'Trocar senha'}
        </Button>
      </Rodape>
    </form>
  )
}

// ───── Segurança: verificação em duas etapas ─────

export function SegurancaSection() {
  const session = useSession()
  const ativa = !!session?.user.mfa
  const [novo, setNovo] = useState<NovoAutenticador | null>(null)
  const [desativando, setDesativando] = useState(false)
  const [ok, setOk] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [iniciando, setIniciando] = useState(false)

  async function iniciar() {
    setOk(null)
    setErro(null)
    setIniciando(true)
    try {
      setNovo(await mfaIniciar())
    } catch (err) {
      setErro(mensagem(err))
    } finally {
      setIniciando(false)
    }
  }

  return (
    <Section
      id="sec-seguranca"
      title="Verificação em duas etapas"
      description="Além da senha, o login pede um código de 6 números gerado por um app no seu celular. Recomendado: o sistema guarda dados de saúde."
    >
      <div className="flex flex-wrap items-center gap-3">
        <ShieldIcon className={ativa ? 'text-primary' : 'text-muted'} />
        <span className="text-[15px] font-semibold">Situação:</span>
        <StatusChip tone={ativa ? 'prod' : 'draft'} size="md">
          {ativa ? 'Ativa' : 'Desativada'}
        </StatusChip>
      </div>

      {!ativa && !novo && (
        <Rodape>
          <Button loading={iniciando} onClick={() => void iniciar()}>
            {iniciando ? 'Preparando…' : 'Ativar verificação em duas etapas'}
          </Button>
        </Rodape>
      )}

      {!ativa && novo && (
        <Ativacao
          novo={novo}
          onCancelar={() => setNovo(null)}
          onAtivada={() => {
            setNovo(null)
            setOk('Verificação em duas etapas ativada. Nos próximos logins, tenha o celular por perto. As sessões em outros aparelhos foram encerradas.')
          }}
        />
      )}

      {ativa && !desativando && (
        <Rodape>
          <Button
            variant="outline"
            onClick={() => {
              setOk(null)
              setDesativando(true)
            }}
          >
            Desativar
          </Button>
        </Rodape>
      )}

      {ativa && desativando && (
        <CodigoForm
          titulo="Desativar a verificação em duas etapas"
          texto="Para confirmar que é você, digite o código atual do app autenticador."
          acao="Desativar"
          perigo
          onCancelar={() => setDesativando(false)}
          onEnviar={async (code) => {
            await mfaDesativar(code)
            setDesativando(false)
            setOk('Verificação em duas etapas desativada. Você pode apagar a conta “Orto Fortino” do app autenticador.')
          }}
        />
      )}

      <Retorno ok={ok} erro={erro} />
    </Section>
  )
}

function Ativacao({ novo, onCancelar, onAtivada }: { novo: NovoAutenticador; onCancelar: () => void; onAtivada: () => void }) {
  const titulo = useRef<HTMLHeadingElement>(null)
  const [copiado, setCopiado] = useState(false)
  const chave = novo.secret.replace(/(.{4})/g, '$1 ').trim()

  useEffect(() => titulo.current?.focus(), [])

  async function copiar() {
    try {
      await navigator.clipboard.writeText(novo.secret)
      setCopiado(true)
    } catch {
      setCopiado(false)
    }
  }

  return (
    <div className="flex flex-col gap-5 rounded-card border border-line bg-surface p-5 animate-rise">
      <h3 ref={titulo} tabIndex={-1} className="m-0 text-base font-semibold outline-none">
        Ativar em 3 passos
      </h3>
      <ol className="m-0 flex list-decimal flex-col gap-5 pl-5 text-[15px] leading-relaxed marker:font-semibold marker:text-primary-ink">
        <li>
          Instale um app autenticador no celular, como <strong>Google Authenticator</strong>, <strong>Microsoft Authenticator</strong> ou{' '}
          <strong>2FAS</strong>.
        </li>
        <li className="flex flex-col gap-3">
          <span>No app, toque em adicionar conta e aponte a câmera para o QR code.</span>
          <img src={novo.qrCode} alt="QR code para adicionar a Orto Fortino ao app autenticador" width={184} height={184} className="size-[184px] rounded-field border border-line bg-white p-2" />
          <span className="text-sm text-muted">
            Sem câmera? Digite esta chave no app:{' '}
            <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[14px] break-all text-ink">{chave}</code>{' '}
            <button type="button" onClick={() => void copiar()} className="min-h-11 cursor-pointer bg-transparent px-1 font-semibold text-primary-ink hover:underline">
              {copiado ? 'Chave copiada' : 'Copiar chave'}
            </button>
          </span>
        </li>
        <li>Digite abaixo o código de 6 números que o app mostrar.</li>
      </ol>
      <CodigoForm
        acao="Confirmar e ativar"
        onCancelar={onCancelar}
        onEnviar={async (code) => {
          await mfaAtivar(novo.factorId, code)
          onAtivada()
        }}
      />
    </div>
  )
}

function CodigoForm({
  titulo,
  texto,
  acao,
  perigo,
  onEnviar,
  onCancelar,
}: {
  titulo?: string
  texto?: string
  acao: string
  perigo?: boolean
  onEnviar: (code: string) => Promise<void>
  onCancelar: () => void
}) {
  const [erro, setErro] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setFocus,
    resetField,
    formState: { errors, isSubmitting },
  } = useForm<MfaCodeInput>({ resolver: zodResolver(mfaCodeSchema), defaultValues: { code: '' } })

  useEffect(() => {
    if (titulo) setFocus('code')
  }, [titulo, setFocus])

  const onSubmit = handleSubmit(async ({ code }) => {
    setErro(null)
    try {
      await onEnviar(limparCodigo(code))
    } catch (err) {
      setErro(mensagem(err))
      resetField('code')
      setFocus('code')
    }
  })

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4" aria-label={titulo ?? acao}>
      {titulo && <h3 className="m-0 text-base font-semibold">{titulo}</h3>}
      {texto && <p className="m-0 text-sm text-muted">{texto}</p>}
      <div className="max-w-[260px]">
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
      </div>
      <Retorno erro={erro} />
      <Rodape>
        <Button variant="ghost" onClick={onCancelar}>
          Cancelar
        </Button>
        <Button type="submit" variant={perigo ? 'danger' : 'primary'} loading={isSubmitting}>
          {isSubmitting ? 'Confirmando…' : acao}
        </Button>
      </Rodape>
    </form>
  )
}
