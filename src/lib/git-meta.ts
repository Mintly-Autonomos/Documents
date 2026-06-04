import { execFileSync } from 'node:child_process'

export interface GitMeta { date: string, author: string }

export function parseGitMeta (line: string): GitMeta | null {
  if (!line) return null
  const [date, author] = line.split('\t')
  if (!date || !author) return null
  return { date, author }
}

export function lastCommit (repoDir: string, relPath: string): GitMeta | null {
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%aI%x09%an', '--', relPath], {
      cwd: repoDir, encoding: 'utf8',
    }).trim()
    return parseGitMeta(out)
  } catch {
    return null
  }
}
