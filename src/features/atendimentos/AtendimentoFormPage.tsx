import { useEffect, useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { AvisoRascunho } from "@/components/ui/AvisoRascunho";
import { Button, buttonClass } from "@/components/ui/Button";
import { Atalhos } from "@/components/ui/Atalhos";
import { Combobox } from "@/components/ui/Combobox";
import { Field } from "@/components/ui/Field";
import {
  Choice,
  ChoiceGroup,
  Section,
  SelectField,
  TextareaField,
} from "@/components/ui/FormControls";
import { MapaSecoes } from "@/components/ui/MapaSecoes";
import { ArrowLeftIcon } from "@/components/ui/icons";
import { PageSkeleton } from "@/components/layout/PageSkeleton";
import { StatusChip } from "@/components/ui/StatusChip";
import { parseBRL, somarDias, todayIso } from "@/lib/br";
import { dinheiro } from "@/lib/masked";
import { formatBRL } from "@/lib/format";
import { isDbError } from "@/lib/supabase";
import { usePageTitle } from "@/lib/usePageTitle";
import { useRascunho } from "@/lib/rascunho";
import { useConfiguracoes } from "@/features/configuracoes/api";
import { toForm, useAtendimento, useSalvarAtendimento } from "./api";
import {
  CATEGORIAS,
  descricaoSugerida,
  ESPECIFICACOES,
  FORMAS,
  LATERALIDADES,
  MAX_PARCELAS,
  PAGAMENTO,
  PARCELAVEIS,
  PRODUTOS,
  STATUS,
  TIPOS,
  type FormaPagamento,
  type StatusPagamento,
} from "./constants";
import { FichaVisualAoVivo } from "./ficha/FichaVisual";
import { PacientePicker } from "./PacientePicker";
import {
  atendimentoSchema,
  atendimentoVazio,
  type AtendimentoForm,
} from "./schema";

export default function AtendimentoFormPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const [hoje] = useState(todayIso);
  const { data, isPending, isError } = useAtendimento(id);

  if (id && isPending) return <PageSkeleton />;
  if (id && (isError || !data))
    return (
      <div
        role="alert"
        className="flex flex-col items-start gap-3 rounded-card border border-line bg-white p-8"
      >
        <h1 className="m-0 text-2xl font-bold">Atendimento não encontrado</h1>
        <Link to="/atendimentos" className={buttonClass("outline")}>
          Voltar para atendimentos
        </Link>
      </div>
    );

  const initial = data
    ? toForm(data)
    : atendimentoVazio(params.get("paciente") ?? "", hoje);
  return (
    <Inner
      key={id ?? "novo"}
      id={id}
      numero={data?.numero}
      initial={initial}
      hoje={hoje}
      base={data?.updated_at ?? null}
    />
  );
}

const PRAZOS = [15, 20, 30, 45];

const GRUPOS_FORMA = [
  { grupo: "vista", titulo: "À vista" },
  { grupo: "cartao", titulo: "Cartão" },
  { grupo: "outros", titulo: "Outros" },
] as const;

const DICA_DETALHE: Partial<Record<FormaPagamento, string>> = {
  credito: "Ex.: bandeira, entrada de R$ 200 + parcelas",
  debito: "Ex.: bandeira do cartão",
  boleto: "Ex.: vencimento todo dia 10",
  convenio: "Ex.: nome do convênio e nº da autorização",
  pix: "Ex.: chave usada, nome de quem pagou",
};

function statusPagamento(valor: number, pago: number): StatusPagamento {
  if (!(valor > 0)) return "isento";
  if (pago >= valor) return "pago";
  return pago > 0 ? "parcial" : "pendente";
}

