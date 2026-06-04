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
