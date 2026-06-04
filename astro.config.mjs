import { defineConfig } from 'astro/config'

export default defineConfig({
  site: 'https://mintly-autonomos.github.io',
  base: '/Documents',
  vite: {
    ssr: {
      external: ['pdf-parse', 'mammoth', 'xlsx'],
    },
  },
})
