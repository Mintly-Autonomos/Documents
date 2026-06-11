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

- [ ] Conferir que o trabalho do ciclo está em `staging` (a versão do `package.json` já vem bumpada das features; a release **não** bumpa versão).
- [ ] Validar: `npm run typecheck` · `npm run lint` · `npm run build`.
- [ ] `git checkout staging && git pull` → `git checkout -b release/AAAAMMDD`.
- [ ] Adicionar a entrada da versão no `CHANGELOG.md` (formato [Keep a Changelog](https://keepachangelog.com/pt-BR/), em PT-BR, com referências aos PRs `(#n)` e link da tag no rodapé).
- [ ] Commit (`docs: adicionar CHANGELOG da release X.Y.Z`) e push.
- [ ] PR `release/AAAAMMDD` → `main` com resumo do que entra, validação e passos pós-merge.
- [ ] Draft release no GitHub: `gh release create vX.Y.Z --draft --target main --title "vX.Y.Z — <resumo>"`.
- [ ] **Pós-merge:** publicar o draft (cria a tag `vX.Y.Z`) e promover o npm:
      `npm dist-tag add mintly-lib@X.Y.Z latest`
      ⚠️ Durante o desenvolvimento a lib é publicada com dist-tag `next` — conferir `npm view mintly-lib dist-tags`; o `latest` já chegou a ficar duas versões para trás.

### 2. MintlyApi

- [ ] Conferir que os PRs de feature do ciclo estão mergeados em `staging`.
- [ ] Validar: `npm run test:cov` (cobertura ≥90%) · `npm run typecheck` · `npm run lint`.
      Recomendado: `node scripts/manual-route-check.mjs` (verificação das rotas contra o servidor real; dropa o banco de teste sozinho).
- [ ] `git checkout staging && git pull` → `git checkout -b release/AAAAMMDD`.
- [ ] Commits exclusivos da release (docs, collections etc.) entram direto na branch.
- [ ] PR `release/AAAAMMDD` → `main` listando features (com nº das histórias do Jira), validação, dependência da versão da lib, envs novas e observações conhecidas.
- [ ] Draft release: `gh release create release-AAAAMMDD --draft --target main --title "release-AAAAMMDD — <resumo>"`.
- [ ] A **versão do `package.json` permanece `1.0.0`** (serviço deploável, não pacote publicado) — o marco do ciclo é a tag `release-AAAAMMDD`.
- [ ] **Pós-merge:** publicar o draft; configurar envs novas em produção, se houver.

### 3. Release notes para a PO (este repositório)

- [ ] Criar `docs/release-notes/RELEASE-AAAAMMDD.md` seguindo o formato dos anteriores
      (seções: Resumo executivo · Por que importa (tabela antes/depois) · O que foi entregue por componente ·
      Riscos e impacto + validação realizada · Caminho da entrega (diagrama com nº dos PRs) · Próximos passos).
- [ ] Commitar via branch `docs/AAAAMMDD/{slug}` cortada de `main` → PR para `main`.

---

## Pós-release (ordem)

1. Merge dos PRs (lib → API → Documents) com CI verde.
2. Publicar os drafts de release no GitHub (lib `vX.Y.Z`, API `release-AAAAMMDD`).
3. `npm dist-tag add mintly-lib@X.Y.Z latest`.
4. Configurar envs novas em produção.
5. Mover os cards do ciclo no Jira (subtarefas → Concluído; histórias → Homologação).

## Armadilhas conhecidas

- **Drafts esquecidos:** sempre conferir `gh release list` — drafts de ciclos anteriores podem estar despublicados.
- **npm `latest` desatualizado:** o fluxo publica em `next` durante o dev; sem o passo de promoção, consumidores novos pegam versão antiga.
- **Workflow do Jira é encadeado:** não há transição direta para Concluído/Homologação — os cards passam por "Em Desenvolvimento" antes.

---

## Histórico

| Ciclo | Lib | API | Notes |
|-------|-----|-----|-------|
| 20260602 | v1.1.0 (aurora → Sapphire) — PR #5 | base técnica — PR #10 | `release-notes/RELEASE-20260602.md` |
| 20260610 | v1.2.0 (contratos cadastro/auth + clients) — PR #8 | MIN-58 + MIN-59 — PR #13 | `release-notes/RELEASE-20260610.md` |
