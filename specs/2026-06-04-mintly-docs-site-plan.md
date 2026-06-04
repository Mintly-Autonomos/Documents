# Site de Documentos do Mintly — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir um site estático em Astro, no próprio repo `Documents`, que espelha a árvore de `docs/` (qualquer pasta/arquivo), renderiza Markdown e exibe PDF/imagem/Office, com busca e edição via PR nativo do GitHub, publicado no GitHub Pages.

**Architecture:** Astro 5 na raiz do repo. Conteúdo navegável em `docs/`. Um walker em Node lê `docs/` no build e gera uma árvore tipada que alimenta a rota catch-all `[...path].astro` (página de pasta OU viewer de arquivo). Markdown via content collection; binários são copiados pra `public/files/` por um script de sync. Busca full-text via Pagefind + tela de lista filtrável. Deploy via GitHub Actions.

**Tech Stack:** Astro 5, TypeScript 5, Vitest 3, Node ≥22, Pagefind, GitHub Pages/Actions.

---

## File Structure

**Criar:**
- `package.json`, `astro.config.mjs`, `tsconfig.json`, `vitest.config.ts`, `.gitignore` — scaffold
- `src/lib/file-kind.ts` — extensão → `FileKind` (puro, testado)
- `src/lib/content-tree.ts` — walker de `docs/` → árvore (testado contra fixture)
- `src/lib/github-links.ts` — gera URLs de edit/new/delete/view (puro, testado)
- `src/lib/search-index.ts` — achata a árvore numa lista p/ a busca (puro, testado)
- `scripts/sync-assets.mjs` — copia binários de `docs/` → `public/files/`
- `scripts/make-test-office.mjs` — gera `.docx/.xlsx/.pptx` placeholder
- `src/content.config.ts` — collection `docs` (glob de `**/*.md`)
- `src/styles/tokens.css`, `src/styles/global.css` — identidade visual
- `src/layouts/BaseLayout.astro`, `src/layouts/DocLayout.astro`
- `src/components/Sidebar.astro`, `src/components/Breadcrumb.astro`, `src/components/ThemeToggle.astro`
- `src/components/viewers/FolderIndex.astro`, `MarkdownView.astro`, `PdfView.astro`, `ImageView.astro`, `OfficeView.astro`, `OtherView.astro`
- `src/pages/[...path].astro` — rota catch-all
- `src/pages/buscar.astro` — tela de lista filtrável + full-text
- `.github/workflows/deploy.yml` — build + deploy Pages
- Conteúdo-semente: `docs/release-notes/RELEASE-20260602.md`, `docs/diagrams/mintly-stack.svg`, `docs/test/*`

**Fixtures de teste:**
- `src/lib/__fixtures__/docs/...` — árvore mínima p/ testar o walker

---

## Convenções

- Commits em PT, imperativo (segue o padrão do grupo).
- TDD na lógica pura (`lib/`); config/visual verificados por `astro build` + smoke manual.
- Rodar testes: `npm test` (vitest run). Build: `npm run build`. Dev: `npm run dev`.

---

### Task 1: Scaffold do projeto Astro

