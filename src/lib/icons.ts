import type { FileKind } from './file-kind'
export const folderIcon = '📁'
export function fileIcon (kind: FileKind): string {
  return { markdown: '📄', pdf: '📕', image: '🖼️', office: '📊', other: '📎' }[kind]
}
