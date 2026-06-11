# ⚙️ MintlyApi — documentação técnica

**Repo:** `Mintly-Autonomos/MintlyApi` · **Stack:** Node 20+ · Fastify · MongoDB (Atlas) · [`mintly-lib`](../libs/mintly-lib.md) · `valkyrie-jwt` · Sapphire (validação) · vitest

Swagger vivo em `/documentation` no servidor rodando.

---

## Arquitetura — "Layered Simplified"

```
route → controller → use-case → repository → MongoDB
                          ↑
                   RequestContext { env, userId?, restaurantId? }
```

- **Camadas formais** com um **`CrudUseCase` genérico** para entidades CRUD-triviais; lógica de negócio ganha use-case dedicado (`RegisterUseCase`, `AuthUseCase`, `PasswordRecoveryUseCase`).
- **`RequestContext`** é passado explicitamente da rota até o banco:
  - `env` (header `env`): roteia o **banco** — usado por testes/E2E; em produção `default`.
  - `userId`/`restaurantId`: extraídos **do JWT** pelo `buildRequestContext(request)` em rotas protegidas (nunca de header). `requireTenant(ctx)` lança 401 se a rota não passou pelo hook `verifyJwt`.
- **Validação** Sapphire dentro dos use-cases; o error handler global converte para o envelope de erro.
- **Sessão**: JWT criptografado (AES-256-GCM via valkyrie-jwt) — access token 15min + refresh token 7 dias com **rotação** (reuso de refresh antigo é detectado e negado).

## Envelope de resposta

Sucesso (`ResponseBuilder`):

```json
{ "payload": { ... }, "pagination": { "page": 1, "size": 10, "totalItems": 4, "totalPages": 1 } }
```

(`pagination` só em listagens.) Erro:

```json
{ "code": "AUTH-0001", "message": "Credenciais inválidas" }
```

| Código | HTTP | Significado |
|---|---|---|
| `AUTH-0001` | 401 | Não autenticado / credencial inválida / token inválido |
| `AUTH-0002` | 409 | E-mail já cadastrado |
| `AUTH-0003` | 403 | Conta inativa ou bloqueada |
| `AUTH-0004` | 429 | Bloqueio temporário por tentativas (lockout) |
| `VALIDATION_ERROR` | 400 | Falha de validação (vem com `details` por campo) |
| `INTERNAL_ERROR` | 500 | Erro não tratado |

## Rotas

Headers comuns: `env` (opcional, roteamento de banco) · `Authorization: Bearer <accessToken>` nas protegidas 🔒.

### Sistema

| Método/Rota | Descrição | Respostas |
|---|---|---|
| `GET /health` | Health check | 200 `{status:"ok"}` |
| `GET /documentation` | Swagger UI | 200 |

### Auth (`/auth`)

| Método/Rota | Descrição | Respostas |
|---|---|---|
| `POST /auth/signup` | Cria usuário + restaurante + onboarding (conta financeira e categorias padrão) **em transação** | 201 tokens+user+restaurant · 409 duplicado · 400 validação |
| `POST /auth/login` | Autentica por email/senha; registra IP/user-agent e `lastAccessAt` | 200 tokens · 401 genérico · 403 conta inativa/bloqueada (só após senha correta) · 429 lockout |
| `POST /auth/refresh` | Rotaciona o par de tokens | 200 · 401 inválido/rotacionado/revogado |
| `POST /auth/logout` 🔒 | Revoga o refresh token e audita | 204 · 401 sem Bearer |
| `POST /auth/forgot-password` | Solicita recuperação — **202 sempre** (não revela se o e-mail existe); e-mail via Resend (console em dev) | 202 · 400 e-mail malformado |
| `POST /auth/reset-password` | Redefine senha com token de **uso único** (1h); revoga sessões anteriores | 200 · 401 token inválido/usado/expirado · 400 senhas divergentes ou fracas |

### People (`/people`) 🔒 — CRUD genérico

| Método/Rota | Respostas |
|---|---|
| `POST /people` | 200 com `_id` · 400 validação |
| `GET /people` (`?page`, `?size`, `?isMultipleResponse=true`) | 200 paginado |
| `GET /people/:id` | 200 · 404 |
| `PATCH /people/:id` (valida com schema **parcial**) | 200 · 400 |
| `DELETE /people/:id` | 204 |

> ⚠️ Conhecido: `GET /people/:id` com ObjectId **malformado** devolve 500 em vez de 400 — registrado para correção.

## Collections

`users` (índice único em `email`; campos internos de lockout `loginAttempts`/`blockedUntil`) · `people` · `restaurants` · `financial_accounts` · `financial_categories` · `audit_logs` (eventos com `userId` + `restaurantId`) · `password_reset_tokens` (guarda **sha256** do token; TTL index em `expiresAt`) · `valkyrie_*` (infra do JWT).

Eventos de auditoria: `account_created`, `restaurant_created`, `terms_accepted`, `onboarding_completed`, `login`, `login_failed`, `account_temporarily_blocked`, `logout`, `password_recovery_requested`, `password_reset`.

## Variáveis de ambiente

| Var | Default | Uso |
|---|---|---|
| `MONGODB_URI` | — (obrigatória) | Conexão Mongo |
| `PORT` | `3000` | Porta HTTP |
| `JWT_ISSUER` / `JWT_ACCESS_LIFETIME_SECONDS` / `JWT_REFRESH_LIFETIME_SECONDS` | `mintly` / `900` / `604800` | Sessão |
| `MAX_LOGIN_ATTEMPTS` / `BLOCK_DURATION_MINUTES` | `5` / `15` | Lockout |
| `RECOVERY_TOKEN_EXPIRY_HOURS` | `1` | Validade do token de reset |
| `RESEND_API_KEY` / `EMAIL_FROM` / `FRONTEND_URL` | — / `Mintly <noreply@mintly.app>` / `http://localhost:4200` | E-mail de recuperação (sem a key, o token sai no console — modo dev) |

## Scripts e ferramentas

- `npm run dev` (tsx watch) · `build` · `typecheck` · `lint`
- `npm test` (tudo) · `test:unit` · `test:int` · `test:cov` (**threshold 90%**) · `test:e2e` (só local, contra Atlas)
- `node scripts/manual-route-check.mjs` — sobe o servidor real, exercita **todas** as rotas (70 verificações de sucesso/erro), inspeciona as collections e **dropa o banco de teste** ao final.
- `insomnia-mintly-api.json` (raiz do repo) — collection com todas as rotas para importar no Insomnia (ambiente com `base_url`, `db_env` e tokens).

## Testes

Pirâmide vitest: unit (`*.spec.ts`, dependências mockadas) → integration (`*.int.spec.ts`, Fastify `inject` + `mongodb-memory-server` com replica set, por causa das transações) → E2E local. TDD é a regra para feature e bugfix — ver [convenções](../guias/convencoes.md).
