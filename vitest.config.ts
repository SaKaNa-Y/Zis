import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts', 'tests/**/*.test.ts'],
  },
  resolve: {
    // The same `@/` the app and the pipeline use, so a test cannot accidentally
    // exercise a second copy of a shared module.
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
})
