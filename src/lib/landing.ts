import type { FolderNode, TreeNode } from './content-tree'

export interface Section {
  name: string
  path: string
  count: number
  description: string
}

function countFiles (node: TreeNode): number {
  if (node.type === 'file') return 1
  return node.children.reduce((acc, c) => acc + countFiles(c), 0)
}

/** Seções da landing: pastas top-level de docs/, com contagem recursiva e descrição curada. */
export function topLevelSections (tree: FolderNode, descriptions: Record<string, string> = {}): Section[] {
  return tree.children
    .filter((c): c is FolderNode => c.type === 'folder')
    .map((f) => ({
      name: f.name,
      path: f.path,
      count: countFiles(f),
      description: descriptions[f.name] ?? `Documentos da pasta ${f.name}.`,
    }))
}