**Files:**
- Create: `package.json`, `astro.config.mjs`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`

- [ ] **Step 1: Criar `.gitignore`**

```gitignore
node_modules/
dist/
.astro/
public/files/
public/pagefind/
.DS_Store
```

- [ ] **Step 2: Criar `package.json`**

```json
{
  "name": "mintly-documents-site",
  "type": "module",
  "private": true,
  "scripts": {
    "sync": "node scripts/sync-assets.mjs",
    "predev": "npm run sync",
    "dev": "astro dev",
    "prebuild": "npm run sync",
    "build": "astro build && pagefind --site dist",
    "preview": "astro preview",
    "test": "vitest run"
  },
  "dependencies": {
    "astro": "^5.6.0"
  },
  "devDependencies": {
    "pagefind": "^1.1.0",
    "typescript": "^5.6.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 3: Criar `astro.config.mjs`**

```js
import { defineConfig } from 'astro/config'

export default defineConfig({
  site: 'https://mintly-autonomos.github.io',
  base: '/Documents',
})
```

- [ ] **Step 4: Criar `tsconfig.json`**

```json
{
  "extends": "astro/tsconfigs/strict",
  "include": [".astro/types.d.ts", "**/*"],
  "exclude": ["dist"]
}
```

- [ ] **Step 5: Criar `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts'],
    environment: 'node',
  },
})
```

- [ ] **Step 6: Instalar e verificar**

Run: `npm install`
Expected: instala sem erro.

- [ ] **Step 7: Criar página mínima temporária p/ o build passar**

Create `src/pages/index.astro`:
```astro
---
---
<html lang="pt-br"><body><h1>Mintly Docs — scaffold</h1></body></html>
```

Run: `npm run build`
Expected: `astro build` completa (pagefind avisa que não há conteúdo indexável ainda — tudo bem) e gera `dist/`.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold do site Astro de documentos"
```

---

### Task 2: Classificador de tipo de arquivo (TDD)

**Files:**
- Create: `src/lib/file-kind.ts`
- Test: `src/lib/file-kind.spec.ts`

- [ ] **Step 1: Escrever o teste que falha**

```ts
// src/lib/file-kind.spec.ts
import { describe, it, expect } from 'vitest'
import { fileKind } from './file-kind'

describe('fileKind', () => {
  it('classifica markdown', () => {
    expect(fileKind('readme.md')).toBe('markdown')
    expect(fileKind('a/b/NOTE.MARKDOWN')).toBe('markdown')
  })
  it('classifica pdf', () => {
    expect(fileKind('contrato.pdf')).toBe('pdf')
  })
  it('classifica imagem', () => {
    expect(fileKind('diagrama.SVG')).toBe('image')
    expect(fileKind('foto.jpeg')).toBe('image')
  })
  it('classifica office', () => {
    expect(fileKind('plan.xlsx')).toBe('office')
    expect(fileKind('deck.pptx')).toBe('office')
    expect(fileKind('doc.docx')).toBe('office')
  })
  it('cai em other para o resto', () => {
    expect(fileKind('dados.csv')).toBe('other')
    expect(fileKind('semextensao')).toBe('other')
  })
})
```

- [ ] **Step 2: Rodar p/ ver falhar**

Run: `npx vitest run src/lib/file-kind.spec.ts`
Expected: FAIL — `Cannot find module './file-kind'`

- [ ] **Step 3: Implementar**

```ts
// src/lib/file-kind.ts
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
```

- [ ] **Step 4: Rodar p/ ver passar**

Run: `npx vitest run src/lib/file-kind.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/file-kind.ts src/lib/file-kind.spec.ts
git commit -m "feat: classificador de tipo de arquivo por extensao"
```

---

### Task 3: Walker da árvore de conteúdo (TDD)

**Files:**
- Create: `src/lib/content-tree.ts`
- Test: `src/lib/content-tree.spec.ts`
- Create fixtures: `src/lib/__fixtures__/docs/intro.md`, `src/lib/__fixtures__/docs/guias/setup.md`, `src/lib/__fixtures__/docs/guias/diagrama.svg`

- [ ] **Step 1: Criar as fixtures**

`src/lib/__fixtures__/docs/intro.md`:
```md
# Intro
texto
```
`src/lib/__fixtures__/docs/guias/setup.md`:
```md
# Setup
passos
```
`src/lib/__fixtures__/docs/guias/diagrama.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg"></svg>
```

- [ ] **Step 2: Escrever o teste que falha**

```ts
// src/lib/content-tree.spec.ts
import { describe, it, expect } from 'vitest'
import { fileURLToPath } from 'node:url'
import { buildContentTree } from './content-tree'

const ROOT = fileURLToPath(new URL('./__fixtures__/docs', import.meta.url))

describe('buildContentTree', () => {
  const tree = buildContentTree(ROOT)

  it('a raiz é uma pasta com path vazio', () => {
    expect(tree.type).toBe('folder')
    expect(tree.path).toBe('')
  })

  it('lista pastas antes de arquivos, ambos ordenados por nome', () => {
    const names = tree.children.map((c) => c.name)
    expect(names).toEqual(['guias', 'intro.md'])
  })

  it('classifica o kind dos arquivos', () => {
    const guias = tree.children.find((c) => c.name === 'guias') as any
    const svg = guias.children.find((c: any) => c.name === 'diagrama.svg')
    expect(svg.type).toBe('file')
    expect(svg.kind).toBe('image')
  })

  it('paths são relativos e com barra', () => {
    const guias = tree.children.find((c) => c.name === 'guias') as any
    const setup = guias.children.find((c: any) => c.name === 'setup.md')
    expect(setup.path).toBe('guias/setup.md')
  })
})
```

- [ ] **Step 3: Rodar p/ ver falhar**

Run: `npx vitest run src/lib/content-tree.spec.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 4: Implementar**

```ts
// src/lib/content-tree.ts
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileKind, type FileKind } from './file-kind'

export interface FileNode {
  type: 'file'
  name: string
  path: string          // relativo à raiz docs/, ex: "guias/setup.md"
  kind: FileKind
}
export interface FolderNode {
  type: 'folder'
  name: string
  path: string          // "" na raiz, "guias" etc.
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
```

- [ ] **Step 5: Rodar p/ ver passar**

Run: `npx vitest run src/lib/content-tree.spec.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/content-tree.ts src/lib/content-tree.spec.ts src/lib/__fixtures__
git commit -m "feat: walker da arvore de docs com classificacao e ordenacao"
```

---

### Task 4: Geradores de links do GitHub (TDD)

**Files:**
- Create: `src/lib/github-links.ts`
- Test: `src/lib/github-links.spec.ts`

- [ ] **Step 1: Escrever o teste que falha**

```ts
// src/lib/github-links.spec.ts
import { describe, it, expect } from 'vitest'
import { ghEdit, ghNew, ghView, ghHistory } from './github-links'

const REPO = 'Mintly-Autonomos/Documents'

describe('github-links', () => {
  it('editar aponta pro editor web no caminho docs/', () => {
    expect(ghEdit(REPO, 'guias/setup.md'))
      .toBe('https://github.com/Mintly-Autonomos/Documents/edit/main/docs/guias/setup.md')
  })
  it('novo aponta pra pasta atual', () => {
    expect(ghNew(REPO, 'guias'))
      .toBe('https://github.com/Mintly-Autonomos/Documents/new/main/docs/guias')
  })
  it('novo na raiz aponta pra docs/', () => {
    expect(ghNew(REPO, ''))
      .toBe('https://github.com/Mintly-Autonomos/Documents/new/main/docs')
  })
  it('ver e historico apontam pro blob/commits', () => {
    expect(ghView(REPO, 'a.md')).toBe('https://github.com/Mintly-Autonomos/Documents/blob/main/docs/a.md')
    expect(ghHistory(REPO, 'a.md')).toBe('https://github.com/Mintly-Autonomos/Documents/commits/main/docs/a.md')
  })
})
```

- [ ] **Step 2: Rodar p/ ver falhar**

Run: `npx vitest run src/lib/github-links.spec.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar**

```ts
// src/lib/github-links.ts
const BASE = 'https://github.com'
const CONTENT_DIR = 'docs'

const trim = (p: string) => (p ? `/${p}` : '')

export function ghEdit (repo: string, filePath: string): string {
  return `${BASE}/${repo}/edit/main/${CONTENT_DIR}/${filePath}`
}
export function ghNew (repo: string, folderPath: string): string {
  return `${BASE}/${repo}/new/main/${CONTENT_DIR}${trim(folderPath)}`
}
export function ghView (repo: string, filePath: string): string {
  return `${BASE}/${repo}/blob/main/${CONTENT_DIR}/${filePath}`
}
export function ghHistory (repo: string, filePath: string): string {
  return `${BASE}/${repo}/commits/main/${CONTENT_DIR}/${filePath}`
}
```

- [ ] **Step 4: Rodar p/ ver passar**

Run: `npx vitest run src/lib/github-links.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/github-links.ts src/lib/github-links.spec.ts
git commit -m "feat: geradores de links de edit/new/view do GitHub"
```

---

### Task 5: Lista achatada p/ busca (TDD)

**Files:**
- Create: `src/lib/search-index.ts`
- Test: `src/lib/search-index.spec.ts`

- [ ] **Step 1: Escrever o teste que falha**

```ts
// src/lib/search-index.spec.ts
import { describe, it, expect } from 'vitest'
import { flattenFiles } from './search-index'
import type { FolderNode } from './content-tree'

const tree: FolderNode = {
  type: 'folder', name: '', path: '', children: [
    { type: 'folder', name: 'guias', path: 'guias', children: [
      { type: 'file', name: 'setup.md', path: 'guias/setup.md', kind: 'markdown' },
    ] },
    { type: 'file', name: 'intro.md', path: 'intro.md', kind: 'markdown' },
  ],
}

describe('flattenFiles', () => {
  it('retorna todos os arquivos (sem pastas), com name/path/kind', () => {
    expect(flattenFiles(tree)).toEqual([
      { name: 'setup.md', path: 'guias/setup.md', kind: 'markdown' },
      { name: 'intro.md', path: 'intro.md', kind: 'markdown' },
    ])
  })
})
```

- [ ] **Step 2: Rodar p/ ver falhar**

Run: `npx vitest run src/lib/search-index.spec.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar**

```ts
// src/lib/search-index.ts
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
```

- [ ] **Step 4: Rodar p/ ver passar**

Run: `npx vitest run src/lib/search-index.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/search-index.ts src/lib/search-index.spec.ts
git commit -m "feat: achatar arvore em lista de arquivos para busca"
```

---

### Task 6: Identidade visual (tokens + global + BaseLayout)

**Files:**
- Create: `src/styles/tokens.css`, `src/styles/global.css`
- Create: `src/components/ThemeToggle.astro`
- Create: `src/layouts/BaseLayout.astro`

- [ ] **Step 1: Portar os tokens do swift-funds-pro**

Create `src/styles/tokens.css` copiando os blocos `:root` e `.dark` de `swift-funds-pro/src/styles.css` (paleta Mintly, oklch). Mínimo necessário:
```css
:root {
  --radius: 0.875rem;
  --background: oklch(0.985 0.005 220);
  --foreground: oklch(0.27 0.03 260);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.27 0.03 260);
  --primary: oklch(0.78 0.2 148);
  --primary-foreground: oklch(0.22 0.04 160);
  --muted: oklch(0.965 0.006 220);
  --muted-foreground: oklch(0.5 0.02 250);
  --accent: oklch(0.95 0.04 165);
  --border: oklch(0.92 0.008 230);
  --ocean: oklch(0.46 0.07 220);
  --font-sans: 'Inter', ui-sans-serif, system-ui, sans-serif;
}
.dark {
  --background: oklch(0.21 0.02 250);
  --foreground: oklch(0.95 0.01 220);
  --card: oklch(0.25 0.02 250);
  --card-foreground: oklch(0.95 0.01 220);
  --muted: oklch(0.28 0.02 250);
  --muted-foreground: oklch(0.7 0.02 240);
  --border: oklch(0.32 0.02 250);
}
```
(Conferir/copiar os valores `.dark` reais do arquivo fonte ao implementar.)

- [ ] **Step 2: Criar `src/styles/global.css`**

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
@import './tokens.css';

* { box-sizing: border-box; }
html { color-scheme: light dark; }
body {
  margin: 0;
  font-family: var(--font-sans);
  background: var(--background);
  color: var(--foreground);
}
a { color: var(--ocean); text-decoration: none; }
a:hover { text-decoration: underline; }
.btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 12px; border-radius: var(--radius);
  background: var(--primary); color: var(--primary-foreground);
  font-size: 14px; font-weight: 600; border: none; cursor: pointer;
}
.btn--ghost { background: var(--muted); color: var(--foreground); border: 1px solid var(--border); }
.card {
  border: 1px solid var(--border); border-radius: var(--radius);
  background: var(--card); padding: 14px 16px;
}
```

- [ ] **Step 3: Criar `src/components/ThemeToggle.astro`**

```astro
<button id="theme-toggle" class="btn btn--ghost" aria-label="Alternar tema">🌗</button>
<script>
  const KEY = 'mintly-theme'
  const root = document.documentElement
  const saved = localStorage.getItem(KEY)
  if (saved === 'dark') root.classList.add('dark')
  document.getElementById('theme-toggle')?.addEventListener('click', () => {
    root.classList.toggle('dark')
    localStorage.setItem(KEY, root.classList.contains('dark') ? 'dark' : 'light')
  })
</script>
```

- [ ] **Step 4: Criar `src/layouts/BaseLayout.astro`**

```astro
---
import '../styles/global.css'
import ThemeToggle from '../components/ThemeToggle.astro'
interface Props { title: string }
const { title } = Astro.props
const base = import.meta.env.BASE_URL
---
<!doctype html>
<html lang="pt-br">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title}</title>
  </head>
  <body>
    <header style="display:flex;align-items:center;justify-content:space-between;padding:12px 20px;border-bottom:1px solid var(--border);position:sticky;top:0;background:var(--background);z-index:10;">
      <a href={base} style="font-weight:800;font-size:18px;color:var(--foreground);">📗 Mintly · Documentos</a>
      <div style="display:flex;gap:10px;align-items:center;">
        <a class="btn btn--ghost" href={`${base}/buscar`}>🔎 Buscar</a>
        <ThemeToggle />
      </div>
    </header>
    <slot />
  </body>
