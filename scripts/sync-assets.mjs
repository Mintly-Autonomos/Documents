// scripts/sync-assets.mjs
// Copia todos os arquivos NÃO-markdown de docs/ para public/files/, espelhando a estrutura.
import { cpSync, rmSync, mkdirSync, readdirSync } from 'node:fs'
import { join, extname } from 'node:path'

const SRC = 'docs'
const OUT = 'public/files'
const SKIP = new Set(['.md', '.markdown'])

rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })

function walk (rel = '') {
  const dir = rel ? join(SRC, rel) : SRC
  let entries
  try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return }
  for (const e of entries) {
    if (e.name.startsWith('.')) continue
    const childRel = rel ? `${rel}/${e.name}` : e.name
    if (e.isDirectory()) { walk(childRel); continue }
    if (SKIP.has(extname(e.name).toLowerCase())) continue
    const dest = join(OUT, childRel)
    mkdirSync(join(dest, '..'), { recursive: true })
    cpSync(join(SRC, childRel), dest)
  }
}

walk()
console.log(`[sync-assets] binários copiados para ${OUT}`)
