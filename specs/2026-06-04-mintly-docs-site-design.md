# Design — Site de documentos do Mintly (GitHub Pages)

**Data:** 04/06/2026
**Repositório alvo:** [`Mintly-Autonomos/Documents`](https://github.com/Mintly-Autonomos/Documents) (público)
**Autor:** Alexandre Damas Murata
**Status:** Design aprovado — aguardando plano de implementação

---

## 1. Objetivo

Publicar, via **GitHub Pages**, um site que **espelha a árvore de pastas e arquivos** do repositório `Documents`, deixando a navegação visual e fácil para o pessoal de negócio do grupo. Documentos Markdown são renderizados como páginas estilizadas; PDFs, imagens e arquivos Office têm visualização/baixa adequada. O site segue a **identidade visual do produto** (extraída do `swift-funds-pro`). A criação/edição/exclusão de documentos acontece via **fluxo de PR nativo do GitHub** (sem backend).

### Não-objetivos (v1)
- CMS in-site (edição WYSIWYG dentro do próprio site) — fase 2.
- Internacionalização — só **PT** agora.
- Controle de acesso ao site (conteúdo é público).

---

## 2. Decisões já tomadas (do brainstorming)

| Tema | Decisão |
|---|---|
| Abordagem | **Site estático em Astro** (mesma stack da `sapphire`), morando dentro do próprio repo `Documents` |
| Edição | **PR nativo do GitHub** (botões que abrem o editor web do GitHub) — zero backend |
| Privacidade | **Site público** OK (repo já é público; sem necessidade de plano Pro) |
| Tipos de arquivo | Todos: MD, PDF, imagens, Office, e outros (download) |
| Busca | **Full-text** + **tela de lista de arquivos com filtro** — ambas na v1, depois do core |
| Idioma | PT apenas |

---

## 3. Arquitetura geral

O site é um **projeto Astro na raiz do repo `Documents`**. O conteúdo navegável vive em **`docs/`**. A cada push na `main`, uma GitHub Action builda o site e publica no Pages.

```
push na main  →  GitHub Action (astro build)  →  deploy GitHub Pages
   ↑                                                      ↓
pessoa edita/cria doc                    https://mintly-autonomos.github.io/Documents/
(editor/PR do GitHub)
```

- **Um único repo**, sem servidor/backend.
- Conteúdo publicado aparece ~1–2 min após o merge (tempo do CI).
- `base` do Astro = `/Documents` (project pages).

### Layout do repositório (alvo)
```
Documents/
├─ docs/                     # CONTEÚDO navegável (o que o pessoal de negócio edita)
│  ├─ release-notes/
│  ├─ diagrams/
│  └─ test/
├─ src/                      # código do site Astro
│  ├─ pages/[...path].astro  # rota catch-all (pasta | arquivo)
│  ├─ layouts/
│  ├─ components/
│  ├─ lib/                   # walk da árvore, classificação de tipos, busca
│  └─ styles/tokens.css      # tokens do swift-funds-pro
├─ specs/                    # docs internos (NÃO entram no site)
├─ astro.config.mjs
├─ package.json
└─ .github/workflows/deploy.yml
```
`docs/` é a única raiz varrida; `specs/` e o código do site ficam fora da navegação.

---

## 4. Modelo de conteúdo e roteamento

1. Um módulo `src/lib/content-tree.ts` **varre `docs/`** em tempo de build e produz uma árvore tipada: cada nó é uma **pasta** (com filhos) ou um **arquivo** (com `kind` derivado da extensão).
2. A rota **catch-all `src/pages/[...path].astro`** usa `getStaticPaths` pra emitir uma página por nó:
   - **Pasta** → página de índice: breadcrumb + lista de filhos (pastas primeiro, depois arquivos), com ícone por tipo. A raiz `/` é a pasta `docs/`.
   - **Arquivo** → página de visualização que seleciona o viewer pelo `kind` (seção 5).
3. **Sidebar** com a árvore completa navegável (colapsável), presente em todas as páginas.
4. Markdown é renderizado com a pipeline do Astro (remark/rehype); imagens e links relativos dentro do MD são reescritos pra apontar pros caminhos corretos do site (padrão do `remark-rewrite-links` da sapphire).

### Classificação de tipos (`kind`)
| `kind` | Extensões |
|---|---|
| `markdown` | `.md`, `.markdown` |
| `pdf` | `.pdf` |
| `image` | `.png`, `.jpg`, `.jpeg`, `.gif`, `.svg`, `.webp` |
| `office` | `.docx`, `.xlsx`, `.pptx`, `.doc`, `.xls`, `.ppt` |
| `other` | qualquer outra |

---

## 5. Tratamento por tipo de arquivo

| `kind` | Visualização |
|---|---|
| `markdown` | Renderizado como página HTML estilizada (tema Mintly) |
| `pdf` | Embutido inline (`<iframe>`/pdf.js) + botão **Baixar** |
| `image` | Exibida inline, centralizada, com legenda = nome do arquivo |
| `office` | Botão **Baixar** + **Abrir no visualizador** (Office Web Viewer: `view.officeapps.live.com/op/view.aspx?src=<raw-url>` — funciona porque o site é público) |
| `other` | Card com ícone + **Baixar** |

Arquivos binários são copiados pro output do build (recebem URL pública estável), usada tanto no viewer quanto nos links de download e no Office Web Viewer.

---

## 6. Busca

Duas funcionalidades, ambas v1 (entregues **depois** do core de navegação):

1. **Tela de lista de arquivos com filtro** (`/buscar` ou similar): lista achatada de todos os arquivos com campo de filtro por nome/caminho — navegação rápida pro pessoal de negócio.
2. **Busca full-text**: índice client-side (ex.: Pagefind ou Fuse.js sobre um índice gerado no build) cobrindo o **texto dos Markdown** e os nomes de todos os arquivos. Pagefind é o candidato principal por integrar bem com Astro e gerar índice estático no build.

Decisão de biblioteca de busca fica para o plano de implementação (Pagefind vs Fuse.js), avaliada no momento da implementação da etapa de busca.

---

## 7. Edição via PR nativo (sem backend)

Cada página expõe ações que deep-linkam pro GitHub:

| Ação | Destino |
|---|---|
| ✏️ **Editar** | `github.com/Mintly-Autonomos/Documents/edit/main/docs/<arquivo>` |
| ➕ **Novo documento** | `github.com/Mintly-Autonomos/Documents/new/main/docs/<pasta-atual>` |
| 🗑️ **Excluir** | link pro arquivo no GitHub (botão de delete nativo) |
| 🔗 **Ver no GitHub / histórico** | `blob`/`commits` do arquivo |

O editor web do GitHub gera **commit direto** (quem tem write) ou **PR automático** (quem não tem). **Pré-requisito:** editores precisam de conta GitHub com acesso ao repo/org — não há edição anônima de repo versionado.

---

## 8. Identidade visual

Os tokens do `swift-funds-pro/src/styles.css` (paleta Mintly — verde mint `#1ED760`, ocean blue `#0F5D75`, fonte **Inter**, formato `oklch`, light/dark, `--radius: 0.875rem`) são portados pra `src/styles/tokens.css`. Estrutura visual:
- **Header**: logo/nome Mintly + toggle de tema (dark/light) + acesso à busca.
- **Sidebar**: árvore de pastas navegável e colapsável.
- **Breadcrumb**: caminho atual no topo da área de conteúdo.
- **Conteúdo**: tipografia caprichada pro Markdown; cards pra listagem de pasta.
- **Dark mode** suportado (tokens `.dark` já existem no swift-funds-pro).

---

## 9. Deploy

- GitHub Action oficial do Astro (`withastro/action`) + `actions/deploy-pages`.
- Trigger: push na `main`.
- Pages configurado como **GitHub Actions** (não branch `gh-pages`).
- `astro.config.mjs`: `site: 'https://mintly-autonomos.github.io'`, `base: '/Documents'`.

---

## 10. Testes

Vitest (como na sapphire), focado na lógica determinística:
- `content-tree`: varre uma fixture de pastas, classifica `kind` corretamente, ordena (pastas antes de arquivos), gera os paths e breadcrumbs esperados.
- Classificador de extensão → `kind`.
- Construção dos links de edição/PR a partir de um caminho.
- (Se Pagefind/índice próprio) geração do índice de busca a partir da árvore.

Componentes visuais Astro não terão teste unitário pesado; a verificação é via build (`astro build` passando) + smoke manual.

---

## 11. Conteúdo-semente para teste (entregue junto da v1)

Pra validar todos os viewers desde o começo:
- **`docs/release-notes/`** → mover o `RELEASE-20260602.md` (hoje na raiz da pasta `Mintly`) pra cá. Testa o viewer de **Markdown**.
- **`docs/diagrams/`** → gerar uma imagem (SVG) com a **stack do Mintly**: `MintlyWeb` (web) → `MintlyApi` (api) → `MongoDB`, com `MintlyLib` (lib compartilhada) e `Workers` (ingestão) ao redor. Testa o viewer de **imagem**.
- **`docs/test/`** → gerar arquivos de teste **`.docx`, `.xlsx`, `.pptx`** (conteúdo placeholder) pra validar os viewers/baixa de **Office**.

---

## 12. Premissas e questões em aberto

- **Premissa:** o pessoal de negócio terá contas GitHub com acesso ao repo/org (necessário pra editar/abrir PR).
- **Premissa:** delay de ~1–2 min após o merge é aceitável (build do CI).
- **Aberto (decidido no plano):** biblioteca de busca (Pagefind vs Fuse.js).
- **Aberto (decidido no plano):** ferramenta pra gerar os arquivos Office de teste (script Node/Python).

---

## 13. Fora de escopo (fase 2)

- CMS in-site (Sveltia/Decap) com edição WYSIWYG e editorial workflow.
- Internacionalização (PT/EN).
- Controle de acesso ao conteúdo publicado (exigiria Enterprise Cloud).
