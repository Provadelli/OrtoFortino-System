import { useEffect, useId, useState, type ComponentType, type SVGProps } from 'react'
import { NavLink, useNavigate } from 'react-router'
import { BrandStripe } from '@/components/brand/BrandStripe'
import { Logo } from '@/components/brand/Logo'
import { ClipboardIcon, CloseIcon, FileIcon, GearIcon, MenuIcon, PanelIcon, TagIcon, UsersIcon } from '@/components/ui/icons'
import { logout } from '@/features/auth/auth-client'
import { useSession } from '@/features/auth/useSession'
import { cn } from '@/lib/cn'
import { initials } from '@/lib/format'

type Item = { to: string; label: string; icon: ComponentType<SVGProps<SVGSVGElement>> }

export const NAV_ITEMS: Item[] = [
  { to: '/painel', label: 'Painel', icon: PanelIcon },
  { to: '/clientes', label: 'Clientes', icon: UsersIcon },
  { to: '/atendimentos', label: 'Atendimentos', icon: ClipboardIcon },
  { to: '/orcamentos', label: 'Orçamentos', icon: FileIcon },
  { to: '/tabela-de-precos', label: 'Tabela de preços', icon: TagIcon },
  { to: '/configuracoes', label: 'Configurações', icon: GearIcon },
]

export function Sidebar() {
  const [open, setOpen] = useState(false)
  const listId = useId()
  const navigate = useNavigate()
  const session = useSession()
  const nome = session?.user.nome || 'Equipe Orto Fortino'
  const [leaving, setLeaving] = useState(false)

  // Esc fecha o menu móvel
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  async function onLogout() {
    setLeaving(true)
    try {
      await logout()
    } finally {
      navigate('/login', { replace: true })
    }
  }

  return (
    <nav
      aria-label="Menu principal"
      className="flex flex-col gap-4 border-b border-line bg-white px-4 py-3 lg:sticky lg:top-0 lg:h-dvh lg:w-[264px] lg:shrink-0 lg:gap-7 lg:border-r lg:border-b-0 lg:px-4 lg:py-6"
    >
      <div className="flex items-center justify-between gap-3 lg:flex-col lg:items-stretch lg:px-2">
        <div className="flex flex-col gap-3">
          <Logo size="sm" />
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

      <div id={listId} className={cn('flex-col gap-4 lg:flex lg:flex-1 lg:gap-7', open ? 'flex animate-rise' : 'hidden')}>
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                viewTransition
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'flex min-h-11 items-center gap-3 rounded-field px-3.5 text-[15px] no-underline transition-colors duration-150',
                    isActive ? 'bg-prod-bg font-semibold text-prod-fg' : 'font-medium text-ink-soft hover:bg-surface-hover hover:text-ink',
                  )
                }
              >
                <Icon />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>

        <div className="mt-auto flex items-center gap-3 rounded-[14px] bg-surface p-3">
          <div
            aria-hidden="true"
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-late-bg font-display text-[15px] font-bold text-late-fg"
          >
            {initials(nome) || 'OF'}
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-semibold">{nome}</span>
            <button
              type="button"
              onClick={onLogout}
              disabled={leaving}
              className="-my-3 min-h-11 cursor-pointer self-start bg-transparent p-0 text-left text-[13px] font-medium text-primary-ink hover:underline disabled:cursor-progress"
            >
              {leaving ? 'Saindo…' : 'Sair'}
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}
