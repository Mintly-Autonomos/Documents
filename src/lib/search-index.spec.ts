import { describe, it, expect } from 'vitest'
import { flattenFiles } from './search-index'
import type { FolderNode } from './content-tree'

const tree: FolderNode = {
  type: 'folder', name: '', path: '', children: [
    { type: 'folder', name: 'guias', path: 'guias', children: [
      { type: 'file', name: 'setup.md', path: 'guias/setup.md', kind: 'markdown' },
    ] },
    { type: 'file', name: 'intro.md', path: 'intro.md', kind: 'markdown' },
  ],
}

describe('flattenFiles', () => {
  it('retorna todos os arquivos (sem pastas), com name/path/kind', () => {
    expect(flattenFiles(tree)).toEqual([
      { name: 'setup.md', path: 'guias/setup.md', kind: 'markdown' },
      { name: 'intro.md', path: 'intro.md', kind: 'markdown' },
    ])
  })
})
