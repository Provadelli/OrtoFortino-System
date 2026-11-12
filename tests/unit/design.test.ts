import { describe, expect, it } from 'vitest'
import { DIAGRAMAS, diagramaPara, medidasDoBanco, medidasParaSalvar, progresso } from '../../src/features/atendimentos/ficha/diagramas'
import { atendimentoVazio, toPayload } from '../../src/features/atendimentos/schema'
import { intervalo, montarSerie, pontosDaColuna } from '../../src/features/dashboard/dados-recebimentos'
import { linkSuporte } from '../../src/lib/suporte'

describe('boneco da ficha', () => {
  it('escolhe o desenho pelo tipo e produto', () => {
    expect(diagramaPara('ortese', 'AFO articulada')).toBe('pernas')
    expect(diagramaPara('ortese', 'Colete OTLS')).toBe('colete')
    expect(diagramaPara('ortese', 'Extensores')).toBe('extensores')
    expect(diagramaPara('protese', 'qualquer')).toBe('encaixe')
    expect(diagramaPara('palmilha', '')).toBe('pernas')
  })
  it('unilateral conta só o lado escolhido', () => {
    const d = DIAGRAMAS.pernas
    const m = { pernas: { d_sup: '24', e_sup: '23' } }
    expect(progresso(m, d, 'bilateral')).toEqual({ preenchidos: 2, total: 10 })
    expect(progresso(m, d, 'unilateral_d')).toEqual({ preenchidos: 1, total: 6 })
  })
  it('salva só o desenho em uso, sem vazios e sem o lado não usado', () => {
    const m = { pernas: { d_sup: '24', e_sup: '23', d_med: ' ' }, colete: { c1: '80' } }
    expect(medidasParaSalvar(m, DIAGRAMAS.pernas, 'unilateral_d')).toEqual({ 'pernas.d_sup': '24' })
    expect(medidasDoBanco({ 'pernas.d_sup': '24', 'xx.y': '1', ruim: 2 })).toEqual({ pernas: { d_sup: '24' } })
  })
  it('toPayload envia as medidas planas da ficha', () => {
    const base = atendimentoVazio('11111111-1111-4111-8111-111111111111', '2026-11-09')
    const p = toPayload({ ...base, com_ficha: true, ficha: { ...base.ficha, produto: 'Colete OTLS', medidas: { colete: { c1: '80' }, pernas: { d_sup: '24' } } } })
    expect(p.ficha?.medidas).toEqual({ 'colete.c1': '80' })
  })
})

describe('suporte', () => {
  it('abre o WhatsApp com a tela, sem ids', () => {
    const url = linkSuporte('/atendimentos/22222222-2222-4222-8222-222222222222/editar?x=1')
    expect(url.startsWith('https://wa.me/5500000000000?text=')).toBe(true)
    const texto = decodeURIComponent(url.split('text=')[1]!)
    expect(texto).toContain('Tela: /atendimentos/:id/editar')
    expect(texto).not.toContain('2222')
  })
})

describe('recebimentos do painel', () => {
  it('monta período anterior e atual com a variação', () => {
    const s = montarSerie(
      [
        { dia: '2026-11-11', total: 300 },
        { dia: '2026-11-05', total: 100 },
        { dia: '2026-11-04', total: 200 },
      ],
      '7d',
      '2026-11-11',
    )
    expect(s.colunas).toHaveLength(14)
    expect(s.totalAtual).toBe(400)
    expect(s.totalAnterior).toBe(200)
    expect(s.variacao).toBe(100)
    expect(s.colunas.at(-1)).toMatchObject({ rotulo: '11/11', periodo: 'atual' })
  })
  it('12 meses agrupa por mês; sem base anterior não calcula variação', () => {
    const s = montarSerie([{ dia: '2026-10-03', total: 50 }, { dia: '2026-10-20', total: 25 }], '12m', '2026-11-11')
    expect(s.colunas.find((c) => c.chave === '2026-10')?.valor).toBe(75)
    expect(s.variacao).toBeNull()
    expect(intervalo('12m', '2026-11-11')).toEqual({ de: '2024-12-01', ate: '2026-11-11' })
  })
  it('pontos proporcionais ao maior valor', () => {
    expect(pontosDaColuna(0, 100)).toBe(0)
    expect(pontosDaColuna(1, 100)).toBe(1)
    expect(pontosDaColuna(100, 100)).toBe(12)
  })
})
