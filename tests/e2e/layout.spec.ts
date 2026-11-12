// Responsividade: em todas as telas (celular, tablet, notebook e monitor) nada de rolagem
// lateral, conteúdo cortado na borda ou "espaço vazio" depois do último conteúdo da página.
import { expect, test, type Page, type Route } from '@playwright/test'
import { ATENDIMENTO, mockAuth, mockPainel, PACIENTE, painelExemplo } from './fixtures'

const LARGURAS = [360, 768, 1024, 1440]

const DESLOGADO = ['/login', '/esqueci-senha', '/pagina-que-nao-existe']
const LOGADO = [
  '/painel',
  '/clientes',
  '/clientes/novo',
  `/clientes/${PACIENTE.id}`,
  '/atendimentos',
  '/atendimentos/novo',
  `/atendimentos/${ATENDIMENTO.id}`,
  `/atendimentos/${ATENDIMENTO.id}/editar`,
  '/orcamentos',
  '/orcamentos/novo',
  '/tabela-de-precos',
  '/tabela-de-precos/novo',
  '/tabela-de-precos/importar',
  '/configuracoes',
]

// Formulários: a barra Salvar/Cancelar fica presa embaixo e precisa terminar junto com a página.
const FORMULARIOS = new Set(['/clientes/novo', '/atendimentos/novo', `/atendimentos/${ATENDIMENTO.id}/editar`, '/orcamentos/novo'])

const responde = (r: Route, body: unknown) => {
  const objeto = r.request().headers()['accept']?.includes('vnd.pgrst.object')
  return r.fulfill({ json: objeto ? (Array.isArray(body) ? body[0] ?? null : body) : Array.isArray(body) ? body : [body] })
}

/** Banco simulado: um paciente e um atendimento; o resto vazio. */
async function banco(page: Page) {
  await page.route('**/rest/v1/**', (r) => r.fulfill({ json: [] }))
  await page.route('**/rest/v1/pacientes*', (r) => responde(r, { ...PACIENTE, responsaveis: [], cpf_mascarado: '***.982.247-**' }))
  await page.route('**/rest/v1/atendimentos*', (r) => {
    const porId = new URL(r.request().url()).searchParams.get('id')?.startsWith('eq.')
    return porId ? responde(r, ATENDIMENTO) : responde(r, [ATENDIMENTO])
  })
}

async function medir(page: Page) {
  await page.waitForTimeout(1400) // entradas animadas
  return page.evaluate(() => {
    const doc = document.scrollingElement!
    const main = document.querySelector('main')?.getBoundingClientRect()
    let fundo = 0
    const cortados: string[] = []
    for (const el of document.body.querySelectorAll<HTMLElement>('*')) {
      if (el.closest('[aria-hidden="true"]')) continue // decoração (rabiscos, raios)
      if (el.closest('.sr-only')) continue // só para leitores de tela: não é "conteúdo" visível
      const cs = getComputedStyle(el)
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.position === 'fixed' || cs.clipPath !== 'none' || cs.clip !== 'auto') continue
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      fundo = Math.max(fundo, r.bottom + window.scrollY)
      if (!main || !el.closest('main') || el.tagName === 'MAIN') continue
      // dentro de algo que rola na horizontal (tabelas largas, abas) não conta
      let rola = false
      for (let p = el.parentElement; p && p.tagName !== 'MAIN'; p = p.parentElement) {
        const o = getComputedStyle(p).overflowX
        if (o === 'auto' || o === 'scroll' || o === 'hidden' || o === 'clip') { rola = true; break }
      }
      if (!rola && (r.right > main.right + 1 || r.left < main.left - 1)) cortados.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)}`)
    }
    return {
      larguraExtra: doc.scrollWidth - doc.clientWidth,
      sobraEmbaixo: Math.round(doc.scrollHeight - fundo),
      altura: doc.scrollHeight,
      cortados: cortados.slice(0, 5),
    }
  })
}

async function conferir(page: Page, rota: string) {
  const m = await medir(page)
  expect(m.larguraExtra, 'rolagem lateral').toBeLessThanOrEqual(0)
  expect(m.cortados, 'conteúdo passando da borda').toEqual([])
  // 48 px = respiro padrão no fim das páginas; formulários terminam na barra de ações
  expect(m.sobraEmbaixo, `espaço vazio no fim (altura ${m.altura})`).toBeLessThanOrEqual(FORMULARIOS.has(rota) ? 1 : 56)
}

/** Guarda erros e avisos do console (React, rede quebrada, exceções) para a tela sair limpa. */
function ouvirConsole(page: Page) {
  const msgs: string[] = []
  page.on('pageerror', (e) => msgs.push(`exceção: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error' || (m.type() === 'warning' && /React|Warning/.test(m.text()))) msgs.push(`${m.type()}: ${m.text().slice(0, 160)}`)
  })
  return msgs
}

