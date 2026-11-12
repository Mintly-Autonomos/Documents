# 🚀 Processo de Release

Processo padrão para releases coordenadas de `mintly-lib` + `MintlyApi` (+ release notes neste repositório).
Estabelecido nos ciclos **20260602** e **20260610**.

> Identificador do ciclo: a data no formato `AAAAMMDD`.

---

## Visão geral do fluxo

```
feature branches ─► PRs ─► staging ─► release/AAAAMMDD ─► PR ─► main ─► tag/release GitHub
                                                                          + npm dist-tag (lib)
                                                                          + release notes (Documents)
```

- A branch de release chama-se **`release/AAAAMMDD`** e é cortada de **`origin/staging`** (mesmo nome nos dois repos).
- O PR da release é a **promoção de staging para produção (`main`)**.
- Releases no GitHub são criadas como **draft antes do merge** (`--target main`) e **publicadas depois** — é a publicação que cria a tag.

---

## Checklist por componente

### 1. MintlyLib

- [ ] Conferir que o trabalho do ciclo está em `staging`. A versão do `package.json` já vem bumpada pelo CI (sufixo `-preview`); a release **não** bumpa versão à mão — no merge em `main` o CI remove o `-preview`.
- [ ] Validar: `npm run typecheck` · `npm run lint` · `npm run build`.
- [ ] `git checkout staging && git pull` → `git checkout -b release/AAAAMMDD`.
- [ ] Adicionar a entrada da versão no `CHANGELOG.md` (formato [Keep a Changelog](https://keepachangelog.com/pt-BR/), em PT-BR, com referências aos PRs `(#n)` e link da tag no rodapé).
- [ ] Commit (`docs: adicionar CHANGELOG da release X.Y.Z`) e push.
- [ ] PR `release/AAAAMMDD` → `main` com resumo do que entra, validação e passos pós-merge.
- [ ] Draft release no GitHub: `gh release create vX.Y.Z --draft --target main --title "vX.Y.Z — <resumo>"`.
- [ ] **Pós-merge:** o `ci.yml` publica a versão sem sufixo com dist-tag `latest`. Publicar o draft da release no GitHub e conferir `npm view mintly-lib dist-tags`.
      Se o publish automático falhar, rodar o `deploy.yml` manualmente com `dist_tag=latest` (ou `npm dist-tag add mintly-lib@X.Y.Z latest`).
      ⚠️ Durante o desenvolvimento a lib é publicada com dist-tag `preview` (não mais `next`, que ficou parada em 1.2.0). Hoje o `latest` está em 1.0.0.

### 2. MintlyApi

- [ ] Conferir que os PRs de feature do ciclo estão mergeados em `staging`.
- [ ] Validar: `npm run test:cov` (cobertura ≥90%) · `npm run typecheck` · `npm run lint` · `npm run validate:swagger`.
      Recomendado: `node scripts/manual-route-check.mjs` (verificação das rotas contra o servidor real; dropa o banco de teste sozinho). ⚠️ Esse script e o `insomnia-mintly-api.json` só existem na `main` (vieram da release 20260610); na `staging` a collection está em `insomnia/MintlyApi.insomnia_v4.json` e o script não foi atualizado para as rotas novas.
- [ ] `git checkout staging && git pull` → `git checkout -b release/AAAAMMDD`.
- [ ] Commits exclusivos da release (docs, collections etc.) entram direto na branch.
- [ ] PR `release/AAAAMMDD` → `main` listando features (com nº das histórias do Jira), validação, dependência da versão da lib, envs novas e observações conhecidas.
- [ ] Draft release: `gh release create release-AAAAMMDD --draft --target main --title "release-AAAAMMDD — <resumo>"`.
- [ ] A **versão do `package.json` permanece `1.0.0`** (serviço deploável, não pacote publicado) — o marco do ciclo é a tag `release-AAAAMMDD`.
- [ ] **Pós-merge:** publicar o draft; configurar envs novas em produção, se houver; rodar o `deploy.yml` com `environment=production` (que também roda `db:indices`).

### 3. Release notes para a PO (este repositório)

- [ ] Criar `docs/release-notes/RELEASE-AAAAMMDD.md` seguindo o formato dos anteriores
      (seções: Resumo executivo · Por que importa (tabela antes/depois) · O que foi entregue por componente ·
      Riscos e impacto + validação realizada · Caminho da entrega (diagrama com nº dos PRs) · Próximos passos).
- [ ] Commitar via branch `docs/AAAAMMDD/{slug}` cortada de `main` → PR para `main`.

---

## Pós-release (ordem)

1. Merge dos PRs (lib → API → Documents) com CI verde.
2. Publicar os drafts de release no GitHub (lib `vX.Y.Z`, API `release-AAAAMMDD`).
3. Conferir `npm view mintly-lib dist-tags` (o `latest` deve ser a versão da release).
4. Configurar envs novas em produção e fazer o deploy da API e da Web.
5. Mover os cards do ciclo no Jira (subtarefas → Concluído; histórias → Homologação).

## Armadilhas conhecidas

- **Drafts esquecidos:** sempre conferir `gh release list` — drafts de ciclos anteriores podem estar despublicados.
- **npm `latest` desatualizado:** durante o dev só sai `preview`; sem release, quem instala `mintly-lib` sem tag pega a versão antiga (hoje 1.0.0). API e Web fixam a versão exata, então não são afetadas.
- **Workflow do Jira é encadeado:** não há transição direta para Concluído/Homologação — os cards passam por "Em Desenvolvimento" antes.

---

## Histórico

| Ciclo | Lib | API | Notes |
|-------|-----|-----|-------|
| 20260602 | v1.1.0 (aurora → Sapphire) — PR #5 | base técnica — PR #10 | `release-notes/RELEASE-20260602.md` |
| 20260610 | v1.2.0 (contratos cadastro/auth + clients) — PR #8 | MIN-58 + MIN-59 — PR #13 | `release-notes/RELEASE-20260610.md` |

Desde 20260610 não houve novo ciclo de release: `main` da lib segue em 1.2.0 e as features de julho a novembro (módulos de relatório, cardápio, assinatura, IA…) estão só em `staging` (lib `2.27.0-preview`).
