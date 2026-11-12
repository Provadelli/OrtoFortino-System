import { useEffect, useId, useLayoutEffect, useRef, useState, type ComponentType, type SVGProps } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router'
import { BrandStripe } from '@/components/brand/BrandStripe'
import { Logo } from '@/components/brand/Logo'
import { ChevronUpIcon, ClipboardIcon, CloseIcon, FileIcon, GearIcon, LogoutIcon, MenuIcon, PanelIcon, SupportIcon, TagIcon, UsersIcon } from '@/components/ui/icons'
import { logout } from '@/features/auth/auth-client'
import { useSession } from '@/features/auth/useSession'
import { cn } from '@/lib/cn'
import { limparRascunhos } from '@/lib/rascunho'
import { linkSuporte } from '@/lib/suporte'

type Item = { to: string; label: string; icon: ComponentType<SVGProps<SVGSVGElement>> }

export const NAV_ITEMS: Item[] = [
  { to: '/painel', label: 'Painel', icon: PanelIcon },
  { to: '/clientes', label: 'Clientes', icon: UsersIcon },
  { to: '/atendimentos', label: 'Atendimentos', icon: ClipboardIcon },
  { to: '/orcamentos', label: 'Orçamentos', icon: FileIcon },
  { to: '/tabela-de-precos', label: 'Tabela de preços', icon: TagIcon },
  { to: '/configuracoes', label: 'Configurações', icon: GearIcon },
]

/** Posição do destaque que desliza até o item ativo do menu. */
type Destaque = { top: number; height: number }

export function Sidebar() {
  const [open, setOpen] = useState(false)
  const listId = useId()
  const { pathname } = useLocation()
  const listaRef = useRef<HTMLUListElement>(null)
  const [destaque, setDestaque] = useState<Destaque | null>(null)

  // Esc fecha o menu móvel
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  // Mede o item ativo para o destaque deslizar até ele (antes da pintura, sem "pulo").
  useLayoutEffect(() => {
    const lista = listaRef.current
    const ativo = lista?.querySelector<HTMLElement>('a[aria-current="page"]')
    if (!lista || !ativo || !ativo.offsetHeight) return setDestaque(null)
    const top = ativo.getBoundingClientRect().top - lista.getBoundingClientRect().top
    setDestaque({ top, height: ativo.offsetHeight })
  }, [pathname, open])

  return (
    <nav
      aria-label="Menu principal"
      className="flex flex-col gap-4 border-b border-line bg-white px-4 py-3 lg:sticky lg:top-0 lg:h-dvh lg:w-[264px] lg:shrink-0 lg:gap-7 lg:border-r lg:border-b-0 lg:px-4 lg:py-6"
    >
      <div className="flex items-center justify-between gap-3 lg:flex-col lg:items-stretch lg:px-2">
        <div className="flex flex-col gap-3">
          <Logo variant="responsiva" className="w-[120px] lg:w-[200px]" />
          <BrandStripe className="hidden h-1 rounded lg:grid" />
        </div>
        <button
          type="button"
          className="flex h-11 cursor-pointer items-center gap-2 rounded-field border border-line bg-white px-3 font-display text-[15px] font-semibold text-ink lg:hidden"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <CloseIcon /> : <MenuIcon />}
          Menu
        </button>
      </div>

      <div id={listId} className={cn('flex-col gap-4 lg:flex lg:flex-1 lg:gap-7', open ? 'flex animate-drop' : 'hidden')}>
        <ul ref={listaRef} className="relative m-0 flex list-none flex-col gap-1 p-0">
          {destaque && (
            <li
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 rounded-field bg-prod-bg transition-[transform,height] duration-300 ease-[var(--ease-out-soft)]"
              style={{ transform: `translateY(${destaque.top}px)`, height: destaque.height }}
            />
          )}
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <li key={to} className="relative">
              <NavLink
                to={to}
                viewTransition
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'group flex min-h-11 items-center gap-3 rounded-field px-3.5 text-[15px] no-underline transition-colors duration-300',
                    isActive
                      ? cn('font-semibold text-prod-fg', !destaque && 'bg-prod-bg')
                      : 'font-medium text-ink-soft hover:bg-surface-hover hover:text-ink',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className={cn('shrink-0 transition-transform duration-300 group-hover:translate-x-0.5', isActive && 'animate-nudge')} />
                    {label}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>

        <Conta />
      </div>
    </nav>
  )
}

