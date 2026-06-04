import { describe, it, expect } from 'vitest'
import { readingTimeMin, tocFromHeadings } from './reading'

describe('readingTimeMin', () => {
  it('arredonda pra cima, minimo 1', () => {
    expect(readingTimeMin('uma duas tres')).toBe(1)
    expect(readingTimeMin(Array(401).fill('x').join(' '))).toBe(3)
  })
})

describe('tocFromHeadings', () => {
  it('mantem apenas depth 2 e 3', () => {
    const toc = tocFromHeadings([
      { depth: 1, slug: 'a', text: 'A' },
      { depth: 2, slug: 'b', text: 'B' },
      { depth: 3, slug: 'c', text: 'C' },
      { depth: 4, slug: 'd', text: 'D' },
    ])
    expect(toc.map((h) => h.slug)).toEqual(['b', 'c'])
  })
})
