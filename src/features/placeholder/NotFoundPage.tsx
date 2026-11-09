import { Link } from 'react-router'
import { BrandStripe } from '@/components/brand/BrandStripe'
import { buttonClass } from '@/components/ui/Button'
import { usePageTitle } from '@/lib/usePageTitle'

export default function NotFoundPage() {
  usePageTitle('Página não encontrada')
  return (
    <main id="conteudo" className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-mint-wash p-6 text-center">
      <BrandStripe className="h-2 w-40 rounded" />
      <h1 className="m-0 text-[34px] font-bold">Página não encontrada</h1>
      <p className="m-0 text-muted">O endereço pode ter mudado ou não existe.</p>
      <Link to="/painel" className={buttonClass('primary')}>
        Ir para o painel
      </Link>
    </main>
  )
}
