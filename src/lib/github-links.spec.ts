import { describe, it, expect } from 'vitest'
import { ghEdit, ghNew, ghNewFolder, ghView, ghHistory, normalizeFolderName } from './github-links'

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

describe('nova pasta', () => {
  it('normaliza o nome: tira espacos e barras nas pontas, colapsa barras', () => {
    expect(normalizeFolderName('  atas ')).toBe('atas')
    expect(normalizeFolderName('/atas//2026/')).toBe('atas/2026')
    expect(normalizeFolderName('a\\b')).toBe('a/b')
  })
  it('rejeita nome vazio, . e ..', () => {
    expect(normalizeFolderName('   ')).toBe('')
    expect(normalizeFolderName('../fora')).toBe('')
    expect(normalizeFolderName('a/./b')).toBe('')
  })
  it('remove caracteres invalidos', () => {
    expect(normalizeFolderName('a:b*c?')).toBe('abc')
  })
  it('na raiz aponta pra docs/ com README dentro da pasta nova', () => {
    expect(ghNewFolder(REPO, '', 'atas'))
      .toBe('https://github.com/Mintly-Autonomos/Documents/new/main/docs?filename=atas/README.md&value=%23%20atas%0A')
  })
  it('em subpasta aponta pra pasta atual e aceita aninhado', () => {
    expect(ghNewFolder(REPO, 'sistema/api', 'decisoes/2026'))
      .toBe('https://github.com/Mintly-Autonomos/Documents/new/main/docs/sistema/api?filename=decisoes/2026/README.md&value=%23%202026%0A')
  })
  it('codifica espacos e acentos por segmento', () => {
    expect(ghNewFolder(REPO, '', 'reuniões semanais'))
      .toBe('https://github.com/Mintly-Autonomos/Documents/new/main/docs?filename=reuni%C3%B5es%20semanais/README.md&value=%23%20reuni%C3%B5es%20semanais%0A')
  })
})
