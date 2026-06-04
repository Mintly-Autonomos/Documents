import { defineConfig } from 'astro/config'
import { visit } from 'unist-util-visit'

// Escapa &, <, > para não injetar HTML cru. O browser decodifica as entidades
// de volta em textContent, então o mermaid ainda recebe o source correto (round-trip).
const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function remarkMermaid () {
  return (tree) => {
    visit(tree, 'code', (node) => {
      if (node.lang === 'mermaid') {
        node.type = 'html'
        node.value = `<pre class="mermaid">${escapeHtml(node.value)}</pre>`
      }
    })
  }
}

export default defineConfig({
  site: 'https://mintly-autonomos.github.io',
  base: '/Documents',
  markdown: {
    remarkPlugins: [remarkMermaid],
  },
  vite: {
    ssr: {
      external: ['pdf-parse', 'mammoth', 'xlsx'],
    },
  },
})
