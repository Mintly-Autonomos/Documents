import type { FileKind } from './file-kind'

/** Selo tipográfico do tipo de arquivo (sem emoji — identidade editorial). */
export function kindLabel (kind: FileKind): string {
  return { markdown: 'md', pdf: 'pdf', image: 'img', office: 'xls', other: 'arq' }[kind]
}
