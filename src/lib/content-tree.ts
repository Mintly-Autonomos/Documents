import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileKind, type FileKind } from './file-kind'

export interface FileNode {
  type: 'file'
  name: string
  path: string
  kind: FileKind
}
export interface FolderNode {
  type: 'folder'
  name: string
  path: string
  children: TreeNode[]
}
export type TreeNode = FileNode | FolderNode

export function buildContentTree (rootDir: string, relPath = ''): FolderNode {
  const absDir = relPath ? join(rootDir, relPath) : rootDir
  const entries = readdirSync(absDir, { withFileTypes: true })
    .filter((e) => !e.name.startsWith('.'))

  const folders: FolderNode[] = []
  const files: FileNode[] = []

  for (const e of entries) {
    const childRel = relPath ? `${relPath}/${e.name}` : e.name
    if (e.isDirectory()) {
      folders.push(buildContentTree(rootDir, childRel))
    } else {
      files.push({ type: 'file', name: e.name, path: childRel, kind: fileKind(e.name) })
    }
  }

  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name)
  folders.sort(byName)
  files.sort(byName)

  const name = relPath ? relPath.split('/').pop()! : ''
  return { type: 'folder', name, path: relPath, children: [...folders, ...files] }
}
