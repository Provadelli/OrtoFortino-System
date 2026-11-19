import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: { env: { VITE_WHATSAPP_SUPORTE: '5500000000000' }, include: ['tests/unit/**/*.test.ts', 'tests/api/**/*.test.ts'] },
})
