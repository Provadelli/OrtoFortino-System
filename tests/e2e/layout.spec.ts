// Responsividade: em todas as telas principais (computador e celular), nada de
// rolagem lateral nem de "espaço vazio" depois do último conteúdo da página.
import { expect, test, type Page } from '@playwright/test'
import { mockAuth, mockPainel } from './fixtures'

const DESLOGADO = ['/login', '/esqueci-senha', '/pagina-que-nao-existe']
const LOGADO = [
  '/painel',
  '/clientes',
  '/clientes/novo',
  '/atendimentos',
  '/atendimentos/novo',
  '/orcamentos',
  '/orcamentos/novo',
  '/tabela-de-precos',
  '/configuracoes',
]

// Formulários: a barra Salvar/Cancelar fica presa embaixo e precisa terminar junto com a página.
const FORMULARIOS = new Set(['/clientes/novo', '/atendimentos/novo', '/orcamentos/novo'])

/** Banco vazio para tudo que não tiver mock próprio (as telas mostram o estado vazio). */
async function bancoVazio(page: Page) {
  await page.route('**/rest/v1/**', (r) => r.fulfill({ json: [] }))
}

async function medir(page: Page) {
  // espera as entradas animadas terminarem
  await page.waitForTimeout(1600)
  return page.evaluate(() => {
    const doc = document.scrollingElement!
    let fundo = 0
    for (const el of document.body.querySelectorAll<HTMLElement>('*')) {
      if (el.closest('[aria-hidden="true"]')) continue // decoração (rabiscos, raios) não conta
      const cs = getComputedStyle(el)
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.position === 'fixed') continue
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      fundo = Math.max(fundo, r.bottom + window.scrollY)
    }
    return {
      larguraExtra: doc.scrollWidth - doc.clientWidth,
      sobraEmbaixo: Math.round(doc.scrollHeight - fundo),
      altura: doc.scrollHeight,
    }
  })
}

for (const rota of DESLOGADO) {
  test(`sem rolagem lateral nem vazio no fim: ${rota}`, async ({ page }) => {
    await mockAuth(page, { loggedIn: false })
    await page.goto(rota)
    const m = await medir(page)
    expect(m.larguraExtra, 'rolagem lateral').toBeLessThanOrEqual(0)
    expect(m.sobraEmbaixo, `espaço vazio no fim (altura ${m.altura})`).toBeLessThanOrEqual(56)
  })
}

for (const rota of LOGADO) {
  test(`sem rolagem lateral nem vazio no fim: ${rota}`, async ({ page }) => {
    await bancoVazio(page)
    await mockAuth(page, { loggedIn: true })
    await mockPainel(page)
    await page.goto(rota)
    const m = await medir(page)
    expect(m.larguraExtra, 'rolagem lateral').toBeLessThanOrEqual(0)
    // 48 px = respiro padrão no fim das páginas; formulários terminam na barra de ações
    expect(m.sobraEmbaixo, `espaço vazio no fim (altura ${m.altura})`).toBeLessThanOrEqual(FORMULARIOS.has(rota) ? 1 : 56)
  })
}
