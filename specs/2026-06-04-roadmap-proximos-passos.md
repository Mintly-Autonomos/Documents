# Roadmap — Próximos passos do Site de Documentos

**Data:** 04/06/2026
**Status:** 🧭 Roadmap (apenas referência — NÃO executar agora)
**Autor:** Alexandre Damas Murata

> Este documento registra melhorias candidatas para o site de documentos, para
> termos noção dos próximos passos. Nada aqui está agendado para execução. Quando
> alguma for escolhida, ela ganha seu próprio ciclo de design → plano → implementação.

---

## Contexto (estado atual)

O site (`Mintly-Autonomos/Documents`, Astro estático → GitHub Pages) já entrega:
navegação da árvore de `docs/`, viewers de MD/PDF/Office/imagem, busca full-text
(Pagefind, incluindo dentro de PDF/docx/xlsx) + Cmd/Ctrl+K, edição via PR nativo,
"atualizado em X por Fulano" (git no build), Mermaid, sumário + tempo de leitura,
checagem de links no CI, comentários Giscus, dark mode e identidade visual do produto.

As melhorias abaixo são **extras de polimento/escala**, não correções de buracos.
Todas as itens 1–5 são possíveis **sem infra nova** (continuam estáticas no Pages).

---

## 1. Landing page curada na raiz

**Objetivo:** substituir a listagem crua de pastas na raiz por uma página inicial
acolhedora (intro do projeto, atalhos pras seções principais, "comece por aqui",
bloco de recentes), melhorando muito a primeira impressão pra público de negócio
e pra apresentação na banca.

**Abordagem:** criar um `src/pages/index.astro` dedicado. No Astro, uma rota
estática (`index.astro`) tem precedência sobre a rota dinâmica `[...path].astro`
para a raiz — então o catch-all continua cuidando de pastas/arquivos, e só a home
passa a ser curada. Conteúdo: hero (nome + descrição do projeto), cards pras
seções top-level (manuais ou derivados das pastas de `docs/`), atalho de busca, e
opcionalmente o bloco "recentes" (item 3).

**Esforço:** baixo–médio. **Infra:** nenhuma.

---

## 2. Open Graph + favicon (links bonitos ao compartilhar)

**Objetivo:** quando um link do site for colado no WhatsApp/Slack/Teams, exibir um
**card** com título, descrição e imagem da marca; e dar um favicon ao site.

**Abordagem:** no `BaseLayout.astro`, adicionar `<meta property="og:*">`
(title, description, image, url, type) + `<meta name="twitter:card">`. Título e
descrição por página (passar via props: páginas de doc usam o nome do arquivo /
primeira linha; a landing usa uma descrição fixa). Imagem OG: começar com uma
imagem estática única em `public/og.png` com a identidade Mintly (gerar uma OG por
documento é possível, mas é v2). Favicon: `public/favicon.svg` + `<link rel="icon">`.

**Esforço:** baixo. **Infra:** nenhuma.

---

## 3. Página "Recentes" (changelog automático)

**Objetivo:** uma página listando os documentos **alterados recentemente**, pra
mostrar que a doc está viva e ajudar a equipe a acompanhar o que mudou.

**Abordagem:** novo `src/pages/recentes.astro`. Reaproveita o `git-meta.ts` já
existente: no build, obter a data do último commit de cada arquivo, ordenar
desc e exibir os N mais recentes (data, autor, link). Já depende de `fetch-depth: 0`
no checkout do CI (configurado). **Atenção de performance:** rodar `git log` uma
vez por arquivo pode ficar lento com muitos docs — preferir **uma única** chamada
`git log --name-only --format=...` e parsear o resultado, em vez de N chamadas.

**Esforço:** médio. **Infra:** nenhuma.

---

## 4. Metadados via frontmatter (tags/status) + índice filtrável

**Objetivo:** deixar cada documento declarar `título`, `tags`, `dono` e `status`
(ex.: rascunho/aprovado) no topo (frontmatter), exibir como selinhos, e ter um
índice filtrável por tag/status. Transforma a "árvore de arquivos" numa **base de
conhecimento** de verdade — vale quando o volume de docs crescer.

**Abordagem:** estender a content collection `docs` com um schema (Zod) de campos
**opcionais** (`title`, `tags: string[]`, `owner`, `status`). Mostrar os selinhos no
topo das páginas Markdown. Criar uma página de catálogo que lê os frontmatters e
filtra client-side. Observação: só Markdown tem frontmatter — PDF/Office/imagem
ficam sem metadados (ou recebem metadados por convenção de pasta, se necessário).

**Esforço:** médio. **Infra:** nenhuma.

---

## 5. Passada de responsivo (mobile) + acessibilidade

**Objetivo:** garantir ótima experiência no **celular** (público de negócio vive no
mobile) e acessibilidade decente.

**Abordagem:** auditar e ajustar:
- **Sidebar** hoje é fixa em 260px — no mobile deveria virar um *drawer*
  colapsável, aberto por um botão "menu" no header.
- Breakpoints gerais, tabelas largas (Office/MD) com scroll horizontal.
- Acessibilidade: contraste dos tokens, foco visível, navegação por teclado,
  `alt` em imagens, landmarks/roles, `lang` (já tem `pt-br`).
- Rodar **Lighthouse** (mobile + a11y) como baseline e mirar nas pendências.

**Esforço:** médio. **Infra:** nenhuma.

---

## 6. (Lembrete) Preview de PR — bom, mas exige infra

**Objetivo:** cada Pull Request gerar uma URL com o site **renderizado** daquela
mudança, pra revisar visualmente antes de mergear.

**Por que está adiado:** o GitHub Pages **não** faz deploy de preview por PR.
Para ter isso seria preciso um provedor que suporta preview deployments
(ex.: **Cloudflare Pages** ou **Netlify**) — ou seja, **infra/serviço externo a
mais**. Não é uma má ideia: o valor de revisar renderizado é alto; o único custo é
abrir mão do "tudo no GitHub Pages, zero infra". Fica registrado como candidato
caso o grupo aceite migrar/duplicar a hospedagem nesses provedores.

**Esforço:** médio. **Infra:** ⚠️ sim (provedor externo de hospedagem).

---

## Ordem sugerida (quando for executar)

1. **2 (OG + favicon)** — mais barato e de alto polimento imediato.
2. **1 (landing)** — maior salto de percepção; combina bem com o item 2.
3. **3 (recentes)** — aproveita metadados de git já existentes.
4. **5 (responsivo/a11y)** — garante qualidade no mobile antes de divulgar amplo.
5. **4 (tags/status)** — vale mais quando o volume de docs aumentar.
6. **6 (preview de PR)** — só se/quando o grupo topar a infra extra.

---

## Não-objetivos / premissas

- Manter tudo **estático no GitHub Pages, sem backend**, exceto se o item 6 for
  adotado conscientemente.
- Continuar **só em PT** (i18n não está no radar).
- Cada item vira seu próprio ciclo de design → plano → implementação quando for a hora.
