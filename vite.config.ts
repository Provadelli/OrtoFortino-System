import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseEnv } from 'node:util'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import { apiDevServer } from './scripts/vite-api-dev.ts'

/**
 * Injeta <link rel="preload"> para as fontes da primeira dobra
 * (Poppins 700, dos títulos). A Inter (48 KB) fica de fora: tem fallback com as mesmas
 * métricas (fonts.css) e, pré-carregada, disputava banda com o JS da tela no celular.
 */
function preloadCriticalFonts(): Plugin {
  const critical = [/poppins-latin-700-normal.*\.woff2$/]
  return {
    name: 'of:preload-fonts',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        if (!ctx.bundle) return
        return Object.keys(ctx.bundle)
          .filter((file) => critical.some((re) => re.test(file)))
          .map((file) => ({
            tag: 'link',
            attrs: { rel: 'preload', href: `/${file}`, as: 'font', type: 'font/woff2', crossorigin: '' },
            injectTo: 'head' as const,
          }))
      },
    },
  }
}

/**
 * Login (a porta de entrada e o que o PageSpeed mede): anuncia no HTML o código da tela de login
 * e a logo, que de outra forma só seriam descobertos depois de baixar e rodar o JS principal.
 * Corta duas idas e voltas na rede no celular. (~30 KB, ficam em cache para as próximas visitas.)
 */
function preloadLogin(): Plugin {
  return {
    name: 'of:preload-login',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        const bundle = ctx.bundle
        if (!bundle) return
        const entrada = Object.values(bundle).find((c) => c.type === 'chunk' && c.isEntry)
        const login = Object.values(bundle).find((c) => c.type === 'chunk' && /features[\\/]auth[\\/]LoginPage\.tsx$/.test(c.facadeModuleId ?? ''))
        if (!login || login.type !== 'chunk') return
        const arquivos = new Set<string>()
        const visitar = (nome: string) => {
          const c = bundle[nome]
          if (!c || c.type !== 'chunk' || arquivos.has(nome) || nome === entrada?.fileName) return
          if (entrada?.type === 'chunk' && entrada.imports.includes(nome)) return // o Vite já anuncia
          arquivos.add(nome)
          c.imports.forEach(visitar)
        }
        visitar(login.fileName)
        const logo = Object.keys(bundle).find((f) => /logo-orto-fortino-[\w-]+\.svg$/.test(f) && !f.includes('sem-slogan'))
        return [
          ...(logo ? [{ tag: 'link', attrs: { rel: 'preload', href: `/${logo}`, as: 'image', type: 'image/svg+xml', fetchpriority: 'high' }, injectTo: 'head' as const }] : []),
          ...[...arquivos].map((f) => ({ tag: 'link', attrs: { rel: 'modulepreload', crossorigin: '', href: `/${f}` }, injectTo: 'head' as const })),
        ]
      },
    },
  }
}

/**
 * Headers de segurança da produção (vercel.json, rota "/(.*)") aplicados também ao `vite preview`,
 * onde rodam os testes E2E: assim a CSP real vale nos testes (ex.: o PDF precisa de WebAssembly).
 * HSTS e upgrade-insecure-requests ficam de fora porque o preview é HTTP em localhost.
 */
function productionHeaders() {
  const cfg = JSON.parse(readFileSync('vercel.json', 'utf8')) as { headers: { source: string; headers: { key: string; value: string }[] }[] }
  const out: Record<string, string> = {}
  for (const { key, value } of cfg.headers.find((h) => h.source === '/(.*)')?.headers ?? []) {
    if (key === 'Strict-Transport-Security') continue
    out[key] = key === 'Content-Security-Policy' ? value.replace(/;\s*upgrade-insecure-requests/, '') : value
  }
  return out
}

function readEnvFiles(mode: string) {
  const out: Record<string, string> = {}
  for (const file of ['.env', '.env.local', `.env.${mode}`, `.env.${mode}.local`]) {
    if (existsSync(file)) Object.assign(out, parseEnv(readFileSync(file, 'utf8')))
  }
  return out
}

export default defineConfig(({ mode }) => {
  // Variáveis sem prefixo VITE_ ficam só no processo do servidor (BFF local).
  // Os arquivos .env* têm prioridade, para uma chave trocada valer já no reinício automático.
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''), readEnvFiles(mode))

  return {
    plugins: [react(), tailwindcss(), preloadCriticalFonts(), preloadLogin(), apiDevServer()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        '@fonts': fileURLToPath(new URL('./node_modules/@fontsource', import.meta.url)),
        '@fonts-var': fileURLToPath(new URL('./node_modules/@fontsource-variable', import.meta.url)),
      },
    },
    build: {
      target: 'es2022',
      cssCodeSplit: true,
      assetsInlineLimit: 0,
      sourcemap: false,
      // O gerador de PDF (~1,2 MB) só é baixado ao clicar em "Baixar PDF" (import dinâmico).
      chunkSizeWarningLimit: 1300,
    },
    server: { port: 5173, strictPort: true },
    preview: { port: 4173, strictPort: true, headers: productionHeaders() },
  }
})
