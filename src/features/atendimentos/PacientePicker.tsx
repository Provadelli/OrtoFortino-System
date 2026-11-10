import { useEffect, useId, useState } from 'react'
import { Link } from 'react-router'
import { SearchIcon } from '@/components/ui/icons'
import { FieldError } from '@/components/ui/FormControls'
import { ageFrom, formatAge } from '@/lib/br'
import { usePaciente, usePacientes } from '@/features/pacientes/api'

/**
 * Escolha do paciente: busca + lista de opções (radios nativos = teclado e leitor de tela de graça).
 * Com um paciente escolhido, mostra o resumo e o botão "Trocar".
 */
export function PacientePicker({ value, onChange, error }: { value: string; onChange: (id: string) => void; error?: string }) {
  const id = useId()
  const [texto, setTexto] = useState('')
  const [q, setQ] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setQ(texto.trim()), 250)
    return () => clearTimeout(t)
  }, [texto])
  const escolhido = usePaciente(value || undefined)
  const lista = usePacientes(q, 0)

  if (value) {
    const p = escolhido.data
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-field border border-line bg-surface p-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-[13px] font-semibold text-muted">Paciente</span>
          <span className="text-[17px] font-semibold">{p ? p.nome : 'Carregando…'}</span>
          {p && <span className="text-[13px] text-muted">{formatAge(ageFrom(p.data_nascimento))}</span>}
        </div>
        <button
          type="button"
          onClick={() => onChange('')}
          className="inline-flex min-h-11 cursor-pointer items-center rounded-field px-3 text-sm font-semibold text-primary-ink hover:bg-surface-hover"
        >
          Trocar paciente
        </button>
      </div>
    )
  }

  const rows = lista.data?.rows ?? []
  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-3 border-0 p-0" aria-describedby={error ? `${id}-erro` : undefined}>
      <legend className="mb-2 p-0 text-sm font-semibold text-ink">Paciente *</legend>
      <div className="relative">
        <label htmlFor={`${id}-busca`} className="sr-only">
          Buscar paciente por nome ou CPF
        </label>
        <SearchIcon className="pointer-events-none absolute top-[15px] left-3.5 text-muted" />
        <input
          id={`${id}-busca`}
          type="search"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Buscar paciente por nome ou CPF"
          autoComplete="off"
          aria-invalid={error ? true : undefined}
          className="h-12 w-full rounded-field border-[1.5px] border-field bg-white pr-3.5 pl-[42px] text-[15px] text-ink hover:border-[#b5cbbf] aria-invalid:border-late-fg"
        />
      </div>
      <p className="m-0 text-[13px] text-muted" aria-live="polite">
        {lista.isPending ? 'Buscando…' : rows.length === 0 ? 'Nenhum paciente encontrado.' : q ? `${lista.data?.total} resultado(s)` : 'Pacientes mais recentes'}
      </p>
      {rows.length > 0 && (
        <ul className="m-0 flex max-h-[300px] list-none flex-col gap-1 overflow-y-auto p-0">
          {rows.slice(0, 8).map((p) => (
            <li key={p.id}>
              {/* oxlint-disable-next-line jsx-a11y/label-has-associated-control -- o texto do rótulo é o nome do paciente (dinâmico) */}
              <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-field border border-transparent px-3 py-2 hover:border-line hover:bg-surface has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-brand-mint">
                <input type="radio" name={`${id}-paciente`} value={p.id} className="m-0 size-[18px] accent-primary focus-visible:outline-none" onChange={() => onChange(p.id)} />
                <span className="flex flex-col">
                  <span className="text-[15px] font-semibold">{p.nome}</span>
                  <span className="text-[13px] text-muted">
                    {[formatAge(ageFrom(p.data_nascimento)), p.cpf_mascarado, p.responsavel ? `Resp.: ${p.responsavel}` : null].filter(Boolean).join(' · ')}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
      <Link to="/clientes/novo" className="self-start text-sm font-semibold text-primary-ink">
        Paciente novo? Cadastre primeiro
      </Link>
      <FieldError id={`${id}-erro`}>{error}</FieldError>
    </fieldset>
  )
}
