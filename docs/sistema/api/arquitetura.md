# 🏛️ MintlyApi — arquitetura

**Stack:** Node 20+ · Fastify · MongoDB (Atlas) · [`mintly-lib`](../libs/mintly-lib.md) (contratos) · `valkyrie-jwt` (sessão) · Sapphire (validação) · vitest.

A API segue um **"Layered Simplified"**: camadas formais e explícitas, mas sem cerimônia — CRUD trivial reaproveita uma base genérica; regra de negócio ganha use-case dedicado.

![Arquitetura em camadas](/files/diagrams/arquitetura-camadas.svg)

---

## As camadas

| Camada | Responsabilidade | Onde |
|---|---|---|
| **Routes** | Declaram o endpoint no Fastify, schema de body, e os hooks (allowlist de `env`, `verifyJwt` nas protegidas). Não têm lógica. | `src/app/<domínio>/*-routes.ts` |
| **Controllers** | Montam o `RequestContext`, validam/coagem o input (`orm.parse`), chamam o use-case e formatam a resposta (`ResponseBuilder`). | `*-controller.ts` · base `core/crud/crud-controller.ts` |
| **Use-cases** | A regra de negócio. CRUD trivial usa o `CrudUseCase` genérico; fluxos com transação/regra têm use-case dedicado. | `use-cases/*.ts` · base `core/crud/crud-use-case.ts` |
| **Repositories** | Acesso ao Mongo. `MongodbCrudRepository` genérico + repos de domínio; injetam `restaurantId` (tenant) e convertem dinheiro (`Decimal128 ↔ number`). | `*-repository.ts` · base `core/crud/mongodb-crud-repository.ts` |
| **MongoDB** | Atlas, **um banco por `env`**. Dinheiro em `Decimal128`; saldo acumulado via `$inc` em transação. | — |

O **grafo completo** de quem-chama-quem está no [Mapa de domínio](./mapa-de-dominio.md).

---

## RequestContext — o fio que atravessa tudo

Um único objeto é passado **explicitamente** da rota até o banco (sem singletons/AsyncLocalStorage):

```ts
interface RequestContext { env: string; userId?: string; restaurantId?: string }
```

- **`env`** (header `env`): roteia o **banco** (`getDatabase(env)` → `client.db(env)`). É validado contra a allowlist `app.valid_environments` (rejeita ambiente desconhecido com `APP-0004`). Ver [Multi-tenant](./multi-tenant.md).
- **`userId` / `restaurantId`**: extraídos **do JWT validado** pelo hook `verifyJwt`, nunca de header do cliente. `buildRequestContext(request)` os lê dos claims.
- **`withTenant(filter, ctx)`** injeta `restaurantId` em **toda** operação da base — é o que garante o isolamento multi-tenant (fecha o IDOR).

> Regra de ouro: **quem seleciona o banco é o `env` (header); quem é o dono do dado é o `restaurantId` (JWT).** Os dois nunca se misturam.

---

## Ciclo de vida de uma request protegida

```
1. onRequest        → valida o header `env` contra a allowlist
2. preHandler       → verifyJwt: valida o Bearer, anexa os claims
3. controller       → buildRequestContext(request) monta o ctx
4. controller       → orm.parse(body) valida/coage (descarta campos extras)
5. use-case         → regra de negócio (com/sem transação)
6. repository       → withTenant + acesso ao Mongo
7. ResponseBuilder  → envelope { payload, pagination? } ou erro { code, message }
```

Rotas públicas (`/health`, `/auth/*`) pulam os passos 2-3 de identidade — mas `/auth` ainda passa pela allowlist de `env`.

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

| Código | HTTP | Significado |
|---|---|---|
| `AUTH-0001` | 401 | Não autenticado / credencial ou token inválido |
| `AUTH-0002` | 409 | Conflito (ex.: e-mail já cadastrado) |
| `AUTH-0003` | 403 | Conta inativa ou bloqueada |
| `AUTH-0004` | 429 | Lockout temporário por tentativas |
| `APP-0001` | 404 | Recurso não encontrado |
| `APP-0002` | 400 | Query kind não suportada |
| `APP-0003` | 400 | Header `env` ausente |
| `APP-0004` | 400 | `env` fora da allowlist |
| `VALIDATION_ERROR` | 400 | Falha de validação (com `details` por campo) |
| `INTERNAL_ERROR` | 500 | Erro não tratado |

Os códigos moram numa fonte única (`error-glossary.ts`); os erros de auth referenciam o glossário (não têm código inline). Ver [Erros & validação](./erros.md).

---

## Sessão (resumo)

JWT criptografado (AES-256-GCM via valkyrie-jwt), **access token 15 min + refresh token 7 dias com rotação** (reuso de refresh antigo é detectado e negado). O `refresh` **reconsulta o usuário** no banco — quem foi desativado/bloqueado depois do login não renova acesso. Detalhe em [Auth & sessão](./auth.md).

---

## O que ler a seguir

- [Mapa de domínio](./mapa-de-dominio.md) — quem chama quem.
- [Multi-tenant](./multi-tenant.md) — banco-por-env + restaurantId.
- [Modelo de dinheiro](./dinheiro.md) — Decimal128, buckets, `$inc`.
- [Auth & sessão](./auth.md) — scrypt, lockout, rotação, recovery.
- [CRUD genérico](./crud-generico.md) — como a base funciona.
- [Coleções & índices](./colecoes.md) · [Erros & validação](./erros.md)
- [Referência de rotas](./mintly-api.md) — todas as rotas e envelopes.
