import { describe, it, expect } from 'vitest'
import { fileKind } from './file-kind'

describe('fileKind', () => {
  it('classifica markdown', () => {
    expect(fileKind('readme.md')).toBe('markdown')
    expect(fileKind('a/b/NOTE.MARKDOWN')).toBe('markdown')
  })
  it('classifica pdf', () => {
    expect(fileKind('contrato.pdf')).toBe('pdf')
  })
  it('classifica imagem', () => {
    expect(fileKind('diagrama.SVG')).toBe('image')
    expect(fileKind('foto.jpeg')).toBe('image')
  })
  it('classifica office', () => {
    expect(fileKind('plan.xlsx')).toBe('office')
    expect(fileKind('deck.pptx')).toBe('office')
    expect(fileKind('doc.docx')).toBe('office')
  })
  it('cai em other para o resto', () => {
    expect(fileKind('dados.csv')).toBe('other')
    expect(fileKind('semextensao')).toBe('other')
  })
})
