import { describe, it, expect } from 'vitest'
import { parseGitMeta } from './git-meta'

describe('parseGitMeta', () => {
  it('parseia "ISO\\tAutor"', () => {
    expect(parseGitMeta('2026-06-04T10:00:00-03:00\tAlexandre')).toEqual({
      date: '2026-06-04T10:00:00-03:00', author: 'Alexandre',
    })
  })
  it('retorna null para string vazia', () => {
    expect(parseGitMeta('')).toBeNull()
  })
})
