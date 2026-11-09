import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import { apiDevServer } from './scripts/vite-api-dev.ts'

/**
 * Injeta <link rel="preload"> para as fontes da primeira dobra
 * (Inter variável e Poppins 700), evitando FOUT e atraso no LCP.
 */
function preloadCriticalFonts(): Plugin {
  const critical = [/inter-latin-wght-normal.*\.woff2$/, /poppins-latin-700-normal.*\.woff2$/]
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

export default defineConfig(({ mode }) => {
  // Variáveis sem prefixo VITE_ ficam só no processo do servidor (BFF local).
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''))

  return {
    plugins: [react(), tailwindcss(), preloadCriticalFonts(), apiDevServer()],
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
    },
    server: { port: 5173, strictPort: true },
    preview: { port: 4173, strictPort: true },
  }
})
