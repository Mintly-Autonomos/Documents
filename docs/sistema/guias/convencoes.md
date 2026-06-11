# 📐 Convenções do projeto

Padrões que valem para **todos os repositórios** da org Mintly-Autonomos (`MintlyLib`, `MintlyApi`, `MintlyWeb`, `Documents`). Quando um repo precisar divergir, a exceção deve estar documentada no próprio repo.

---

## Git e fluxo de trabalho

**Branches** — `{semantic}/{identificador}/{kebab-slug}`:

| Tipo | Padrão | Exemplo |
|---|---|---|
| Trabalho de história do Jira | `feat/MIN-XX/slug` | `feat/MIN-59/autenticacao` |
| Trabalho avulso (refactor, teste, docs) | `{semantic}/AAAAMMDD/slug` | `refactor/20260531/melhorias-base-api` |
| Release | `release/AAAAMMDD` | `release/20260610` |

Semantics: `feat · fix · refactor · test · docs · chore`. O slug descreve **o que foi feito**, não qual arquivo mudou.

**Commits** — [Conventional Commits](https://www.conventionalcommits.org/pt-br/) com mensagem **em português**. Scope opcional = módulo afetado (`core`, `auth`, `person`, `server`…).

```
feat(auth): contexto multi-tenant populado a partir do JWT (MIN-59)
```

**Fluxo de promoção** — feature → PR → `staging` → (ciclo de release) → `main`. Produção é `main`; nada entra em `main` sem passar por `staging`, exceto o próprio PR de release. No repositório Documents, PRs vão direto para `main`.

**Specs-first** — trabalho não-trivial começa com uma spec escrita antes do código:
- **Histórias do Jira**: a spec vai como **comentário na história**; as tasks viram **subtarefas** (cada subtarefa = uma branch). Poucas subtarefas coesas; teste anda junto da feature (sem subtarefa de teste isolada, exceto E2E).
- **Trabalho de repositório**: spec em `specs/` do próprio repo, com Goal, Arquitetura, File Structure e Tasks com checkboxes.

---

## Nomenclatura

- **Código em inglês** (nomes de negócio do Jira em PT são traduzidos: `restaurante_id` → `restaurantId`).
- **Campos**: `camelCase` (`restaurantId`, `passwordHash`, `feePercent`, `isDefault`).
- **Collections do Mongo**: `snake_case` **plural** (`users`, `people`, `restaurants`, `financial_accounts`, `audit_logs`, `password_reset_tokens`).
- **Schemas** (variáveis TS): `camelCase` com sufixo `Schema` (`personSchema`, `financialAccountSchema`).
- **Arquivos**: `kebab-case` (`auth-use-case.ts`, `password-reset-repository.ts`).
- **Rotas HTTP**: inglês, kebab-case (`/auth/forgot-password`, `/auth/reset-password`).

---

## MongoDB

- **Modelagem idiomática de documento** (não relacional disfarçado): embutir o que se lê junto, referenciar o que cresce sem limite. Arrays ilimitados (ex.: histórico de login) viram **collection separada** (`audit_logs`), não array no documento.
- **Operações que tocam múltiplos documentos rodam em transação** (`startTransaction`) — ex.: signup cria usuário + restaurante + dados iniciais atomicamente.
- **Índices criados pelo código** (idempotentes, no caminho de escrita): único em `users.email`; **TTL** em `password_reset_tokens.expiresAt`.
- **Datas**: ISO string (`new Date().toISOString()`) nos campos de auditoria/negócio. Exceção: campos que precisam de **TTL index exigem BSON `Date`** (o TTL não funciona com string).
- **Multi-ambiente**: o header `env` roteia o **banco** (`getDatabase(env)`) — usado por testes/E2E. Identidade (usuário/tenant) **nunca** vem de header, só do JWT.
- **Validação**: schemas Sapphire na MintlyLib são a fonte de verdade; a adoção de `$jsonSchema` no banco é evolução prevista.

---

## Segurança (padrões já estabelecidos)

- **Hash de senha**: `scrypt` no formato `salt:hash` (hex). *(O refinamento antigo citava argon2id; a decisão vigente é scrypt.)*
- **Tokens de uso único** (reset de senha): no banco fica só o **sha256** do token; consumo **atômico** via `findOneAndUpdate` (valida + queima numa operação).
- **Anti-enumeração**: respostas de auth não revelam se um e-mail existe — 401 genérico para credencial inválida; status da conta só é revelado a quem provou a senha; recuperação responde 202 sempre.
- **Lockout**: bloqueio temporário após N tentativas inválidas (default 5×/15min, configurável por env).
- **Auditoria**: eventos de acesso em `audit_logs` com `userId` + `restaurantId`.

---

## Testes

Pirâmide com **vitest** em todos os repos TS:

| Camada | O quê | Onde roda |
|---|---|---|
| Unit | use-cases/libs com dependências mockadas (`*.spec.ts`) | CI |
| Integration | rotas reais contra `mongodb-memory-server` (`*.int.spec.ts`) | CI |
| E2E | fluxo completo contra Atlas (`tests/e2e/`) | **só local** |

- Cobertura mínima na API: **90%** (threshold no vitest).
- **TDD**: teste falhando antes da implementação, inclusive em bugfix.
- O repositório Documents (site Astro) testa as libs puras de `src/lib/`.

---

## Arquitetura da API — "Layered Simplified"

`route → controller → use-case → repository`, com:

- **`CrudUseCase` genérico** servindo entidades CRUD-triviais até lógica de negócio aparecer — aí nasce um use-case dedicado (`RegisterUseCase`, `PasswordRecoveryUseCase`…).
- **`RequestContext` threaded explicitamente** (sem AsyncLocalStorage): `{ env, userId?, restaurantId? }`. Em rotas protegidas, `buildRequestContext(request)` extrai a identidade do JWT validado; `requireTenant(ctx)` falha fechado (401) se a rota não passou pelo hook.
- **Validação** com Sapphire dentro do use-case (`schema.parse(input)`), erros viram `400 VALIDATION_ERROR` no error handler global.
- Detalhes em [`sistema/api/mintly-api.md`](../api/mintly-api.md).

---

## Versionamento

- **MintlyLib**: SemVer, publicada no npm; `next` durante o desenvolvimento, `latest` promovido na release; CHANGELOG no formato Keep a Changelog.
- **MintlyApi**: serviço deploável — versão fixa `1.0.0`; marcos por tag `release-AAAAMMDD`.
- Processo completo em [`processo-de-release.md`](./processo-de-release.md).
