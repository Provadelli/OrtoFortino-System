import type { ReactNode } from 'react'

const YEAR = new Date().getFullYear()
import { BrandStripe } from '@/components/brand/BrandStripe'
import { Logo } from '@/components/brand/Logo'
import { EMPRESA } from '@/lib/empresa'
import { LockIcon } from '@/components/ui/icons'

/** Tela dividida do canvas: marca à esquerda (menta + raios de sol), formulário à direita. */
export function AuthLayout({ children }: { children: ReactNode }) {
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
            © {YEAR} {EMPRESA.nome} · {EMPRESA.telefone}
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