</html>
```

- [ ] **Step 5: Verificar build**

Run: `npm run build`
Expected: build passa.

- [ ] **Step 6: Commit**

```bash
git add src/styles src/components/ThemeToggle.astro src/layouts/BaseLayout.astro
git commit -m "feat: identidade visual Mintly (tokens, global, base layout, tema)"
```

---

### Task 7: Sidebar e Breadcrumb

**Files:**
- Create: `src/components/Sidebar.astro`, `src/components/Breadcrumb.astro`
- Create: `src/lib/icons.ts`

- [ ] **Step 1: Criar `src/lib/icons.ts`**

```ts
import type { FileKind } from './file-kind'
export const folderIcon = '📁'
export function fileIcon (kind: FileKind): string {
  return { markdown: '📄', pdf: '📕', image: '🖼️', office: '📊', other: '📎' }[kind]
}
```

- [ ] **Step 2: Criar `src/components/Breadcrumb.astro`**

```astro
---
import type { TreeNode } from '../lib/content-tree'
interface Props { path: string }
const { path } = Astro.props
const base = import.meta.env.BASE_URL
const parts = path ? path.split('/') : []
let acc = ''
const crumbs = parts.map((p) => { acc = acc ? `${acc}/${p}` : p; return { label: p, href: `${base}/${acc}` } })
---
<nav style="font-size:13px;color:var(--muted-foreground);margin-bottom:16px;">
  <a href={base}>Início</a>
  {crumbs.map((c) => (<span> / <a href={c.href}>{c.label}</a></span>))}
