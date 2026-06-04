import { defineConfig } from 'astro/config'
import { visit } from 'unist-util-visit'

function remarkMermaid () {
  return (tree) => {
    visit(tree, 'code', (node) => {
      if (node.lang === 'mermaid') {
        node.type = 'html'
        node.value = `<pre class="mermaid">${node.value}</pre>`
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