/** Cartão da conta: símbolo da marca, nome e um menu com Minha conta, Suporte e Sair. */
function Conta() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const session = useSession()
  const nome = session?.user.nome || 'Equipe Orto Fortino'
  const email = session?.user.email ?? ''
  const [aberto, setAberto] = useState(false)
  const [saindo, setSaindo] = useState(false)
  const caixaRef = useRef<HTMLDivElement>(null)
  const menuId = useId()

  // Fecha com Esc (devolvendo o foco ao botão) e com clique fora.
  useEffect(() => {
    if (!aberto) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation() // só fecha este menu (não o menu do celular)
      setAberto(false)
      caixaRef.current?.querySelector<HTMLButtonElement>('button[aria-expanded]')?.focus()
    }
    const onDown = (e: PointerEvent) => {
      if (!caixaRef.current?.contains(e.target as Node)) setAberto(false)
    }
    document.addEventListener('keydown', onKey, true)
    document.addEventListener('pointerdown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      document.removeEventListener('pointerdown', onDown)
    }
  }, [aberto])

  async function sair() {
    setSaindo(true)
    limparRascunhos()
    try {
      await logout()
    } finally {
      await navigate('/login', { replace: true })
    }
  }

  const itemClass =
    'flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-[10px] bg-transparent px-3 text-left text-[15px] font-medium text-ink no-underline transition-colors duration-300 hover:bg-surface-hover'

  return (
    <div ref={caixaRef} className="relative mt-auto">
      <div
        id={menuId}
        hidden={!aberto}
        className="absolute inset-x-0 bottom-full mb-2 rounded-[14px] border border-line bg-white p-1.5 shadow-[0_12px_32px_rgb(18_44_36/0.12)] animate-drop"
      >
        <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
          <li>
            <Link to="/configuracoes" className={itemClass} onClick={() => setAberto(false)}>
              <GearIcon className="shrink-0 text-ink-soft" />
              Minha conta
            </Link>
          </li>
          <li>
            <a href={linkSuporte(pathname)} target="_blank" rel="noopener noreferrer" className={itemClass}>
              <SupportIcon className="shrink-0 text-ink-soft" />
              <span className="flex flex-col">
                Acionar suporte
                <span className="text-xs font-normal text-muted">WhatsApp<span className="sr-only"> (abre em nova aba)</span></span>
              </span>
            </a>
          </li>
          <li className="mt-1 border-t border-line-soft pt-1">
            <button
              type="button"
              onClick={() => void sair()}
              disabled={saindo}
              aria-busy={saindo || undefined}
              className={cn(itemClass, 'group font-semibold text-late-fg hover:bg-late-bg disabled:cursor-progress')}
            >
              {saindo ? (
                <span aria-hidden="true" className="size-5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <LogoutIcon className="shrink-0 transition-transform duration-300 group-hover:translate-x-0.5" />
              )}
              {saindo ? 'Saindo…' : 'Sair'}
            </button>
          </li>
        </ul>
      </div>

      <button
        type="button"
        aria-expanded={aberto}
        aria-controls={menuId}
        onClick={() => setAberto((v) => !v)}
        className={cn(
          'flex w-full cursor-pointer items-center gap-3 rounded-[14px] border p-2.5 text-left transition-[background-color,border-color] duration-300',
          aberto ? 'border-line bg-white' : 'border-transparent bg-surface hover:border-line',
        )}
      >
        <img src="/favicon.svg" alt="" width={40} height={40} className="size-10 shrink-0 rounded-full border border-line bg-white p-1.5" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-semibold text-ink">{nome}</span>
          {email && <span className="truncate text-xs text-muted">{email}</span>}
          <span className="sr-only">: abrir menu da conta</span>
        </span>
        <ChevronUpIcon className={cn('shrink-0 text-muted transition-transform duration-300', !aberto && 'rotate-180')} />
      </button>
    </div>
  )
}
