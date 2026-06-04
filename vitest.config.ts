import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts'],
    environment: 'node',
    // Os testes de extract.ts geram+parseiam docx/xlsx/pdf reais (~700ms cada);
    // sob carga estouram o default de 5s. Subimos pra evitar flaky no CI.
    testTimeout: 20000,
  },
})
