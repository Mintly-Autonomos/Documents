# 🏛️ MintlyApi — arquitetura

**Stack:** Node 24 · Fastify 5 · MongoDB (Atlas) · [`mintly-lib`](../libs/mintly-lib.md) (contratos) · `valkyrie-jwt` (sessão) · Sapphire (validação) · vitest.

A API segue um **"Layered Simplified"**: camadas formais e explícitas, mas sem cerimônia — CRUD trivial reaproveita uma base genérica; regra de negócio ganha use-case dedicado; leitura agregada (relatórios) ganha *query* dedicada.

## Contexto — o sistema e seus vizinhos

![Diagrama de contexto](/Documents/files/diagrams/contexto.svg)

A **MintlyApi** é o núcleo: recebe chamadas da **MintlyWeb** (Angular), valida e aplica as regras, e persiste no **MongoDB Atlas** (um banco por `env`). Serviços de apoio:

| Vizinho | Para quê |
|---|---|
| **valkyrie-jwt** | sessão (tokens criptografados, refresh com rotação) |
| **Gmail (SMTP)** | e-mail de recuperação de senha |
| **Mercado Pago** | cobrança da assinatura (checkout, renovação automática, webhook) |
| **Claude / Gemini** | IA: textos dos cards de insight e sugestão de preço (plano Pro) |
| **GitHub Actions** | deploy, criação de índices e a liquidação automática diária (`settle.yml`) |

Web e API dependem do **mesmo pacote de contratos** (`mintly-lib`), o que mantém os dois lados em sincronia.

> O diagrama acima é de junho e ainda não mostra Mercado Pago, IA e o agendamento da liquidação.

## Camadas internas

![Arquitetura em camadas](/Documents/files/diagrams/arquitetura-camadas.svg)

---

## As camadas

| Camada | Responsabilidade | Onde |
|---|---|---|
| **Routes** | Declaram o endpoint no Fastify, schema de body, e os hooks (allowlist de `env`, `verifyJwt`, portão de assinatura, plano Pro). Não têm lógica. | `src/app/<domínio>/*-routes.ts` |
| **Controllers** | Montam o `RequestContext`, validam/coagem o input (`orm.parse`), chamam o use-case e formatam a resposta (`ResponseBuilder`). | `*-controller.ts` · base `core/crud/crud-controller.ts` |
| **Use-cases** | A regra de negócio. CRUD trivial usa o `CrudUseCase` genérico; fluxos com transação/regra têm use-case dedicado. | `use-cases/*.ts` · base `core/crud/crud-use-case.ts` |
| **Queries** | Leitura agregada sem escrita: relatórios, painel, perfil tributário, sugestões. Cada uma separa o cálculo puro (`*-metrics.ts`) do acesso ao banco (`*-repository.ts`). | `*.query.ts` em `reports/`, `dashboard/`, `tax/` |
| **Repositories** | Acesso ao Mongo. `MongodbCrudRepository` genérico + repos de domínio; injetam `restaurantId` (tenant) e convertem dinheiro (`Decimal128 ↔ number`). | `*-repository.ts` · base `core/crud/mongodb-crud-repository.ts` |
| **MongoDB** | Atlas, **um banco por `env`** + banco global `app`. Dinheiro em `Decimal128`; saldo acumulado via `$inc` em transação. | — |

O **grafo completo** de quem-chama-quem está no [Mapa de domínio](./mapa-de-dominio.md).

### Módulos (`src/app/`)

`auth` · `user` (conta de quem está logado) · `restaurant` (perfil, funcionários, exclusão) · `person` (+ foto) · `financial-account` · `financial-category` · `financial-movement` (+ importação e liquidação) · `menu-item` · `reports` (cash-flow, result, expenses) · `dashboard` · `tax` · `subscription` · `ai` · `audit` · `environment` · `health`.

---

## RequestContext — o fio que atravessa tudo

Um único objeto é passado **explicitamente** da rota até o banco (sem singletons/AsyncLocalStorage):

```ts
interface RequestContext { env: string; userId?: string; restaurantId?: string }
```

- **`env`** (header `env`): roteia o **banco** (`getDatabase(env)` → `client.db(env)`). É validado contra a allowlist `app.valid_environments` (rejeita ambiente desconhecido com `APP-0004`). Ver [Multi-tenant](../base-de-dados/multi-tenant.md).
- **`userId` / `restaurantId`**: extraídos **do JWT validado** pelo hook `verifyJwt`, nunca de header do cliente. `buildRequestContext(request)` os lê dos claims.
- **`withTenant(filter, ctx)`** injeta `restaurantId` em **toda** operação da base — é o que garante o isolamento multi-tenant (fecha o IDOR). `requireTenant(ctx)` falha fechado (401) se a rota não passou pelo hook.