</nav>
```

- [ ] **Step 3: Criar `src/components/Sidebar.astro`**

```astro
---
import type { FolderNode, TreeNode } from '../lib/content-tree'
import { folderIcon, fileIcon } from '../lib/icons'
interface Props { tree: FolderNode, current: string }
const { tree, current } = Astro.props
const base = import.meta.env.BASE_URL
function render (node: TreeNode): string {
  if (node.type === 'file') {
    const active = node.path === current ? 'font-weight:700;color:var(--primary);' : ''
    return `<li><a style="${active}" href="${base}/${node.path}">${fileIcon(node.kind)} ${node.name}</a></li>`
  }
  const inner = node.children.map(render).join('')
  if (node.path === '') return inner
  return `<li><details open><summary>${folderIcon} ${node.name}</summary><ul>${inner}</ul></details></li>`
}
const html = render(tree)
---
<aside style="width:260px;flex-shrink:0;border-right:1px solid var(--border);padding:18px;overflow:auto;">
  <ul style="list-style:none;padding:0;margin:0;line-height:1.9;" set:html={html} />
</aside>
<style>
  aside :global(ul) { list-style:none; padding-left:14px; margin:0; }
  aside :global(summary) { cursor:pointer; }
</style>
```

- [ ] **Step 4: Verificar build**

Run: `npm run build`
Expected: build passa (componentes ainda não usados, mas compilam).

- [ ] **Step 5: Commit**

```bash
git add src/components/Sidebar.astro src/components/Breadcrumb.astro src/lib/icons.ts
git commit -m "feat: sidebar com arvore navegavel e breadcrumb"
```

---

### Task 8: Collection de Markdown + DocLayout + viewer de Markdown

**Files:**
- Create: `src/content.config.ts`
- Create: `src/layouts/DocLayout.astro`
- Create: `src/components/viewers/MarkdownView.astro`

- [ ] **Step 1: Criar `src/content.config.ts`**

```ts
import { defineCollection } from 'astro:content'
import { glob } from 'astro/loaders'

const docs = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './docs' }),
})

export const collections = { docs }
```

- [ ] **Step 2: Criar `src/layouts/DocLayout.astro`** (shell sidebar + conteúdo)

```astro
---
import BaseLayout from './BaseLayout.astro'
import Sidebar from '../components/Sidebar.astro'
import Breadcrumb from '../components/Breadcrumb.astro'
import type { FolderNode } from '../lib/content-tree'
interface Props { title: string, tree: FolderNode, current: string }
const { title, tree, current } = Astro.props
---
<BaseLayout title={title}>
  <div style="display:flex;align-items:flex-start;max-width:1200px;margin:0 auto;">
    <Sidebar tree={tree} current={current} />
    <main style="flex:1;min-width:0;padding:24px 28px 56px;">
      <Breadcrumb path={current} />
      <slot />
    </main>
  </div>
