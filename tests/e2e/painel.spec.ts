import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { mockAuth, mockPainel } from './fixtures'

async function axe(page: Page) {
  await page.waitForTimeout(900)
  const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze()
  const v = res.violations.map((x) => `${x.id}: ${x.nodes.map((n) => n.target.join(' ')).join(', ')}`)
  expect(v, v.join('\n')).toEqual([])
}

test('painel mostra os números reais e os prazos', async ({ page }) => {
  await mockAuth(page, { loggedIn: true })
  await mockPainel(page)
  await page.goto('/painel')

  const resumo = page.getByRole('region', { name: 'Resumo' })
  await expect(resumo.getByRole('article').filter({ hasText: 'Em produção' })).toContainText('12')
  await expect(resumo.getByRole('article').filter({ hasText: 'Em produção' })).toContainText('3 prontos para entrega')
  await expect(resumo.getByRole('article').filter({ hasText: 'A receber' })).toContainText(/R\$\s*8\.450,00/)
  await expect(resumo.getByRole('link', { name: '1 atrasada' })).toHaveAttribute('href', '/atendimentos?filtro=atrasados')

  const prazos = page.getByRole('region', { name: 'Próximos prazos de entrega' })
  // nome abreviado (LGPD) e alerta conforme a data
  await expect(prazos.getByRole('listitem').nth(0)).toContainText('Polyana L.')
  await expect(prazos.getByRole('listitem').nth(0)).toContainText('Atrasado')
  await expect(prazos.getByRole('listitem').nth(1)).toContainText('Entrega hoje')
  await expect(prazos.getByRole('listitem').nth(1)).toContainText('Confecção') // sem descrição → categoria
  await expect(prazos.getByText('Souza Lima')).toHaveCount(0)

  const receber = page.getByRole('region', { name: 'A receber' })
  await expect(receber.getByRole('listitem').nth(0)).toContainText(/Pix · 50% na aprovação.*R\$\s*2\.450,00.*Parcial/)
  await expect(receber.getByRole('listitem').nth(1)).toContainText('Forma não definida')

  await expect(resumo.getByRole('article').filter({ hasText: 'Orçamentos em aberto' })).toContainText('3')
  await expect(resumo.getByRole('link', { name: '1 vencido' })).toHaveAttribute('href', '/orcamentos')
  const orc = page.getByRole('region', { name: 'Orçamentos recentes' })
  await expect(orc.getByRole('listitem').nth(0)).toContainText(/ORC-2026-0012.*Helena R\..*R\$\s*2\.450,00.*Enviado.*Vencido/)
  await expect(orc.getByRole('listitem').nth(1)).toContainText('Aprovado')
  await expect(orc.getByText('Helena Ribeiro')).toHaveCount(0) // nome abreviado (LGPD)
  await expect(page.getByRole('link', { name: '+ Novo orçamento' })).toHaveAttribute('href', '/orcamentos/novo')
  await axe(page)

  await prazos.getByRole('link', { name: 'Polyana L.' }).click()
  await expect(page).toHaveURL(/\/atendimentos\/a1$/)
})

test('painel vazio não quebra', async ({ page }) => {
  await mockAuth(page, { loggedIn: true })
  await mockPainel(page, {
    body: { em_contato: 0, em_producao: 0, prontos: 0, entregues_mes: 0, entregas_semana: 0, atrasados: 0, a_receber: 0, pagamentos_abertos: 0, prazos: [], receber: [] },
  })
  await page.goto('/painel')
  await expect(page.getByText('Nenhum atendimento em andamento com prazo definido.')).toBeVisible()
  await expect(page.getByText('Nenhum pagamento pendente.')).toBeVisible()
  await expect(page.getByText('Tudo recebido')).toBeVisible()
  await expect(page.getByText('Nenhum orçamento ainda.')).toBeVisible() // banco sem os campos de orçamento também não quebra
  await expect(page.getByText('Nenhum aguardando resposta')).toBeVisible()
  await axe(page)
})

test('erro ao carregar oferece tentar de novo', async ({ page }) => {
  await mockAuth(page, { loggedIn: true })
  await mockPainel(page, { status: 500 })
  await page.goto('/painel')
  await expect(page.getByRole('alert')).toContainText('Não foi possível carregar o painel.')
  await expect(page.getByRole('button', { name: 'Tentar de novo' })).toBeVisible()
})
