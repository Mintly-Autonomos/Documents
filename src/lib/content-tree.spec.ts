import { describe, it, expect } from 'vitest'
import { fileURLToPath } from 'node:url'
import { buildContentTree } from './content-tree'

const ROOT = fileURLToPath(new URL('./__fixtures__/docs', import.meta.url))

describe('buildContentTree', () => {
  const tree = buildContentTree(ROOT)

  it('a raiz é uma pasta com path vazio', () => {
    expect(tree.type).toBe('folder')
    expect(tree.path).toBe('')
  })

  it('lista pastas antes de arquivos, ambos ordenados por nome', () => {
    const names = tree.children.map((c) => c.name)
    expect(names).toEqual(['guias', 'intro.md'])
  })

  it('classifica o kind dos arquivos', () => {
    const guias = tree.children.find((c) => c.name === 'guias') as any
    const svg = guias.children.find((c: any) => c.name === 'diagrama.svg')
    expect(svg.type).toBe('file')
    expect(svg.kind).toBe('image')
  })

  it('paths são relativos e com barra', () => {
    const guias = tree.children.find((c) => c.name === 'guias') as any
    const setup = guias.children.find((c: any) => c.name === 'setup.md')
    expect(setup.path).toBe('guias/setup.md')
  })
})
