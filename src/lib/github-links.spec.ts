import { describe, it, expect } from 'vitest'
import { ghEdit, ghNew, ghView, ghHistory } from './github-links'

const REPO = 'Mintly-Autonomos/Documents'

describe('github-links', () => {
  it('editar aponta pro editor web no caminho docs/', () => {
    expect(ghEdit(REPO, 'guias/setup.md'))
      .toBe('https://github.com/Mintly-Autonomos/Documents/edit/main/docs/guias/setup.md')
  })
  it('novo aponta pra pasta atual', () => {
    expect(ghNew(REPO, 'guias'))
      .toBe('https://github.com/Mintly-Autonomos/Documents/new/main/docs/guias')
  })
  it('novo na raiz aponta pra docs/', () => {
    expect(ghNew(REPO, ''))
      .toBe('https://github.com/Mintly-Autonomos/Documents/new/main/docs')
  })
  it('ver e historico apontam pro blob/commits', () => {
    expect(ghView(REPO, 'a.md')).toBe('https://github.com/Mintly-Autonomos/Documents/blob/main/docs/a.md')
    expect(ghHistory(REPO, 'a.md')).toBe('https://github.com/Mintly-Autonomos/Documents/commits/main/docs/a.md')
  })
})
