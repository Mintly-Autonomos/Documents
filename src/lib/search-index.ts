import type { FolderNode, TreeNode } from './content-tree'

export interface SearchEntry { name: string, path: string, kind: string }

export function flattenFiles (node: FolderNode): SearchEntry[] {
  const out: SearchEntry[] = []
  const walk = (n: TreeNode) => {
    if (n.type === 'file') out.push({ name: n.name, path: n.path, kind: n.kind })
    else n.children.forEach(walk)
  }
  node.children.forEach(walk)
  return out
}