function Inner({
  id,
  numero,
  initial,
  hoje,
  base,
}: {
  id?: string;
  numero?: number;
  initial: AtendimentoForm;
  hoje: string;
  base: string | null;
}) {
  const editing = !!id;
  usePageTitle(
    editing ? `Editar atendimento nº ${numero}` : "Novo atendimento",
  );
  const navigate = useNavigate();
  const salvar = useSalvarAtendimento(id);
  const [serverError, setServerError] = useState<string | null>(null);
  // Sugestões editáveis em Configurações (enquanto carregam, valem as da ficha em papel).
  const { data: config } = useConfiguracoes();
  const produtosFicha = config?.ficha_produtos ?? PRODUTOS;
  const especificacoes = useMemo(() => {
    const lista = config?.ficha_especificacoes ?? ESPECIFICACOES;
    // Uma especificação já marcada continua visível mesmo que tenha saído da lista.
    const marcadas = (initial.ficha?.especificacoes ?? []).filter(
      (e) => !lista.includes(e),
    );
    return [...lista, ...marcadas];
  }, [config, initial]);

  const form = useForm<AtendimentoForm>({
    resolver: zodResolver(atendimentoSchema),
    defaultValues: initial,
    mode: "onTouched",
  });
  const {
    register,
    handleSubmit,
    control,
    setValue,
    getValues,
    formState: { errors, isSubmitting, isDirty },
  } = form;
  const definir = (
    campo:
      | "descricao"
      | "data_primeiro_contato"
      | "data_fechamento"
      | "data_conclusao"
      | "prazo_entrega"
      | "data_pagamento"
      | "valor_pago",
    v: string,
  ) => setValue(campo, v, { shouldDirty: true, shouldValidate: true });
  // Descrição curta sugerida a partir do produto + lateralidade, enquanto o usuário não escrever a dele.
  const [descricaoAuto, setDescricaoAuto] = useState<string | null>(() =>
    initial.descricao &&
    initial.descricao ===
      descricaoSugerida(
        initial.ficha?.produto ?? "",
        initial.ficha?.lateralidade,
      )
      ? initial.descricao
      : null,
  );
  function sugerirDescricao(
    produto: string,
    lateralidade: string | null | undefined,
  ) {
    const atual = getValues("descricao").trim();
    if (atual !== "" && atual !== descricaoAuto) return;
    const nova = descricaoSugerida(produto, lateralidade);
    setDescricaoAuto(nova);
    definir("descricao", nova);
  }
  const rascunho = useRascunho(
    form,
    `atendimento:${id ?? "novo"}`,
    initial,
    base,
  );

  const [
    categoria,
    comFicha,
    tipo,
    compLado,
    nomeNaOrtese,
    valor,
    valorPago,
    primeiroContato,
    prazo,
    status,
    dataPagamento,
    forma,
    parcelas,
    produtoFicha,
    pacienteId,
    observacoes,
  ] = useWatch({
    control,
    name: [
      "categoria",
      "com_ficha",
      "ficha.tipo",
      "ficha.compensacao_lado",
      "ficha.nome_na_ortese",
      "valor",
      "valor_pago",
      "data_primeiro_contato",
      "prazo_entrega",
      "status",
      "data_pagamento",
      "pagamento_forma",
      "pagamento_parcelas",
      "ficha.produto",
      "paciente_id",
      "observacoes",
    ],
  });
  const parcelavel = PARCELAVEIS.includes(forma as FormaPagamento);
  const valorNum = parseBRL(valor) || 0;
  // Prazos contam a partir de hoje (ou do primeiro contato, se for futuro).
  const basePrazo =
    primeiroContato && primeiroContato > hoje ? primeiroContato : hoje;
  // Mesma regra do gatilho do banco, já visível no formulário: o status avança e a data aparece.
  const aoMudarStatus = (novo: string) => {
    if (
      ["em_producao", "pronto", "entregue"].includes(novo) &&
      !getValues("data_fechamento")
    )
      definir("data_fechamento", basePrazo);
    if (novo === "entregue" && !getValues("data_conclusao"))
      definir("data_conclusao", basePrazo);
  };
  const aoMudarPago = (v: string) => {
    if (parseBRL(v) > 0 && !getValues("data_pagamento"))
      definir("data_pagamento", hoje);
  };
  const pg = PAGAMENTO[statusPagamento(parseBRL(valor), parseBRL(valorPago))];
  const restante = Math.max(
    0,
    (parseBRL(valor) || 0) - (parseBRL(valorPago) || 0),
  );

  useEffect(() => {
    if (!isDirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [isDirty]);

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      const savedId = await salvar.mutateAsync(values);
      rascunho.concluir();
      navigate(`/atendimentos/${savedId}`, {
        replace: true,
        state: {
          notice: editing
            ? "Alterações salvas."
            : "Atendimento aberto com sucesso.",
        },
      });
    } catch (err) {
      setServerError(
        isDbError(err) && err.code === "23514"
          ? "Algum dado não passou na validação do servidor. Confira datas e valores."
          : "Não foi possível salvar agora. Verifique sua conexão e tente de novo.",
      );
    }
  });

  const errorCount =
    Object.keys(errors).length +
    (errors.ficha ? Object.keys(errors.ficha).length - 1 : 0);
  const voltar = editing
    ? `/atendimentos/${id}`
    : initial.paciente_id
      ? `/clientes/${initial.paciente_id}`
      : "/atendimentos";

  return (
    <form
      noValidate
      onSubmit={onSubmit}
      className="flex flex-col gap-5"
      aria-labelledby="titulo-form"
    >
      <header className="flex flex-col gap-2 animate-fade">
        <Link
          to={voltar}
          className="-ml-1 inline-flex min-h-11 items-center gap-2 self-start text-[15px] font-semibold text-primary-ink no-underline hover:underline"
        >
          <ArrowLeftIcon /> Voltar
        </Link>
        <h1
          id="titulo-form"
          className="m-0 text-[30px] leading-[1.2] font-bold"
        >
          {editing ? `Editar atendimento nº ${numero}` : "Novo atendimento"}
        </h1>
        <p className="m-0 text-sm text-muted">Campos com * são obrigatórios.</p>
      </header>
      <AvisoRascunho
        em={rascunho.restauradoEm}
        onDescartar={rascunho.descartar}
      />

      {(serverError || errorCount > 0) && (
        <div
          role="alert"
          className="rounded-field border border-[#f6b8d6] bg-late-bg px-4 py-3 text-[15px] font-medium text-late-fg"
        >
          {serverError ??
            (errorCount === 1
              ? "Há 1 campo para corrigir."
              : `Há ${errorCount} campos para corrigir.`)}
        </div>
      )}

      <MapaSecoes
        itens={[
          {
            id: "sec-atend",
            titulo: "Atendimento",
            estado: errors.paciente_id || errors.categoria || errors.descricao || errors.status ? "erro" : pacienteId && status ? "ok" : "pendente",
          },
          {
            id: "sec-datas",
            titulo: "Datas",
            estado:
              errors.data_primeiro_contato || errors.prazo_entrega || errors.data_fechamento || errors.data_conclusao
                ? "erro"
                : primeiroContato && prazo
                  ? "ok"
                  : "pendente",
          },
          {
            id: "sec-ficha",
            titulo: "Ficha técnica",
            estado: errors.ficha ? "erro" : !comFicha || produtoFicha || tipo === "protese" ? "ok" : "pendente",
          },
          {
            id: "sec-pag",
            titulo: "Pagamento",
            estado: errors.valor || errors.valor_pago || errors.pagamento_detalhe || errors.data_pagamento ? "erro" : valor || categoria === "reparo" ? "ok" : "pendente",
          },
          { id: "sec-obs", titulo: "Observações", estado: errors.observacoes ? "erro" : observacoes ? "ok" : "pendente" },
        ]}
      />

      <Section id="sec-atend" title="Atendimento">
        <Controller
          control={control}
          name="paciente_id"
          render={({ field, fieldState }) =>
            editing ? (
              <input type="hidden" {...field} />
            ) : (
              <PacientePicker
                value={field.value}
                onChange={(v) => field.onChange(v)}
                error={fieldState.error?.message}
              />
            )
          }
        />
        <ChoiceGroup
          legend="Categoria *"
          hint={
            categoria === "reparo"
              ? "Reparo sem custo: deixe o valor em branco ou zero."
              : undefined
          }
        >
          {CATEGORIAS.map((c) => (
            <Choice
              key={c.value}
              label={c.label}
              value={c.value}
              {...register("categoria")}
            />
          ))}
        </ChoiceGroup>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Descrição curta"
            placeholder="Ex.: AFO articulada bilateral"
            hint={
              comFicha
                ? "Sugerida pelo produto e lateralidade da ficha; pode editar."
                : undefined
            }
            autoComplete="off"
            error={errors.descricao?.message}
            {...register("descricao")}
          />
        </div>
        <ChoiceGroup
          legend="Status *"
          hint={
            status !== "em_contato" && status !== "cancelado"
              ? "Fechamento e conclusão recebem a data de hoje quando estão vazios."
              : undefined
          }
        >
          {STATUS.map((st) => (
            <Choice
              key={st.value}
              label={st.label}
              value={st.value}
              {...register("status", {
                onChange: (e) => aoMudarStatus(e.target.value),
              })}
            />
          ))}
        </ChoiceGroup>
      </Section>

      <Section
        id="sec-datas"
        title="Datas"
        description="Fechamento e conclusão são preenchidos sozinhos quando o status avança."
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Primeiro contato *"
            type="date"
            max={hoje}
            error={errors.data_primeiro_contato?.message}
            actions={
              <Atalhos
                rotulo="Atalhos: contato"
                itens={[{ rotulo: "Hoje", valor: hoje }]}
                atual={primeiroContato}
                onEscolher={(v) => definir("data_primeiro_contato", v)}
              />
            }
            {...register("data_primeiro_contato")}
          />
          <Field
            label="Prazo de entrega"
            type="date"
            min={primeiroContato || undefined}
            error={errors.prazo_entrega?.message}
            actions={
              <Atalhos
                rotulo="Atalhos: prazo"
                itens={PRAZOS.map((d) => ({
                  rotulo: `+${d} dias`,
                  valor: somarDias(basePrazo, d),
                  descricao: `Prazo de ${d} dias`,
                }))}
                atual={prazo}
                onEscolher={(v) => definir("prazo_entrega", v)}
              />
            }
            {...register("prazo_entrega")}
          />
          <Field
            label="Fechamento"
            type="date"
            min={primeiroContato || undefined}
            error={errors.data_fechamento?.message}
            {...register("data_fechamento")}
          />
          <Field
            label="Conclusão"
            type="date"
            min={primeiroContato || undefined}
            error={errors.data_conclusao?.message}
            {...register("data_conclusao")}
          />
        </div>
      </Section>

      <Section
        id="sec-ficha"
        title="Ficha técnica"
        description="Os mesmos campos da ficha em papel."
      >
        <label className="flex min-h-11 cursor-pointer items-center gap-3 self-start text-[15px] font-medium">
          <input
            type="checkbox"
            className="m-0 size-5 cursor-pointer accent-primary"
            {...register("com_ficha")}
          />
          Preencher ficha técnica neste atendimento
        </label>

        {comFicha && (
          <div className="flex flex-col gap-5 animate-fade">
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
          <FichaVisualAoVivo control={control} className="lg:sticky lg:top-16 lg:order-last" />
          <div className="flex min-w-0 flex-col gap-5">
            <ChoiceGroup legend="Tipo *">
              {TIPOS.map((t) => (
                <Choice
                  key={t.value}
                  label={t.label}
                  value={t.value}
                  {...register("ficha.tipo")}
                />
              ))}
            </ChoiceGroup>

            {tipo !== "protese" ? (
              <>
                <div className="grid gap-5 sm:grid-cols-[2fr_1fr]">
                  <Controller
                    control={control}
                    name="ficha.produto"
                    render={({ field, fieldState }) => (
                      <Combobox
                        ref={field.ref}
                        name={field.name}
                        label="Produto"
                        value={field.value ?? ""}
                        placeholder="Escolha da lista ou digite"
                        hint="A lista pode ser editada em Configurações."
                        error={fieldState.error?.message}
                        opcoes={produtosFicha.map((p) => ({
                          id: p,
                          rotulo: p,
                        }))}
                        textoLivre
                        vazio="Nenhum produto da lista com esse nome."
                        onInputChange={(v) => field.onChange(v)}
                        onEscolher={(o) => {
                          field.onChange(o.rotulo);
                          sugerirDescricao(
                            o.rotulo,
                            getValues("ficha.lateralidade"),
                          );
                        }}
                        onBlur={field.onBlur}
                      />
                    )}
                  />
                  <Field
                    label="Tamanho do calçado"
                    autoComplete="off"
                    inputMode="decimal"
                    placeholder="Ex.: 28"
                    error={errors.ficha?.tamanho_calcado?.message}
                    {...register("ficha.tamanho_calcado")}
                  />
                </div>
                <ChoiceGroup legend="Lateralidade">
                  {LATERALIDADES.map((l) => (
                    <Choice
                      key={l.value}
                      label={l.label}
                      value={l.value}
                      {...register("ficha.lateralidade", {
                        onChange: (e) => {
                          const produto = getValues("ficha.produto") ?? "";
                          if (produto.trim())
                            sugerirDescricao(produto, e.target.value);
                        },
                      })}
                    />
                  ))}
                </ChoiceGroup>

                <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
                  <legend className="mb-2 p-0 text-sm font-semibold text-ink">
                    Especificações
                  </legend>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {especificacoes.map((e) => (
                      <Choice
                        key={e}
                        type="checkbox"
                        label={e}
                        value={e}
                        {...register("ficha.especificacoes")}
                      />
                    ))}
                  </div>
                </fieldset>

                <div className="grid items-end gap-5 sm:grid-cols-[auto_1fr]">
                  <ChoiceGroup legend="Compensação">
                    <Choice
                      label="Nenhuma"
                      value=""
                      {...register("ficha.compensacao_lado")}
                    />
                    <Choice
                      label="D"
                      value="D"
                      {...register("ficha.compensacao_lado")}
                    />
                    <Choice
                      label="E"
                      value="E"
                      {...register("ficha.compensacao_lado")}
                    />
                  </ChoiceGroup>
                  {compLado && (
                    <div className="animate-fade">
                      <Field
                        label="Medida da compensação"
                        placeholder="Ex.: 1,5 cm"
                        autoComplete="off"
                        error={errors.ficha?.compensacao_medida?.message}
                        {...register("ficha.compensacao_medida")}
                      />
                    </div>
                  )}
                </div>

                <TextareaField
                  label="Medidas"
                  rows={3}
                  hint="Ex.: panturrilha 24 cm, tornozelo 19 cm, ML 6 cm, altura 30 cm."
                  error={errors.ficha?.medidas_ml?.message}
                  {...register("ficha.medidas_ml")}
                />

                <fieldset className="m-0 flex min-w-0 flex-col gap-4 rounded-field border border-line p-4">
                  <legend className="px-1 text-sm font-semibold text-ink">
                    Personalização
                  </legend>
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 self-start text-[15px]">
                    <input
                      type="checkbox"
                      className="m-0 size-5 cursor-pointer accent-primary"
                      {...register("ficha.nome_na_ortese")}
                    />
                    Nome na órtese
                  </label>
                  <div className="grid gap-5 sm:grid-cols-3">
                    <Field
                      label={nomeNaOrtese ? "Tema" : "Tema (opcional)"}
                      autoComplete="off"
                      placeholder="Ex.: dinossauros"
                      error={errors.ficha?.tema?.message}
                      {...register("ficha.tema")}
                    />
                    <Field
                      label="Cor do forro"
                      autoComplete="off"
                      error={errors.ficha?.cor_forro?.message}
                      {...register("ficha.cor_forro")}
                    />
                    <Field
                      label="Cor da tira"
                      autoComplete="off"
                      error={errors.ficha?.cor_tira?.message}
                      {...register("ficha.cor_tira")}
                    />
                  </div>
                </fieldset>
              </>
            ) : (
              <>
                <div className="grid gap-5 lg:grid-cols-3">
                  <ChoiceGroup legend="Membro">
                    <Choice
                      label="Superior"
                      value="superior"
                      {...register("ficha.protese_membro")}
                    />
                    <Choice
                      label="Inferior"
                      value="inferior"
                      {...register("ficha.protese_membro")}
                    />
                  </ChoiceGroup>
                  <ChoiceGroup legend="Nível">
                    <Choice
                      label="Transtibial"
                      value="transtibial"
                      {...register("ficha.protese_nivel")}
                    />
                    <Choice
                      label="Transfemoral"
                      value="transfemoral"
                      {...register("ficha.protese_nivel")}
                    />
                  </ChoiceGroup>
                  <ChoiceGroup legend="Lado">
                    <Choice
                      label="D"
                      value="D"
                      {...register("ficha.protese_lado")}
                    />
                    <Choice
                      label="E"
                      value="E"
                      {...register("ficha.protese_lado")}
                    />
                  </ChoiceGroup>
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field
                    label="Liner"
                    autoComplete="off"
                    error={errors.ficha?.liner?.message}
                    {...register("ficha.liner")}
                  />
                  <Field
                    label="Tamanho do pé"
                    autoComplete="off"
                    inputMode="decimal"
                    placeholder="Ex.: 25 cm"
                    error={errors.ficha?.tamanho_pe?.message}
                    {...register("ficha.tamanho_pe")}
                  />
                </div>
              </>
            )}
          </div>
          </div>
            <TextareaField
              label="Observações da ficha"
              error={errors.ficha?.observacoes?.message}
              {...register("ficha.observacoes")}
            />
          </div>
        )}
      </Section>

      <Section id="sec-pag" title="Pagamento">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Field
            label="Valor (R$)"
            prefix="R$"
            placeholder="0,00"
            error={errors.valor?.message}
            {...dinheiro(register("valor"))}
          />
          <Field
            label="Valor pago (R$)"
            prefix="R$"
            placeholder="0,00"
            error={errors.valor_pago?.message}
            {...dinheiro(
              register("valor_pago", {
                onChange: (e) => aoMudarPago(e.target.value),
              }),
            )}
          />
          <div className="flex flex-col gap-2" aria-live="polite">
            <span className="text-sm font-semibold text-ink">Situação</span>
            <div className="flex min-h-[50px] flex-wrap items-center gap-2">
              <StatusChip tone={pg.tone} size="md">
                {pg.label}
              </StatusChip>
              {restante > 0 && (
                <span className="text-sm text-muted">
                  falta {formatBRL(restante)}
                </span>
              )}
            </div>
          </div>
        </div>

        <fieldset className="m-0 flex min-w-0 flex-col gap-3 rounded-field border border-line bg-surface/60 p-4">
          <legend className="px-1 text-sm font-semibold text-ink">
            Forma de pagamento
          </legend>
          <div className="grid gap-4 lg:grid-cols-3">
            {GRUPOS_FORMA.map((g) => (
              <div
                key={g.grupo}
                role="group"
                aria-labelledby={`forma-${g.grupo}`}
                className="flex flex-col gap-2"
              >
                <span
                  id={`forma-${g.grupo}`}
                  className="text-xs font-semibold tracking-[0.06em] text-muted uppercase"
                >
                  {g.titulo}
                </span>
                <div className="flex flex-wrap gap-2">
                  {FORMAS.filter((f) => f.grupo === g.grupo).map((f) => (
                    <Choice
                      key={f.value}
                      label={f.label}
                      value={f.value}
                      {...register("pagamento_forma", {
                        onChange: (e) => {
                          // Ao trocar para uma forma parcelável, começa em 1x; nas demais, limpa as parcelas.
                          const v = e.target.value as FormaPagamento;
                          setValue(
                            "pagamento_parcelas",
                            PARCELAVEIS.includes(v)
                              ? getValues("pagamento_parcelas") || "1"
                              : "",
                            { shouldDirty: true },
                          );
                        },
                      })}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
          {forma === "cartao" && (
            <p className="m-0 text-[13px] text-muted">
              Registro antigo: “Cartão” sem crédito ou débito. Escolha um deles
              para atualizar.
            </p>
          )}
          {forma && (
            <Button
              variant="ghost"
              className="-ml-2 self-start"
              onClick={() => {
                setValue("pagamento_forma", "", { shouldDirty: true });
                setValue("pagamento_parcelas", "", { shouldDirty: true });
              }}
            >
              Limpar forma de pagamento
            </Button>
          )}

          {parcelavel && (
            <div className="grid gap-4 sm:grid-cols-2 animate-rise">
              <SelectField label="Parcelas" {...register("pagamento_parcelas")}>
                {Array.from({ length: MAX_PARCELAS }, (_, i) => i + 1).map(
                  (n) => (
                    <option key={n} value={String(n)}>
                      {n === 1
                        ? "1x (à vista)"
                        : valorNum > 0
                          ? `${n}x de ${formatBRL(valorNum / n)}`
                          : `${n}x`}
                    </option>
                  ),
                )}
              </SelectField>
              <div className="flex flex-col gap-2" aria-live="polite">
                <span className="text-sm font-semibold text-ink">Resumo</span>
                <p className="m-0 flex min-h-[50px] items-center text-[15px] text-ink-soft">
                  {valorNum > 0
                    ? Number(parcelas) > 1
                      ? `${parcelas} parcelas de ${formatBRL(valorNum / Number(parcelas))} · total ${formatBRL(valorNum)}`
                      : `Pagamento único de ${formatBRL(valorNum)}`
                    : "Informe o valor para ver as parcelas."}
                </p>
              </div>
            </div>
          )}
        </fieldset>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Detalhe do pagamento"
            placeholder={
              DICA_DETALHE[forma as FormaPagamento] ??
              "Ex.: entrada + restante na entrega"
            }
            autoComplete="off"
            error={errors.pagamento_detalhe?.message}
            {...register("pagamento_detalhe")}
          />
          <Field
            label="Data do pagamento"
            type="date"
            max={hoje}
            error={errors.data_pagamento?.message}
            actions={
              <Atalhos
                rotulo="Atalhos: pagamento"
                itens={[{ rotulo: "Hoje", valor: hoje }]}
                atual={dataPagamento}
                onEscolher={(v) => definir("data_pagamento", v)}
              />
            }
            {...register("data_pagamento")}
          />
        </div>
        {parseBRL(valor) > 0 && parseBRL(valorPago) < parseBRL(valor) && (
          <Button
            variant="ghost"
            className="self-start"
            onClick={() => {
              definir("valor_pago", valor);
              aoMudarPago(valor);
            }}
          >
            Marcar como pago integralmente
          </Button>
        )}
      </Section>

      <Section id="sec-obs" title="Observações gerais">
        <TextareaField
          label="Observações"
          error={errors.observacoes?.message}
          {...register("observacoes")}
        />
      </Section>

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-end gap-3 border-t border-line bg-white/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-card sm:border">
        <Link to={voltar} className={buttonClass("ghost")}>
          Cancelar
        </Link>
        <Button type="submit" loading={isSubmitting}>
          {isSubmitting
            ? "Salvando…"
            : editing
              ? "Salvar alterações"
              : "Abrir atendimento"}
        </Button>
      </div>
    </form>
  );
}