</BaseLayout>
```

- [ ] **Step 3: Criar `src/components/viewers/MarkdownView.astro`**

```astro
---
import type { CollectionEntry } from 'astro:content'
import { render } from 'astro:content'
interface Props { entry: CollectionEntry<'docs'> }
const { entry } = Astro.props
const { Content } = await render(entry)
---
<article class="prose">
  <Content />
</article>
<style>
  .prose { line-height: 1.7; }
  .prose :global(h1) { margin-top: 0; }
  .prose :global(pre) { background: var(--muted); padding: 14px; border-radius: var(--radius); overflow:auto; }
  .prose :global(code) { background: var(--muted); padding: 1px 5px; border-radius: 6px; }
  .prose :global(img) { max-width: 100%; border-radius: var(--radius); }
  .prose :global(table) { border-collapse: collapse; }
  .prose :global(td), .prose :global(th) { border: 1px solid var(--border); padding: 6px 10px; }
</style>
```

- [ ] **Step 4: Verificar build**

Run: `npm run build`
Expected: build passa (a collection fica vazia até existir `docs/`; ok).

- [ ] **Step 5: Commit**

```bash
git add src/content.config.ts src/layouts/DocLayout.astro src/components/viewers/MarkdownView.astro
git commit -m "feat: collection de markdown, doc layout e viewer de markdown"
```

---

### Task 9: Viewers de PDF/Imagem/Office/Other + barra de ações

**Files:**
- Create: `src/components/viewers/PdfView.astro`, `ImageView.astro`, `OfficeView.astro`, `OtherView.astro`
- Create: `src/components/FileActions.astro`

- [ ] **Step 1: Criar `src/components/FileActions.astro`** (botões de PR)

```astro
---
import { ghEdit, ghNew, ghView, ghHistory } from '../lib/github-links'
interface Props { repo: string, filePath: string, folderPath: string }
const { repo, filePath, folderPath } = Astro.props
---
<div style="display:flex;gap:8px;flex-wrap:wrap;margin:8px 0 20px;">
  <a class="btn" href={ghEdit(repo, filePath)} target="_blank" rel="noopener">✏️ Editar</a>
  <a class="btn btn--ghost" href={ghNew(repo, folderPath)} target="_blank" rel="noopener">➕ Novo</a>
  <a class="btn btn--ghost" href={ghView(repo, filePath)} target="_blank" rel="noopener">🔗 Ver no GitHub</a>
  <a class="btn btn--ghost" href={ghHistory(repo, filePath)} target="_blank" rel="noopener">🕘 Histórico</a>
</div>
```

- [ ] **Step 2: Criar `src/components/viewers/ImageView.astro`**

```astro
---
interface Props { src: string, name: string }
const { src, name } = Astro.props
---
<figure style="text-align:center;">
  <img src={src} alt={name} style="max-width:100%;border:1px solid var(--border);border-radius:var(--radius);" />
  <figcaption style="color:var(--muted-foreground);font-size:13px;margin-top:8px;">{name}</figcaption>
</figure>
```

- [ ] **Step 3: Criar `src/components/viewers/PdfView.astro`**

```astro
---
interface Props { src: string, name: string }
const { src, name } = Astro.props
---
<div>
  <iframe src={src} title={name} style="width:100%;height:80vh;border:1px solid var(--border);border-radius:var(--radius);"></iframe>
  <p><a class="btn btn--ghost" href={src} download>⬇️ Baixar {name}</a></p>
</div>
```

- [ ] **Step 4: Criar `src/components/viewers/OfficeView.astro`**

```astro
---
interface Props { absoluteSrc: string, src: string, name: string }
const { absoluteSrc, src, name } = Astro.props
const viewer = `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(absoluteSrc)}`
---
<div class="card">
  <p style="font-weight:600;">📊 {name}</p>
  <p style="color:var(--muted-foreground);font-size:14px;">Documento Office. Abra no visualizador online ou baixe.</p>
  <div style="display:flex;gap:8px;">
    <a class="btn" href={viewer} target="_blank" rel="noopener">👁️ Abrir no visualizador</a>
    <a class="btn btn--ghost" href={src} download>⬇️ Baixar</a>
  </div>
</div>
```

- [ ] **Step 5: Criar `src/components/viewers/OtherView.astro`**

```astro
---
interface Props { src: string, name: string }
const { src, name } = Astro.props
---
<div class="card">
  <p style="font-weight:600;">📎 {name}</p>
  <a class="btn" href={src} download>⬇️ Baixar arquivo</a>
