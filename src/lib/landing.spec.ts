import { describe, it, expect } from 'vitest'
import { topLevelSections } from './landing'
import type { FolderNode } from './content-tree'

const file = (name: string, path: string) => ({ type: 'file' as const, name, path, kind: 'markdown' as const })
const folder = (name: string, path: string, children: FolderNode['children']): FolderNode =>
  ({ type: 'folder', name, path, children })

const tree: FolderNode = folder('', '', [
  folder('diagrams', 'diagrams', [file('a.md', 'diagrams/a.md'), file('b.md', 'diagrams/b.md')]),
  folder('release-notes', 'release-notes', [
    folder('antigas', 'release-notes/antigas', [file('r0.md', 'release-notes/antigas/r0.md')]),
    file('r1.md', 'release-notes/r1.md'),
  ]),
  file('solto.md', 'solto.md'),
])

describe('topLevelSections', () => {
  it('lista só as pastas top-level, na ordem da árvore', () => {
    const sections = topLevelSections(tree)
    expect(sections.map(s => s.name)).toEqual(['diagrams', 'release-notes'])
    expect(sections.map(s => s.path)).toEqual(['diagrams', 'release-notes'])
  })

  it('conta arquivos recursivamente (subpastas incluídas)', () => {
    const sections = topLevelSections(tree)
    expect(sections.find(s => s.name === 'diagrams')?.count).toBe(2)
    expect(sections.find(s => s.name === 'release-notes')?.count).toBe(2)
  })

  it('usa a descrição curada quando existe e fallback quando não', () => {
    const sections = topLevelSections(tree, { 'release-notes': 'Notas de cada ciclo de release.' })
    expect(sections.find(s => s.name === 'release-notes')?.description).toBe('Notas de cada ciclo de release.')
    expect(sections.find(s => s.name === 'diagrams')?.description).toBe('Documentos da pasta diagrams.')
  })
})
