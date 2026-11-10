-- Fase 3 · Painel com dados reais
-- Uma única chamada devolve todos os números do painel, agregados no banco.
-- security invoker: as políticas de RLS de atendimentos/pacientes continuam valendo.
-- p_hoje vem do navegador (fuso de quem usa), evitando o UTC do servidor.

create or replace function public.painel_resumo(p_hoje date)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_ativos public.status_atendimento[] := array['em_contato', 'em_producao', 'pronto']::public.status_atendimento[];
  v_resultado jsonb;
begin
  if not public.is_staff() then
    raise exception 'acesso negado' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'em_contato',      count(*) filter (where a.status = 'em_contato'),
    'em_producao',     count(*) filter (where a.status = 'em_producao'),
    'prontos',         count(*) filter (where a.status = 'pronto'),
    'entregues_mes',   count(*) filter (where a.status = 'entregue' and a.data_conclusao >= date_trunc('month', p_hoje)::date),
    'entregas_semana', count(*) filter (where a.status = any (v_ativos) and a.prazo_entrega between p_hoje and p_hoje + 6),
    'atrasados',       count(*) filter (where a.status = any (v_ativos) and a.prazo_entrega < p_hoje),
    'a_receber',       coalesce(sum(a.valor - a.valor_pago) filter (where a.pagamento_status in ('pendente', 'parcial') and a.status <> 'cancelado'), 0),
    'pagamentos_abertos', count(*) filter (where a.pagamento_status in ('pendente', 'parcial') and a.status <> 'cancelado')
  )
  into v_resultado
  from public.atendimentos a;

  -- Próximos prazos (atrasados primeiro, por estarem no passado)
  v_resultado := v_resultado || jsonb_build_object('prazos', coalesce((
    select jsonb_agg(x order by x.prazo_entrega, x.numero)
    from (
      select a.id, a.numero, a.status, a.prazo_entrega, a.categoria,
             coalesce(nullif(a.descricao, ''), f.produto) as servico,
             p.nome as paciente
      from public.atendimentos a
      join public.pacientes p on p.id = a.paciente_id
      left join public.fichas_tecnicas f on f.atendimento_id = a.id
      where a.status = any (v_ativos) and a.prazo_entrega is not null
      order by a.prazo_entrega, a.numero
      limit 6
    ) x
  ), '[]'::jsonb));

  -- Maiores saldos a receber
  v_resultado := v_resultado || jsonb_build_object('receber', coalesce((
    select jsonb_agg(x order by x.restante desc, x.numero)
    from (
      select a.id, a.numero, a.pagamento_status, a.pagamento_forma, a.pagamento_detalhe,
             (a.valor - a.valor_pago) as restante,
             p.nome as paciente
      from public.atendimentos a
      join public.pacientes p on p.id = a.paciente_id
      where a.pagamento_status in ('pendente', 'parcial') and a.status <> 'cancelado'
      order by (a.valor - a.valor_pago) desc, a.numero
      limit 5
    ) x
  ), '[]'::jsonb));

  return v_resultado;
end;
$$;

revoke execute on function public.painel_resumo(date) from public, anon;
grant execute on function public.painel_resumo(date) to authenticated;