</div>
```

- [ ] **Step 6: Verificar build**

Run: `npm run build`
Expected: build passa.

- [ ] **Step 7: Commit**

```bash
git add src/components/FileActions.astro src/components/viewers
git commit -m "feat: viewers de pdf/imagem/office/other e barra de acoes de PR"
```

---

### Task 10: Script de sync de binários

**Files:**
- Create: `scripts/sync-assets.mjs`

- [ ] **Step 1: Implementar o script**

```js
// scripts/sync-assets.mjs
// Copia todos os arquivos NÃO-markdown de docs/ para public/files/, espelhando a estrutura.
import { cpSync, rmSync, mkdirSync, readdirSync, statSync } from 'node:fs'
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
```

- [ ] **Step 2: Rodar (mesmo sem docs/ ainda)**

Run: `node scripts/sync-assets.mjs`
Expected: imprime a mensagem; cria `public/files/` vazio (sem erro mesmo sem `docs/`).

- [ ] **Step 3: Commit**

```bash
git add scripts/sync-assets.mjs
git commit -m "feat: script de sync de binarios docs -> public/files"
```

---

### Task 11: Rota catch-all (pasta + arquivo)

**Files:**
- Create: `src/pages/[...path].astro`
- Delete: `src/pages/index.astro` (substituído pela catch-all na raiz)

- [ ] **Step 1: Implementar a rota**

```astro
---
import { getCollection } from 'astro:content'
import { fileURLToPath } from 'node:url'
import { buildContentTree, type FileNode, type FolderNode, type TreeNode } from '../lib/content-tree'
import DocLayout from '../layouts/DocLayout.astro'
import FolderIndex from '../components/viewers/FolderIndex.astro'
import MarkdownView from '../components/viewers/MarkdownView.astro'
import PdfView from '../components/viewers/PdfView.astro'
import ImageView from '../components/viewers/ImageView.astro'
import OfficeView from '../components/viewers/OfficeView.astro'
import OtherView from '../components/viewers/OtherView.astro'
import FileActions from '../components/FileActions.astro'

const REPO = 'Mintly-Autonomos/Documents'
const DOCS_DIR = fileURLToPath(new URL('../../docs', import.meta.url))

export async function getStaticPaths () {
  const root = buildContentTree(DOCS_DIR)
  const mdEntries = await getCollection('docs')
  // O id da glob loader pode vir slugificado/minúsculo; casamos por path normalizado.
  const mdById = new Map(mdEntries.map((e) => [e.id.toLowerCase(), e]))

  const paths: any[] = []
  const walk = (node: TreeNode) => {
    if (node.type === 'folder') {
      paths.push({ params: { path: node.path || undefined }, props: { node, tree: root } })
      node.children.forEach(walk)
    } else {
      const idGuess = node.path.replace(/\.(md|markdown)$/i, '').toLowerCase()
      paths.push({ params: { path: node.path }, props: { node, tree: root, entry: mdById.get(idGuess) ?? null } })
    }
  }
  walk(root)
  return paths
}

const { node, tree, entry } = Astro.props as { node: TreeNode, tree: FolderNode, entry?: any }
const base = import.meta.env.BASE_URL
const site = Astro.site?.toString().replace(/\/$/, '') ?? ''
const current = node.path
const title = (node.name || 'Documentos') + ' — Mintly Docs'

const file = node.type === 'file' ? (node as FileNode) : null
const folderOfFile = file ? file.path.split('/').slice(0, -1).join('/') : ''
const fileUrl = file ? `${base}/files/${file.path}` : ''
const fileAbsUrl = file ? `${site}${base}/files/${file.path}` : ''
---
<DocLayout title={title} tree={tree} current={current}>
  {node.type === 'folder' && <FolderIndex node={node as FolderNode} repo={REPO} />}
  {file && (
    <>
      <h1 style="margin-top:0;">{file.name}</h1>
      <FileActions repo={REPO} filePath={file.path} folderPath={folderOfFile} />
      {file.kind === 'markdown' && entry && <MarkdownView entry={entry} />}
      {file.kind === 'markdown' && !entry && <p>Não foi possível carregar este Markdown.</p>}
      {file.kind === 'pdf' && <PdfView src={fileUrl} name={file.name} />}
      {file.kind === 'image' && <ImageView src={fileUrl} name={file.name} />}
      {file.kind === 'office' && <OfficeView absoluteSrc={fileAbsUrl} src={fileUrl} name={file.name} />}
      {file.kind === 'other' && <OtherView src={fileUrl} name={file.name} />}
    </>
  )}
</DocLayout>
```

- [ ] **Step 2: Criar `src/components/viewers/FolderIndex.astro`**

```astro
---
import type { FolderNode } from '../../lib/content-tree'
import { ghNew } from '../../lib/github-links'
import { folderIcon, fileIcon } from '../../lib/icons'
interface Props { node: FolderNode, repo: string }
const { node, repo } = Astro.props
const base = import.meta.env.BASE_URL
---
<div style="display:flex;justify-content:space-between;align-items:center;">
  <h1 style="margin:0;">{node.name || 'Documentos'}</h1>
  <a class="btn" href={ghNew(repo, node.path)} target="_blank" rel="noopener">➕ Novo documento</a>
</div>
<p style="color:var(--muted-foreground);">{node.children.length} item(ns)</p>
<div style="display:grid;gap:10px;margin-top:8px;">
  {node.children.map((c) => (
    <a class="card" href={`${base}/${c.path}`} style="display:flex;align-items:center;gap:10px;color:var(--foreground);">
      <span style="font-size:20px;">{c.type === 'folder' ? folderIcon : fileIcon(c.kind)}</span>
      <span>{c.name}{c.type === 'folder' ? '/' : ''}</span>
    </a>
  ))}
  {node.children.length === 0 && <p style="color:var(--muted-foreground);">Pasta vazia.</p>}
