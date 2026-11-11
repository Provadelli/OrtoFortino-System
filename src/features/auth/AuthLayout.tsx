import { useEffect, useState, type ReactNode } from 'react'
import { BrandStripe } from '@/components/brand/BrandStripe'
import { Logo } from '@/components/brand/Logo'
import { LockIcon } from '@/components/ui/icons'
import { formatPhone } from '@/lib/br'
import { EMPRESA_PADRAO } from '@/lib/empresa'

const YEAR = new Date().getFullYear()

type Publica = { nome: string; telefone: string | null }
const RESERVA: Publica = { nome: EMPRESA_PADRAO.nome, telefone: EMPRESA_PADRAO.telefone }
let pedido: Promise<Publica> | undefined

/** Nome e telefone editados em Configurações (uma busca por carregamento; sem rede, fica o padrão). */
function useEmpresaPublica() {
  const [empresa, setEmpresa] = useState(RESERVA)
  useEffect(() => {
    let vivo = true
    pedido ??= fetch('/api/empresa', { credentials: 'omit' })
      .then((r) => (r.ok ? (r.json() as Promise<Partial<Publica>>) : {}))
      .then((d: Partial<Publica>) => ({ nome: d.nome || RESERVA.nome, telefone: d.telefone ?? RESERVA.telefone }))
      .catch(() => RESERVA)
    void pedido.then((e) => vivo && setEmpresa(e))
    return () => {
      vivo = false
    }
  }, [])
  return empresa
}

/** Tela dividida do canvas: marca à esquerda (menta + raios de sol), formulário à direita. */
export function AuthLayout({ children }: { children: ReactNode }) {
  const empresa = useEmpresaPublica()
  return (
    <div className="flex min-h-dvh flex-wrap bg-white">
      <aside
        aria-label="Orto Fortino"
        className="relative flex min-h-[340px] flex-[1_1_520px] flex-col items-center justify-center overflow-hidden bg-mint-wash px-8 py-12 sm:min-h-[440px]"
      >
        <div aria-hidden="true" className="sunburst pointer-events-none absolute -inset-[60%] animate-spin-slow will-change-transform" />
        <div className="relative flex flex-col items-start animate-rise">
          <Logo className="w-[clamp(240px,26vw,340px)]" />
          <p className="mt-10 mb-0 max-w-[380px] text-lg leading-normal text-[#2b4a3f]">
            Cadastro de pacientes, atendimentos e orçamentos em um só lugar.
          </p>
        </div>
        <BrandStripe className="absolute inset-x-0 bottom-0 h-2" />
      </aside>

      <main id="conteudo" className="flex flex-[1_1_420px] flex-col items-center justify-center gap-8 px-4 py-12 sm:px-6">
        {children}
        <footer className="flex w-full max-w-[400px] flex-col gap-3 text-[13px] text-muted">
          <p className="m-0 flex items-center gap-2.5">
            <LockIcon className="shrink-0 text-primary" />
            Dados dos pacientes protegidos conforme a LGPD.
          </p>
          <p className="m-0">
            © {YEAR} {empresa.nome}
            {empresa.telefone ? ` · ${formatPhone(empresa.telefone)}` : ''}
          </p>
        </footer>
      </main>
    </div>
  )
}

export function FormAlert({ children, tone = 'error' }: { children: ReactNode; tone?: 'error' | 'success' }) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={
        tone === 'error'
          ? 'rounded-field border border-[#f6b8d6] bg-late-bg px-4 py-3 text-[15px] font-medium text-late-fg animate-shake'
          : 'rounded-field border border-[#bfe6d2] bg-prod-bg px-4 py-3 text-[15px] font-medium text-prod-fg animate-fade'
      }
    >
      {children}
    </div>
  )
}
