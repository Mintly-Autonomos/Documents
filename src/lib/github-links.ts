const BASE = 'https://github.com'
const CONTENT_DIR = 'docs'

const seg = (p: string) => (p ? `/${p}` : '')

export function ghEdit (repo: string, filePath: string): string {
  return `${BASE}/${repo}/edit/main/${CONTENT_DIR}/${filePath}`
}
export function ghNew (repo: string, folderPath: string): string {
  return `${BASE}/${repo}/new/main/${CONTENT_DIR}${seg(folderPath)}`
}
export function ghView (repo: string, filePath: string): string {
  return `${BASE}/${repo}/blob/main/${CONTENT_DIR}/${filePath}`
}
export function ghHistory (repo: string, filePath: string): string {
  return `${BASE}/${repo}/commits/main/${CONTENT_DIR}/${filePath}`
}

const INVALID_CHARS = /[:*?"<>|]/g

/** Limpa o nome digitado; retorna '' se for inválido. Aceita aninhado ("a/b"). */
export function normalizeFolderName (raw: string): string {
  const parts = raw.replace(/\\/g, '/').replace(INVALID_CHARS, '')
    .split('/').map((p) => p.trim()).filter(Boolean)
  if (parts.some((p) => p === '.' || p === '..')) return ''
  return parts.join('/')
}

/**
 * Editor "novo arquivo" do GitHub já com `<pasta>/README.md` no nome:
 * o git não guarda pasta vazia, então a pasta nasce com um README.
 */
export function ghNewFolder (repo: string, parentPath: string, folderName: string): string {
  const name = normalizeFolderName(folderName)
  const encodedPath = name.split('/').map(encodeURIComponent).join('/')
  const title = name.split('/').pop() ?? name
  return `${ghNew(repo, parentPath)}?filename=${encodedPath}/README.md&value=${encodeURIComponent(`# ${title}\n`)}`
}