</div>
```

- [ ] **Step 3: Remover a index temporária**

Run: `git rm src/pages/index.astro`
Expected: removido (a catch-all cobre a raiz com `path: undefined`).

- [ ] **Step 4: Verificar build**

Run: `npm run build`
Expected: build passa. Sem `docs/` a árvore é vazia → só a página raiz (pasta vazia). Sem erro.

- [ ] **Step 5: Commit**

```bash
git add src/pages/'[...path].astro' src/components/viewers/FolderIndex.astro
git commit -m "feat: rota catch-all com indice de pasta e viewers por tipo"
```

---

### Task 12: Conteúdo-semente p/ teste

**Files:**
- Create: `docs/release-notes/RELEASE-20260602.md` (movido da raiz `Mintly`)
- Create: `docs/diagrams/mintly-stack.svg`
- Create: `scripts/make-test-office.mjs` + `docs/test/exemplo.docx|.xlsx|.pptx`

- [ ] **Step 1: Colocar o release note**

Copiar o conteúdo de `C:\Users\alexa\code\Mintly\RELEASE-20260602.md` para `docs/release-notes/RELEASE-20260602.md`.

- [ ] **Step 2: Criar o SVG da stack** em `docs/diagrams/mintly-stack.svg`

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="760" height="420" font-family="Inter, sans-serif">
  <rect width="760" height="420" fill="#F8FAFC"/>
  <text x="380" y="40" text-anchor="middle" font-size="22" font-weight="700" fill="#0F5D75">Stack do Mintly</text>
  <g>
    <rect x="60"  y="90"  width="180" height="64" rx="14" fill="#DFF8EB" stroke="#1ED760"/>
    <text x="150" y="128" text-anchor="middle" font-size="16" fill="#1F2937">MintlyWeb (web)</text>
    <rect x="290" y="90"  width="180" height="64" rx="14" fill="#DFF8EB" stroke="#1ED760"/>
    <text x="380" y="128" text-anchor="middle" font-size="16" fill="#1F2937">MintlyApi (api)</text>
    <rect x="520" y="90"  width="180" height="64" rx="14" fill="#E8F3F8" stroke="#0F5D75"/>
    <text x="610" y="128" text-anchor="middle" font-size="16" fill="#1F2937">MongoDB</text>
    <rect x="290" y="220" width="180" height="64" rx="14" fill="#fff" stroke="#94a3b8"/>
    <text x="380" y="258" text-anchor="middle" font-size="16" fill="#1F2937">MintlyLib (lib)</text>
    <rect x="520" y="220" width="180" height="64" rx="14" fill="#fff" stroke="#94a3b8"/>
    <text x="610" y="258" text-anchor="middle" font-size="16" fill="#1F2937">Workers (ingestão)</text>
  </g>
  <g stroke="#64748b" stroke-width="2" fill="none" marker-end="url(#a)">
    <defs><marker id="a" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L8,3 L0,6Z" fill="#64748b"/></marker></defs>
    <path d="M240,122 L290,122"/>
    <path d="M470,122 L520,122"/>
    <path d="M380,220 L380,154"/>
    <path d="M610,220 L610,154"/>
  </g>
</svg>
```

- [ ] **Step 3: Criar `scripts/make-test-office.mjs`** (gera OOXML mínimo válido)

```js
// scripts/make-test-office.mjs
// Gera arquivos Office mínimos válidos (OOXML é um zip). Usa só a stdlib + zlib via "jszip" se disponível;
// fallback: grava arquivos .txt renomeados NÃO serve. Então usamos a lib oficial de cada formato.
import { writeFileSync, mkdirSync } from 'node:fs'
import { execSync } from 'node:child_process'

mkdirSync('docs/test', { recursive: true })

// Instala libs de geração sob demanda (devDependency de conveniência do script).
try { execSync('npm ls docx', { stdio: 'ignore' }) } catch {
  execSync('npm i -D docx exceljs pptxgenjs', { stdio: 'inherit' })
}

const { Document, Packer, Paragraph, TextRun } = await import('docx')
const ExcelJS = (await import('exceljs')).default
const PptxGenJS = (await import('pptxgenjs')).default

// .docx
const doc = new Document({ sections: [{ children: [new Paragraph({ children: [new TextRun('Documento de teste — Mintly Docs')] })] }] })
writeFileSync('docs/test/exemplo.docx', await Packer.toBuffer(doc))

// .xlsx
const wb = new ExcelJS.Workbook()
const ws = wb.addWorksheet('Teste')
ws.addRow(['Coluna A', 'Coluna B'])
ws.addRow(['valor 1', 42])
writeFileSync('docs/test/exemplo.xlsx', Buffer.from(await wb.xlsx.writeBuffer()))

// .pptx
const pptx = new PptxGenJS()
pptx.addSlide().addText('Slide de teste — Mintly Docs', { x: 1, y: 1, fontSize: 24 })
await pptx.writeFile({ fileName: 'docs/test/exemplo.pptx' })

console.log('[make-test-office] gerados docx/xlsx/pptx em docs/test/')
```

- [ ] **Step 4: Gerar os arquivos Office**

Run: `node scripts/make-test-office.mjs`
Expected: cria `docs/test/exemplo.docx`, `.xlsx`, `.pptx`.

- [ ] **Step 5: Build + smoke local**

Run: `npm run build && npm run preview`
Abrir `http://localhost:4321/Documents/` e conferir:
- raiz lista `release-notes/`, `diagrams/`, `test/`
- `release-notes/RELEASE-20260602.md` renderiza o Markdown
- `diagrams/mintly-stack.svg` aparece como imagem
- `test/exemplo.docx` mostra o card Office com "Abrir no visualizador" e "Baixar"
Expected: tudo navegável.

- [ ] **Step 6: Commit**

```bash
git add docs scripts/make-test-office.mjs package.json package-lock.json
git commit -m "feat: conteudo-semente (release-notes, diagrama da stack, office de teste)"
```

