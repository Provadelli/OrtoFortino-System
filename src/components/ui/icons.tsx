import type { SVGProps } from 'react'

/** Ícones de traço (os mesmos do canvas). Sempre decorativos: o texto/aria-label do controle descreve a ação. */
function Icon({ children, size = 20, strokeWidth = 1.8, ...rest }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  )
}

type P = SVGProps<SVGSVGElement> & { size?: number }

export const EyeIcon = (p: P) => (
  <Icon size={22} {...p}>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </Icon>
)
export const EyeOffIcon = (p: P) => (
  <Icon size={22} {...p}>
    <path d="M10.6 5.1A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-2.6 3.6M6.6 6.6A17.3 17.3 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2M3 3l18 18" />
  </Icon>
)
export const LockIcon = (p: P) => (
  <Icon size={18} {...p}>
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </Icon>
)
export const PanelIcon = (p: P) => (
  <Icon {...p}>
    <rect x="3" y="3" width="7" height="9" rx="1.5" />
    <rect x="14" y="3" width="7" height="5" rx="1.5" />
    <rect x="14" y="12" width="7" height="9" rx="1.5" />
    <rect x="3" y="16" width="7" height="5" rx="1.5" />
  </Icon>
)
export const UsersIcon = (p: P) => (
  <Icon {...p}>
    <circle cx="9" cy="8" r="4" />
    <path d="M2 21c0-3.9 3.1-7 7-7s7 3.1 7 7" />
    <path d="M16 4a4 4 0 0 1 0 8" />
    <path d="M22 21c0-3-1.8-5.5-4.5-6.5" />
  </Icon>
)
export const ClipboardIcon = (p: P) => (
  <Icon {...p}>
    <rect x="5" y="3" width="14" height="18" rx="2" />
    <path d="M9 3v2h6V3" />
    <path d="M9 11h6M9 15h4" />
  </Icon>
)
export const FileIcon = (p: P) => (
  <Icon {...p}>
    <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
    <path d="M14 3v6h6" />
    <path d="M8 13h8M8 17h5" />
  </Icon>
)
export const TagIcon = (p: P) => (
  <Icon {...p}>
    <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" />
    <circle cx="7.5" cy="7.5" r="1.5" />
  </Icon>
)
export const GearIcon = (p: P) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </Icon>
)
/** Três linhas decrescentes: "filtros". */
export const FilterIcon = (p: P) => (
  <Icon size={20} strokeWidth={2} {...p}>
    <path d="M4 6h16M7 12h10M10 18h4" />
  </Icon>
)
export const SearchIcon = (p: P) => (
  <Icon size={18} strokeWidth={2} {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Icon>
)
export const DownloadIcon = (p: P) => (
  <Icon size={18} strokeWidth={2} {...p}>
    <path d="M12 3v12" />
    <path d="m7 10 5 5 5-5" />
    <path d="M5 21h14" />
  </Icon>
)
export const MenuIcon = (p: P) => (
  <Icon size={22} strokeWidth={2} {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Icon>
)
export const CloseIcon = (p: P) => (
  <Icon size={22} strokeWidth={2} {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Icon>
)
export const ArrowLeftIcon = (p: P) => (
  <Icon size={18} strokeWidth={2} {...p}>
    <path d="M19 12H5M11 18l-6-6 6-6" />
  </Icon>
)
export const CheckCircleIcon = (p: P) => (
  <Icon size={22} strokeWidth={2} {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="m8 12.5 2.7 2.7L16 10" />
  </Icon>
)
export const ChevronUpIcon = (p: P) => (
  <Icon size={18} strokeWidth={2} {...p}>
    <path d="m6 15 6-6 6 6" />
  </Icon>
)
export const ChevronDownIcon = (p: P) => (
  <Icon size={18} strokeWidth={2} {...p}>
    <path d="m6 9 6 6 6-6" />
  </Icon>
)
/** Porta com seta saindo. */
export const LogoutIcon = (p: P) => (
  <Icon size={20} strokeWidth={2} {...p}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="m16 17 5-5-5-5M21 12H9" />
  </Icon>
)
/** Balão de conversa (suporte). */
export const SupportIcon = (p: P) => (
  <Icon size={20} {...p}>
    <path d="M21 11.5a8.4 8.4 0 0 1-12.3 7.5L3 21l2-5.4A8.5 8.5 0 1 1 21 11.5Z" />
    <path d="M9 10.5h.01M12.5 10.5h.01M16 10.5h.01" strokeWidth={2.4} />
  </Icon>
)
export const ShieldIcon = (p: P) => (
  <Icon {...p}>
    <path d="M12 3 5 6v5c0 4.5 3 8.3 7 10 4-1.7 7-5.5 7-10V6l-7-3Z" />
    <path d="m9 12 2.2 2.2L15.5 10" />
  </Icon>
)
