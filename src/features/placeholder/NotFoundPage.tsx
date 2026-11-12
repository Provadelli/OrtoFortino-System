import { Link, useLocation, useNavigate } from 'react-router'
import { CenaRabiscos } from '@/components/ui/Rabisco'
import { buttonClass } from '@/components/ui/Button'
import { ArrowLeftIcon } from '@/components/ui/icons'
import { useSession } from '@/features/auth/useSession'
import { linkSuporte } from '@/lib/suporte'
import { usePageTitle } from '@/lib/usePageTitle'

/** 404 com a identidade da marca (menta + raios do login), para quem está logado ou não. */
export default function NotFoundPage() {
  usePageTitle('Página não encontrada')
  const session = useSession()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const logado = !!session

  return (
    <main id="conteudo" className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-[#f3f4f2] px-4 py-16 text-center">
      <CenaRabiscos />

      <div className="relative flex max-w-[460px] flex-col items-center gap-5">
        <div className="relative animate-sway">
          <img src="/favicon.svg" alt="" width={112} height={112} className="size-28 rounded-full bg-white p-3 shadow-[0_10px_30px_rgb(31_122_92/0.15)]" />
          <span
            aria-hidden="true"
            className="absolute -right-3 -bottom-1 rounded-full bg-white px-2.5 py-0.5 font-display text-sm font-bold text-late-fg shadow-sm"
          >
            404
          </span>
        </div>

        <h1 className="m-0 mt-2 text-[30px] leading-tight font-bold text-ink animate-rise stagger [--i:2]">Não encontramos esta página</h1>
        <p className="m-0 text-[17px] leading-relaxed text-[#2b4a3f] animate-rise stagger [--i:3]">
          O link pode estar incompleto ou a página mudou de lugar. Volte para onde estava ou siga para o {logado ? 'painel' : 'login'}.
        </p>

        <div className="mt-2 flex flex-wrap justify-center gap-3 animate-rise stagger [--i:4]">
          <Link to={logado ? '/painel' : '/login'} className={buttonClass('primary')}>
            {logado ? 'Ir para o painel' : 'Entrar no sistema'}
          </Link>
          <button type="button" onClick={() => void navigate(-1)} className={buttonClass('outline', 'md', 'bg-white')}>
            <ArrowLeftIcon />
            Voltar
          </button>
        </div>

        <p className="m-0 text-sm text-[#2b4a3f] animate-fade stagger [--i:6]">
          Chegou aqui por um link do sistema?{' '}
          <a href={linkSuporte(pathname)} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary-ink underline underline-offset-4">
            Acionar suporte
            <span className="sr-only"> (abre o WhatsApp em nova aba)</span>
          </a>
        </p>
      </div>

    </main>
  )
}