/** No projeto "desktop" percorre as 4 larguras; no "mobile" fica no aparelho emulado. */
function larguras(projeto: string) {
  return projeto === 'desktop' ? LARGURAS : [0]
}

for (const rota of DESLOGADO) {
  test(`layout: ${rota}`, async ({ page }, info) => {
    await mockAuth(page, { loggedIn: false })
    const consoleMsgs = ouvirConsole(page)
    for (const w of larguras(info.project.name)) {
      if (w) await page.setViewportSize({ width: w, height: 860 })
      await page.goto(rota)
      await test.step(`${w || 'celular'} px`, () => conferir(page, rota))
    }
    expect(consoleMsgs, 'console limpo').toEqual([])
  })
}

for (const rota of LOGADO) {
  test(`layout: ${rota}`, async ({ page }, info) => {
    await banco(page)
    await mockAuth(page, { loggedIn: true })
    await mockPainel(page)
    const consoleMsgs = ouvirConsole(page)
    for (const w of larguras(info.project.name)) {
      if (w) await page.setViewportSize({ width: w, height: 860 })
      await page.goto(rota)
      await test.step(`${w || 'celular'} px`, () => conferir(page, rota))
    }
    expect(consoleMsgs, 'console limpo').toEqual([])
  })
}

// Painel com listas desbalanceadas: as duas colunas terminam juntas e nada fica vazio.
const PRAZO = painelExemplo('2026-11-12').prazos[0]!
const RECEBER = painelExemplo('2026-11-12').receber[0]!
const CENARIOS = {
  'muitos prazos e nada a receber': { prazos: Array.from({ length: 6 }, (_, i) => ({ ...PRAZO, id: `p${i}` })), receber: [] },
  'sem prazos e muito a receber': { prazos: [], receber: Array.from({ length: 5 }, (_, i) => ({ ...RECEBER, id: `r${i}` })) },
  'tudo vazio': { prazos: [], receber: [], orcamentos: [] },
}

for (const [nome, extra] of Object.entries(CENARIOS)) {
  test(`painel equilibrado: ${nome}`, async ({ page }, info) => {
    await banco(page)
    await mockAuth(page, { loggedIn: true })
    await mockPainel(page, { body: { ...painelExemplo('2026-11-12'), ...extra } })
    for (const w of larguras(info.project.name)) {
      if (w) await page.setViewportSize({ width: w, height: 860 })
      await page.goto('/painel')
      await test.step(`${w || 'celular'} px`, async () => {
        await conferir(page, '/painel')
        if (w >= 1024) {
          const esq = await page.locator('section[aria-labelledby="titulo-prazos"]').boundingBox()
          const dir = await page.locator('section[aria-labelledby="titulo-receber"]').boundingBox()
          expect(Math.abs(esq!.y + esq!.height - (dir!.y + dir!.height)), 'colunas terminam juntas').toBeLessThanOrEqual(2)
        }
      })
    }
  })
}
