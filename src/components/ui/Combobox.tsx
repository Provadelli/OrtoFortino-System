import {
  forwardRef,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { normalizeSearch } from "@/lib/br";
import { cn } from "@/lib/cn";
import { inputClass } from "./Field";
import { ChevronDownIcon } from "./icons";

export type Opcao = {
  id: string;
  rotulo: string;
  /** Linha secundária (ex.: categoria, código). Também entra na busca. */
  detalhe?: string;
  /** Texto à direita (ex.: preço). */
  extra?: string;
  /** Agrupa as opções sob um título (ex.: categoria). */
  grupo?: string;
};

type Props = {
  label: string;
  value: string;
  onInputChange: (texto: string) => void;
  onEscolher: (opcao: Opcao) => void;
  opcoes: Opcao[];
  /** Mostra a opção "Usar “texto digitado”" quando o texto não é uma das opções. */
  textoLivre?: boolean;
  placeholder?: string;
  hint?: ReactNode;
  error?: string;
  vazio?: string;
  /** Máximo de opções exibidas de uma vez (a busca refina). */
  limite?: number;
  name?: string;
  onBlur?: () => void;
  /** Ícone à esquerda (ex.: lupa). */
  icone?: ReactNode;
};

/**
 * Campo com lista de opções (padrão ARIA 1.2 "combobox" com "listbox"):
 * abre ao focar, filtra enquanto digita (sem acento), setas ↑↓ navegam, Enter escolhe, Esc fecha.
 */
export const Combobox = forwardRef<HTMLInputElement, Props>(function Combobox(
  {
    label,
    value,
    onInputChange,
    onEscolher,
    opcoes,
    textoLivre,
    placeholder,
    hint,
    error,
    vazio = "Nenhuma opção encontrada.",
    limite = 60,
    name,
    onBlur,
    icone,
  },
  ref,
) {
  const id = useId();
  const listaId = `${id}-lista`;
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(-1);
  const [filtrar, setFiltrar] = useState(false);
  const lista = useRef<HTMLDivElement>(null);
  const caixa = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<CSSProperties>({});

  /**
   * A lista vai para o <body> (portal) com posição fixa medida no campo: assim não fica escondida atrás
   * do campo seguinte nem da barra fixa de "Salvar", mesmo dentro de blocos animados. Abre para cima se faltar espaço.
   */
  function medir() {
    const r = caixa.current?.getBoundingClientRect();
    if (!r) return;
    const alturaTela = window.visualViewport?.height ?? window.innerHeight;
    const abaixo = alturaTela - r.bottom - 12;
    const acima = r.top - 12;
    const paraCima = abaixo < 220 && acima > abaixo;
    const max = Math.max(120, Math.min(340, paraCima ? acima : abaixo));
    setPos({
      position: "fixed",
      left: r.left,
      width: r.width,
      maxHeight: max,
      ...(paraCima
        ? { bottom: window.innerHeight - r.top + 4 }
        : { top: r.bottom + 4 }),
    });
  }
  function abrir() {
    medir();
    setAberto(true);
  }
  useEffect(() => {
    if (!aberto) return;
    const atualizar = () => medir();
    window.addEventListener("scroll", atualizar, true);
    window.addEventListener("resize", atualizar);
    window.visualViewport?.addEventListener("resize", atualizar);
    return () => {
      window.removeEventListener("scroll", atualizar, true);
      window.removeEventListener("resize", atualizar);
      window.visualViewport?.removeEventListener("resize", atualizar);
    };
  }, [aberto]);

  const q = filtrar ? normalizeSearch(value) : "";
  const filtradas = useMemo(() => {
    const r = q
      ? opcoes.filter((o) =>
          normalizeSearch(
            `${o.rotulo} ${o.detalhe ?? ""} ${o.grupo ?? ""}`,
          ).includes(q),
        )
      : opcoes;
    return r.slice(0, limite);
  }, [opcoes, q, limite]);

  const exato = opcoes.some(
    (o) => normalizeSearch(o.rotulo) === normalizeSearch(value),
  );
  const livre: Opcao | null =
    textoLivre && value.trim() && !exato
      ? { id: `${id}-livre`, rotulo: value.trim() }
      : null;
  const itens = livre ? [...filtradas, livre] : filtradas;

  useEffect(() => setAtivo(-1), [q, aberto]);
  useEffect(() => {
    if (ativo < 0 || !lista.current) return;
    lista.current
      .querySelector(`[data-indice="${ativo}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [ativo]);

  function escolher(o: Opcao) {
    onEscolher(o);
    setAberto(false);
    setFiltrar(false);
  }

  const describedBy = [
    hint ? `${id}-dica` : null,
    error ? `${id}-erro` : null,
    `${id}-status`,
  ]
    .filter(Boolean)
    .join(" ");
  const grupos = itens.reduce<
    { nome: string | undefined; itens: { o: Opcao; i: number }[] }[]
  >((acc, o, i) => {
    const g = o === livre ? undefined : o.grupo;
    const ultimo = acc.at(-1);
    if (ultimo && ultimo.nome === g) ultimo.itens.push({ o, i });
    else acc.push({ nome: g, itens: [{ o, i }] });
    return acc;
  }, []);

  return (
    <div className="relative flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-semibold text-ink">
        {label}
      </label>
      <div ref={caixa} className="relative">
        {icone && (
          <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted">
            {icone}
          </span>
        )}
        <input
          ref={ref}
          id={id}
          name={name}
          role="combobox"
          aria-expanded={aberto}
          aria-controls={listaId}
          aria-autocomplete="list"
          aria-activedescendant={
            aberto && ativo >= 0 ? `${id}-op-${ativo}` : undefined
          }
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          autoComplete="off"
          spellCheck={false}
          value={value}
          placeholder={placeholder}
          className={inputClass(
            !!error,
            cn("pr-12", icone ? "pl-[42px]" : undefined),
          )}
          onFocus={abrir}
          onClick={abrir}
          onChange={(e) => {
            onInputChange(e.target.value);
            setFiltrar(true);
            if (!aberto) abrir();
          }}
          onBlur={() => {
            setAberto(false);
            setFiltrar(false);
            onBlur?.();
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              if (!aberto) abrir();
              setAtivo((a) => Math.min(a + 1, itens.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setAtivo((a) => Math.max(a - 1, 0));
            } else if (
              e.key === "Enter" &&
              aberto &&
              ativo >= 0 &&
              itens[ativo]
            ) {
              e.preventDefault();
              escolher(itens[ativo]);
            } else if (
              e.key === "Enter" &&
              aberto &&
              itens.length === 1 &&
              filtrar
            ) {
              e.preventDefault();
              escolher(itens[0]!);
            } else if (e.key === "Escape" && aberto) {
              e.preventDefault();
              setAberto(false);
            }
          }}
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label={aberto ? "Fechar lista" : "Abrir lista"}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            if (aberto) setAberto(false);
            else abrir();
            setFiltrar(false);
            document.getElementById(id)?.focus();
          }}
          className="absolute top-[3px] right-[3px] flex size-11 cursor-pointer items-center justify-center rounded-[10px] text-muted hover:bg-surface-hover hover:text-ink"
        >
          <ChevronDownIcon
            className={cn("transition-transform", aberto && "rotate-180")}
          />
        </button>
      </div>

      {createPortal(
        <div
          ref={lista}
          id={listaId}
          role="listbox"
          aria-label="Opções"
          hidden={!aberto}
          style={pos}
          className="z-50 overflow-y-auto overscroll-contain rounded-field border border-line bg-white p-1 shadow-xl"
        >
          {itens.length === 0 && (
            <div className="px-3 py-2.5 text-sm text-muted">{vazio}</div>
          )}
          {grupos.map((g, gi) => (
            <div key={`${g.nome ?? "_"}-${gi}`} role="presentation">
              {g.nome && (
                <div
                  aria-hidden="true"
                  className="px-3 pt-2.5 pb-1 text-[11px] font-semibold tracking-[0.08em] text-muted uppercase"
                >
                  {g.nome}
                </div>
              )}
              <div
                role="group"
                aria-label={
                  g.nome ??
                  (g.itens[0]?.o === livre ? "Texto digitado" : "Opções")
                }
              >
                {g.itens.map(({ o, i }) => (
                  // oxlint-disable-next-line jsx-a11y/click-events-have-key-events -- o teclado fica no input (aria-activedescendant), padrão ARIA do combobox
                  <div
                    key={o.id}
                    id={`${id}-op-${i}`}
                    data-indice={i}
                    role="option"
                    tabIndex={-1}
                    aria-selected={ativo === i}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => escolher(o)}
                    onMouseMove={() => ativo !== i && setAtivo(i)}
                    className={cn(
                      "flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-[10px] px-3 py-2 text-[15px]",
                      ativo === i ? "bg-prod-bg text-prod-fg" : "text-ink",
                    )}
                  >
                    <span className="flex min-w-0 flex-col">
                      <span
                        className={cn("font-medium", o === livre && "italic")}
                      >
                        {o === livre ? `Usar “${o.rotulo}”` : o.rotulo}
                      </span>
                      {o.detalhe && (
                        <span className="truncate text-[13px] text-muted">
                          {o.detalhe}
                        </span>
                      )}
                    </span>
                    {o.extra && (
                      <span className="shrink-0 font-semibold whitespace-nowrap tabular-nums">
                        {o.extra}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>,
        document.body,
      )}

      {hint && (
        <p id={`${id}-dica`} className="m-0 text-[13px] text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-erro`} className="m-0 text-sm font-medium text-late-fg">
          {error}
        </p>
      )}
      <p id={`${id}-status`} aria-live="polite" className="sr-only">
        {aberto
          ? itens.length === 0
            ? vazio
            : `${itens.length} ${itens.length === 1 ? "opção" : "opções"}. Use as setas para escolher.`
          : ""}
      </p>
    </div>
  );
});