> Regra de ouro: **quem seleciona o banco é o `env` (header); quem é o dono do dado é o `restaurantId` (JWT).** Os dois nunca se misturam.

A única operação que roda **sem** `RequestContext` é a liquidação automática (`SettleDueMovementsUseCase`): recebe só o `env`, roda fora de request e varre todos os restaurantes do banco. Ver [Movimentações](./movimento.md).

---

## Escopos de rota

O `build-server.ts` registra as rotas em quatro escopos, cada um com seus hooks:

| Escopo | Hooks | Rotas |
|---|---|---|
| **Público** | allowlist de `env` | `/health`, `/auth/*` |
| **Público com segredo** | allowlist de `env` + assinatura do aviso / `x-admin-key` | `/webhooks/mercadopago`, `/admin/subscription-gift` |
| **Login** | + `verifyJwt` | `/subscription`, `/users/me*`, `/restaurants/me/deletion-request` |
| **Login + assinatura** | + `verifyJwt` + `requireActiveSubscription` (402) | todo o resto; `/ai` ainda exige o plano Pro (`requireProTier`, 403) |

O escopo "Login" existe para que quem está com a assinatura vencida consiga assinar, trocar a senha/e-mail ou pedir a exclusão.

---

## Ciclo de vida de uma request protegida

```
1. onRequest        → valida o header `env` contra a allowlist
2. preHandler       → verifyJwt: valida o Bearer, anexa os claims
3. preHandler       → requireActiveSubscription: agora < restaurants.subscription.endsAt (senão 402)
4. preHandler       → requireProTier (só /ai): tier "pro" (senão 403)
5. controller       → buildRequestContext(request) monta o ctx
6. controller       → orm.parse(body) valida/coage (descarta campos extras)
7. use-case/query   → regra de negócio (com/sem transação)
8. repository       → withTenant + acesso ao Mongo
9. ResponseBuilder  → envelope { payload, pagination? } ou erro { code, message }
```

Outras proteções globais:
- **CORS por allowlist** (`CORS_ORIGINS`). Origem fora da lista não recebe o header `Access-Control-Allow-Origin` e o navegador barra; a API não responde erro.
- **`Content-Security-Policy`** em toda resposta (`onSend`).
- **`bodyLimit` de 2 MiB**, para caber a foto de perfil (1 MB em base64) no signup.

---

## Envelope de resposta

Sucesso (`ResponseBuilder`):

```json
{ "payload": { }, "pagination": { "page": 1, "size": 10, "totalItems": 42, "totalPages": 5 } }
```

`pagination` só em listagens; `totalItems`/`totalPages` vêm de `countDocuments` (não do tamanho da página). O `ResponseBuilder` tem dois terminais: `build()` devolve a estrutura pura (o handler retorna), `send(reply)` envia com o status.

Erro (handler global):

```json
{ "code": "AUTH-0001", "message": "Credenciais inválidas" }
```

Os códigos (`APP-*`, `AUTH-*`, `SUBSCRIPTION-0001`, `AI-*`, `VALIDATION_ERROR`, `INTERNAL_ERROR`) estão em [Erros & validação](./erros.md).

---

## Sessão (resumo)

JWT criptografado (AES-256-GCM via valkyrie-jwt), **access token 15 min + refresh token 7 dias com rotação** (reuso de refresh antigo é detectado e negado). O `refresh` **reconsulta o usuário** no banco — quem foi desativado/bloqueado depois do login não renova acesso. Troca/reset de senha, inativação de funcionário e rebaixamento de plano **revogam todas as sessões** do usuário. Detalhe em [Auth & sessão](./auth.md).

---

## O que ler a seguir

- [Mapa de domínio](./mapa-de-dominio.md) — quem chama quem.
- [Multi-tenant](../base-de-dados/multi-tenant.md) — banco-por-env + restaurantId.
- [Modelo de dinheiro](./dinheiro.md) — Decimal128, buckets, `$inc`.
- [Movimentações](./movimento.md) — registro transacional, ciclo de status, liquidação, importação.
- [Auth & sessão](./auth.md) — scrypt, lockout, rotação, recovery, conta e funcionários.
- [CRUD genérico](./crud-generico.md) — como a base funciona.
- [Coleções & índices](../base-de-dados/colecoes.md) · [Atributos das coleções](../base-de-dados/colecoes-atributos.md) · [Erros & validação](./erros.md)
- [Referência de rotas](./mintly-api.md) — todas as rotas e envelopes.
