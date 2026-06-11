# Redesign Editorial + Landing + OG + Responsivo — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans para implementar tarefa a tarefa. Steps usam checkboxes (`- [ ]`).

**Goal:** Substituir a estética genérica atual (Inter + tokens shadcn) por uma identidade **editorial de imprensa** — serif de display, papel quente, filetes hairline, verde Mintly como tinta de destaque — e entregar junto os itens 1 (landing), 2 (OG/favicon) e 5 (responsivo/a11y) do roadmap.

**Architecture:** O design vive em `tokens.css` (variáveis) + `global.css` (sistema: tipografia, prose, componentes utilitários). Componentes Astro trocam estilos inline por classes do sistema. A landing é uma rota estática `index.astro` (tem precedência sobre `[...path].astro` na raiz). OG/favicon entram no `BaseLayout`. O drawer mobile é um estado CSS + script mínimo no `Sidebar`.

**Tech Stack:** Astro 5 (estático, GitHub Pages), CSS puro com oklch, Google Fonts (Fraunces + Hanken Grotesk + Spline Sans Mono), satori + @resvg/resvg-js (devDeps, só para gerar `og.png` uma vez), vitest para libs.

---

## Direção visual — "Editorial de imprensa"

| Elemento | Decisão |
|---|---|
| Display (títulos, wordmark) | **Fraunces** (variable; opsz/wght), itálico para ênfases |
| Texto/UI | **Hanken Grotesk** (humanista, quente — substitui Inter) |
| Mono (código, metadados) | **Spline Sans Mono** |
| Papel (light) | fundo `oklch(0.977 0.006 90)` quente; tinta `oklch(0.26 0.02 60)` |
| Carvão (dark) | fundo `oklch(0.205 0.012 80)` **quente** (não azulado); papel-claro como tinta |
| Verde Mintly | mantido: tinta de links/marcas `oklch(0.5 0.11 155)` (light) / `oklch(0.8 0.14 150)` (dark); mint vivo `oklch(0.78 0.2 148)` só em realces (seleção, marcador ativo, hero) |
| Estrutura | hairlines (0.5–1px) por toda parte; **double rule** (3px + 1px) sob o header; radius 2px; sem sombras de card; sem emojis |
| Detalhes | leaders pontilhados em índices (estilo sumário de livro), numeração editorial `01 02 03` nas seções, versalete (uppercase + tracking) em labels, números old-style em metadados |
| Motion | entrada da landing com stagger fade-up (CSS only); hover de links com sublinhado deslizante; `prefers-reduced-motion` respeitado |

## File Structure

- **Modify** `src/styles/tokens.css` — paleta papel/carvão, fontes, radius
- **Modify** `src/styles/global.css` — sistema completo (reset, tipografia, prose, btn/tag/rule, drawer, foco, motion)
- **Modify** `src/layouts/BaseLayout.astro` — header editorial (wordmark Fraunces, double rule, botão Índice mobile), skip-link, metas OG/twitter/favicon, prop `description`/`ogType`
- **Modify** `src/layouts/DocLayout.astro` — grid com classes (sem inline), passa botão drawer
- **Modify** `src/components/Sidebar.astro` — tipografia pura sem caixa, seções numeradas, sem emoji, drawer mobile (fixed + translateX, backdrop, Esc/clique-fora, `aria-expanded`)
- **Modify** `src/components/Breadcrumb.astro`, `FileActions.astro`, `ThemeToggle.astro`, `CommandPalette.astro` — skin editorial, sem emojis
- **Modify** `src/components/viewers/MarkdownView.astro` — TOC sem caixa (filete), prose editorial (medida 70ch, blockquote com filete verde, tabelas só com linhas horizontais, th versalete)
- **Modify** `src/components/viewers/FolderIndex.astro` — índice com leaders pontilhados, label de tipo em mono à direita
- **Modify** `src/pages/buscar.astro` — skin nova
- **Modify** `src/lib/icons.ts` → `kindLabel(kind)` tipográfico (`md`, `pdf`, `img`, `xls`, `arq`) no lugar de emojis
- **Create** `src/lib/landing.ts` + `src/lib/landing.spec.ts` — deriva seções da árvore (`topLevelSections`: nome, path, contagem recursiva, descrição curada com fallback)
- **Create** `src/pages/index.astro` — landing: masthead/hero, busca, seções numeradas, "comece por aqui"
- **Create** `public/favicon.svg` — pilcrow (¶) tinta sobre mint
- **Create** `scripts/make-og.mjs` + `public/og.png` — satori+resvg (executado uma vez, png commitado)
- **Modify** `src/pages/[...path].astro` — passa `description` por página

## Tasks

### Task 1: Spec + branch
- [x] Branch `feat/20260611/redesign-editorial`; commitar esta spec.

### Task 2: Design system (tokens + global)
- [ ] Reescrever `tokens.css` e `global.css` conforme a tabela acima.
- [ ] `npm run build` passa (estilos não quebram nada).

### Task 3: Casca (BaseLayout/DocLayout/Sidebar/Breadcrumb/ThemeToggle)
- [ ] Header editorial + skip-link + landmarks; sidebar nova com drawer; breadcrumb versalete.
- [ ] Validar a11y básico: foco visível, `aria-expanded` no botão, Esc fecha.

### Task 4: Conteúdo (MarkdownView/FolderIndex/FileActions/viewers/buscar/CommandPalette)
- [ ] Aplicar skin nas views; remover emojis via `kindLabel`.

### Task 5: Landing
- [ ] `landing.spec.ts` primeiro (contagem recursiva, fallback de descrição) → RED → implementar `landing.ts` → GREEN.
- [ ] `index.astro` com hero, seções numeradas, comece-por-aqui, stagger.

### Task 6: OG + favicon
- [ ] `favicon.svg`; `make-og.mjs` (satori) gera `public/og.png`; metas no BaseLayout; `description` em todas as rotas.

### Task 7: Verificação + PR
- [ ] `npm test` (vitest) e `npm run build` verdes; conferir HTML servido (dev) nas rotas: `/`, pasta, md, pdf, buscar.
- [ ] Commits por task; PR para `main`.

## Self-Review
- [x] Itens 1/2/5 do roadmap têm task (5, 6, 3) ✔️; redesign cobre todas as superfícies listadas no File Structure ✔️
- [x] Sem placeholders: decisões visuais estão na tabela; código de lib novo tem teste ✔️
- [x] `kindLabel` substitui `fileIcon`/`folderIcon` — todos os call sites (Sidebar, FolderIndex, buscar) listados em Modify ✔️