---

### Task 13: Tela de busca (lista filtrável + full-text Pagefind)

**Files:**
- Create: `src/pages/buscar.astro`

- [ ] **Step 1: Implementar a página de busca**

```astro
---
import { fileURLToPath } from 'node:url'
import BaseLayout from '../layouts/BaseLayout.astro'
import { buildContentTree } from '../lib/content-tree'
import { flattenFiles } from '../lib/search-index'
import { fileIcon } from '../lib/icons'
const DOCS_DIR = fileURLToPath(new URL('../../docs', import.meta.url))
const files = flattenFiles(buildContentTree(DOCS_DIR))
const base = import.meta.env.BASE_URL
---
<BaseLayout title="Buscar — Mintly Docs">
  <main style="max-width:840px;margin:0 auto;padding:24px;">
    <h1>Buscar</h1>

    <h2 style="font-size:16px;color:var(--muted-foreground);">Busca no conteúdo (full-text)</h2>
    <div id="pagefind"></div>

    <h2 style="font-size:16px;color:var(--muted-foreground);margin-top:28px;">Todos os arquivos</h2>
    <input id="filtro" placeholder="Filtrar por nome ou caminho…" style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:var(--radius);background:var(--card);color:var(--foreground);" />
    <ul id="lista" style="list-style:none;padding:0;margin:12px 0;line-height:2;">
      {files.map((f) => (
        <li data-path={f.path.toLowerCase()}>
          <a href={`${base}/${f.path}`}>{fileIcon(f.kind as any)} {f.path}</a>
        </li>
      ))}
    </ul>
  </main>

  <link href={`${base}/pagefind/pagefind-ui.css`} rel="stylesheet" />
  <script is:inline src={`${base}/pagefind/pagefind-ui.js`}></script>
  <script is:inline define:vars={{ base }}>
    window.addEventListener('DOMContentLoaded', () => {
      if (window.PagefindUI) new window.PagefindUI({ element: '#pagefind', showSubResults: true })
      const input = document.getElementById('filtro')
      const items = [...document.querySelectorAll('#lista li')]
      input?.addEventListener('input', () => {
        const q = input.value.toLowerCase()
        items.forEach((li) => { li.style.display = li.dataset.path.includes(q) ? '' : 'none' })
      })
    })
  </script>
</BaseLayout>
```

- [ ] **Step 2: Garantir que o Markdown é indexável pelo Pagefind**

No `MarkdownView.astro`, envolver o conteúdo com `data-pagefind-body` (Pagefind indexa só o que está marcado quando há a tag). Editar a `<article>`:
```astro
<article class="prose" data-pagefind-body>
```

- [ ] **Step 3: Build (gera o índice Pagefind)**

Run: `npm run build`
Expected: `astro build` + `pagefind --site dist` rodam; cria `dist/pagefind/`.

- [ ] **Step 4: Smoke**

Run: `npm run preview`
Abrir `http://localhost:4321/Documents/buscar`:
- digitar no filtro reduz a lista de arquivos
- a busca full-text encontra texto dentro do RELEASE
Expected: ambas funcionam.

- [ ] **Step 5: Commit**

```bash
git add src/pages/buscar.astro src/components/viewers/MarkdownView.astro
git commit -m "feat: tela de busca com lista filtravel e full-text via pagefind"
```

---

### Task 14: Deploy no GitHub Pages via Actions

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Criar o workflow**

```yaml
name: Deploy site
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Gerar lockfile p/ `npm ci`**

Run: `npm install`
Expected: `package-lock.json` atualizado/criado.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/deploy.yml package-lock.json
git commit -m "ci: deploy do site no github pages via actions"
```

- [ ] **Step 4: (Manual) Habilitar Pages no repo**

No GitHub: Settings → Pages → Source = **GitHub Actions**. Necessário uma vez.

---

### Task 15: Verificação final, PR e merge

- [ ] **Step 1: Rodar a suíte e o build limpos**

Run: `npm test && npm run build`
Expected: todos os testes passam; build gera `dist/` com `pagefind/`.

- [ ] **Step 2: Push da branch e abrir PR**

```bash
git push -u origin feat/20260604/site-de-documentos
```
Abrir PR `feat/20260604/site-de-documentos → main` no `Mintly-Autonomos/Documents`, descrevendo o site, viewers, busca e edição via PR.

- [ ] **Step 3: Após merge, validar o deploy**

Conferir a Action verde e o site em `https://mintly-autonomos.github.io/Documents/`.
Expected: navegação, viewers e busca funcionando em produção.

- [ ] **Step 4: Limpeza**

Remover o `RELEASE-20260602.md` da raiz da pasta `Mintly` (agora vive em `docs/release-notes/`), se desejado.

---

## Notas de implementação

- **`getStaticPaths` + binários:** as páginas de arquivo referenciam `/Documents/files/<path>` (gerado pelo `sync-assets`). O Office Web Viewer precisa da URL **absoluta** (`Astro.site` + base), por isso `fileAbsUrl`.
- **Pagefind** roda como passo pós-build (`pagefind --site dist`) e indexa o que estiver marcado com `data-pagefind-body`. Em dev (`astro dev`) a busca full-text não existe — testar via `build` + `preview`.
- **Office no viewer da Microsoft** exige que o arquivo esteja publicamente acessível por URL — ok, o site é público.
- Se o pessoal de negócio não tiver acesso de escrita, o botão "Editar" do GitHub cria um **fork + PR** automaticamente; com acesso, vira commit direto/branch.
