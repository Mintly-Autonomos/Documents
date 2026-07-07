# ⚙️ MintlyApi — visão geral & referência de rotas

**Repo:** `Mintly-Autonomos/MintlyApi` · **Stack:** Node 20+ · Fastify · MongoDB (Atlas) · [`mintly-lib`](../libs/mintly-lib.md) · `valkyrie-jwt` · Sapphire (validação) · vitest.

Swagger vivo em `/documentation` (só **fora de produção**).

> **Documentação profunda:** [Arquitetura](./arquitetura.md) · [Mapa de domínio](./mapa-de-dominio.md) · [Multi-tenant](./multi-tenant.md) · [Modelo de dinheiro](./dinheiro.md) · [Auth & sessão](./auth.md) · [CRUD genérico](./crud-generico.md) · [Coleções & índices](./colecoes.md) · [Erros & validação](./erros.md).

---

## Em uma tela

- **Layered Simplified**: `route → controller → use-case → repository → MongoDB`, com `RequestContext { env, userId?, restaurantId? }` atravessando tudo.
- **Multi-tenant híbrido**: `env` (header, validado na allowlist) escolhe o **banco**; `restaurantId` (do JWT) escopa os **documentos**.
- **Sessão**: JWT criptografado (valkyrie-jwt), access 15 min + refresh 7 dias com rotação; o refresh reconsulta o usuário.
- **Dinheiro**: `number` no domínio, `Decimal128` na persistência; saldo em 2 buckets via `$inc` na transação.

---

## Envelope de resposta

Sucesso: `{ "payload": …, "pagination"? : { page, size, totalItems, totalPages } }`
Erro: `{ "code": "AUTH-0001", "message": "…" }` (glossário completo em [Erros](./erros.md)).

---

## Rotas

Headers: `env` (**obrigatório**, roteamento + allowlist) · `Authorization: Bearer <accessToken>` nas protegidas 🔒.

### Sistema

| Rota | Descrição |
|---|---|
| `GET /health` | health check → `{status:"ok"}` |
| `GET /documentation` | Swagger UI (não-produção) |

### Auth (`/auth`)

| Rota | Descrição | Respostas |
|---|---|---|
| `POST /signup` | usuário + restaurante + onboarding (conta + 6 categorias) **em transação** | 201 · 409 · 400 |
| `POST /login` | autentica; registra IP/UA/`lastAccessAt` | 200 · 401 · 403 · 429 |
| `POST /refresh` | rotaciona o par; reconsulta o usuário | 200 · 401 |
| `POST /logout` 🔒 | revoga o refresh e audita | 204 · 401 |
| `POST /forgot-password` | dispara recuperação — **202 sempre** (Gmail; console em dev) | 202 · 400 |
| `POST /reset-password` | redefine com token de uso único (1h) | 200 · 401 · 400 |

### People (`/people`) 🔒 — CRUD genérico completo

| Rota | Respostas |
|---|---|
| `POST /` | 200 com `_id` · 400 |
| `GET /` (`?page`,`?size`,`?isMultipleResponse`) | 200 paginado |
| `GET /:id` | 200 · 404 |
| `PATCH /:id` (schema parcial) | 200 · 400 |
| `DELETE /:id` | 204 · 404 |

### Financial accounts (`/financial-accounts`) 🔒

| Rota | Descrição |
|---|---|
| `POST /` | cria conta (saldo=0 e isDefault=false forçados pelo servidor) |
| `GET /` | lista (busca por `name`, paginação) |
| `PATCH /:id` | edita (isDefault não editável aqui) |
| `PATCH /:id/default` | define como conta padrão (transação) |
| `PATCH /:id/inactivate` | inativa (guards: saldo, conta padrão) |

### Financial categories (`/financial-categories`) 🔒

| Rota | Descrição |
|---|---|
| `POST /` · `GET /` · `PATCH /:id` | CRUD (status não muda pelo PATCH) |
| `GET /suggestions` | sugestão por direção do movimento |
| `PATCH /:id/inactivate` · `/:id/reactivate` | muda status (auditado no `history[]`) |

### Financial movements (`/financial-movements`) 🔒

| Rota | Descrição |
|---|---|
| `POST /` | registra entrada/saída + ajusta saldo (transação) |
| `GET /` | lista (busca textual, filtros direction/status/período, paginação) |
| `PATCH /:id` | edita (reverte+aplica saldo) |
| `PATCH /:id/status` | muda status (corrige o bucket do saldo) |
| `POST /recompute-balances` | reconcilia o saldo de uma conta |

---

## Variáveis de ambiente

| Var | Default | Uso |
|---|---|---|
| `MONGODB_URI` | — (obrigatória) | conexão Mongo |
| `MONGODB_MAX_POOL_SIZE` | `5` | pool (baixo p/ serverless) |
| `PORT` | `3000` | porta HTTP |
| `NODE_ENV` | — | `production` desliga Swagger e força e-mail configurado |
| `JWT_ISSUER` / `JWT_ACCESS_LIFETIME_SECONDS` / `JWT_REFRESH_LIFETIME_SECONDS` | `mintly` / `900` / `604800` | sessão |
| `MAX_LOGIN_ATTEMPTS` / `BLOCK_DURATION_MINUTES` | `5` / `15` | lockout |
| `RECOVERY_TOKEN_EXPIRY_HOURS` | `1` | validade do token de reset |
| `GMAIL_USER` / `GMAIL_APP_PASSWORD` | — | SMTP do Gmail (App Password). Sem eles: console em dev, **erro em produção** |
| `EMAIL_FROM` / `FRONTEND_URL` | `Mintly <…>` / `http://localhost:4200` | e-mail de recuperação |

---

## Scripts e ferramentas

- `npm run dev` · `build` · `typecheck` · `lint`
- `npm test` · `test:unit` · `test:int` · `test:cov` (**threshold 90%**) · `test:e2e` (local, contra Atlas)
- `npm run db:indices` — cria/garante índices no banco do env.
- `npm run db:seed-envs` — insere `staging`/`production` em `app.valid_environments` (ativa a allowlist).
- `insomnia-mintly-api.json` (raiz) — collection Insomnia com todas as rotas.

---

## Testes

Pirâmide vitest: **unit** (`*.spec.ts`, mocks) → **integration** (`*.int.spec.ts`, Fastify `inject` + `mongodb-memory-server` em replica set, por causa das transações) → **E2E** local. TDD é a regra — ver [convenções](../guias/convencoes.md).

---

## Limites conhecidos (a validar / futuro)

Registrados em `PROBLEMAS-FUTUROS.md` no repo de trabalho:

- **Liquidação de plataforma** (C3/P1): movimentos `pending` de conta platform não migram para `settled` por data — ficam presos em `predictedBalance`. Falta um settler (ou é reconciliação manual, a decidir).
- **PATCH re-precifica** (C4/P3): editar um movimento recomputa fee/net pela taxa **atual** da conta.
- **CORS `origin: true`** (M18/P4): reflete qualquer origem — restringir por `FRONTEND_URL` em prod.
