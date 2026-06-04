export type FileKind = 'markdown' | 'pdf' | 'image' | 'office' | 'other'

const MAP: Record<string, FileKind> = {
  md: 'markdown', markdown: 'markdown',
  pdf: 'pdf',
  png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', svg: 'image', webp: 'image',
  doc: 'office', docx: 'office', xls: 'office', xlsx: 'office', ppt: 'office', pptx: 'office',
}

export function fileKind (name: string): FileKind {
  const ext = name.includes('.') ? name.split('.').pop()!.toLowerCase() : ''
  return MAP[ext] ?? 'other'
}
