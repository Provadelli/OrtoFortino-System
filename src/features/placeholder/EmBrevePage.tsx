import { Link, useLocation } from 'react-router'
import { NAV_ITEMS } from '@/components/layout/Sidebar'
import { buttonClass } from '@/components/ui/Button'
import { usePageTitle } from '@/lib/usePageTitle'

/** Módulos ainda não construídos (etapas 1–7 do roadmap). */
export default function EmBrevePage() {
  const { pathname } = useLocation()
  const item = NAV_ITEMS.find((i) => pathname.startsWith(i.to))
  const title = item?.label ?? 'Página'
  usePageTitle(title)

  return (
    <section className="flex flex-col items-start gap-4 rounded-card border border-line bg-white p-8 animate-rise" aria-labelledby="titulo-pagina">
      <h1 id="titulo-pagina" className="m-0 text-[30px] font-bold">
        {title}
      </h1>
      <p className="m-0 max-w-prose text-muted">Este módulo está em construção e chega nas próximas etapas do sistema.</p>
      <Link to="/painel" className={buttonClass('outline')}>
        Voltar ao painel
      </Link>
    </section>
  )
}
