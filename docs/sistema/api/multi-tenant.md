# 🏢 MintlyApi — modelo multi-tenant

O Mintly é **multi-tenant**: um mesmo deploy atende vários restaurantes. O isolamento é **híbrido**, em **dois eixos independentes**:

1. **Banco por `env`** — o header `env` seleciona o banco físico (`staging`, `production`, …).
2. **`restaurantId` por documento** — dentro do banco, cada documento pertence a um restaurante, e toda query é filtrada por ele.

![Multi-tenant híbrido](/Documents/files/diagrams/multi-tenant.svg)

---

## Eixo 1 — `env` seleciona o banco

`getDatabase(env)` faz `client.db(env)` — cada `env` é um **banco físico separado** no mesmo cluster Atlas. `staging` e `production` não se enxergam: o isolamento é no nível do banco.

- **De onde vem:** o header `env` (cliente). É o único dado de roteamento que vem de header.
- **Validação (C2):** um hook `onRequest` chama `assertValidEnv(env)`, que confere o `env` contra a allowlist em **`app.valid_environments`** (o banco `app` é compartilhado, fixo no código). `env` fora da allowlist → **`APP-0004` (400)**. Ausente → `APP-0003`.
- **Permissivo em dev/testes:** quando a allowlist está vazia (ninguém seedou o `app`), a validação não bloqueia — por isso os testes de integração usam envs arbitrários (`inttest_*`) sem problema. `npm run db:seed-envs` insere `staging`/`production` e **ativa** a proteção.

```ts
// getDatabase resolve o banco do env; withTenant escopa o dono.
const db = connection.getDatabase(ctx.env)      // client.db('staging')
```

> **Por quê banco-por-env e não uma coleção com campo `env`?** Isolamento forte e simples de operar: um dump/restore/limpeza de `staging` nunca toca `production`; índices e migrações rodam por banco. O trade-off é ter que criar índices em cada banco (`npm run db:indices` por env).

---

## Eixo 2 — `restaurantId` escopa o documento

Dentro do banco escolhido, os documentos de todos os restaurantes convivem. O que garante que o restaurante **R1** nunca leia/edite dados de **R2** é o `restaurantId`:

- **De onde vem:** dos **claims do JWT validado** (`verifyJwt`), **nunca de header**. Um cliente não consegue forjar o tenant.
- **`withTenant(filter, ctx)`** injeta `{ restaurantId }` em **toda** operação da base:

```ts
protected withTenant (filter, ctx) {
  if (ctx.restaurantId == null) return filter          // fluxos internos sem tenant
  return { ...filter, restaurantId: ctx.restaurantId }
}
```

Aplicado em `findById`, `find`, `findAll`, `update`, `delete`, `insert` (o `restaurantId` do ctx **prevalece** sobre o body) e `query(mongo:filter)`. Isso fecha o **IDOR** (S1/C1): antes, `findById`/`update`/`delete` filtravam só por `_id` e vazavam entre tenants no mesmo banco.

Além disso, `sanitizeFilter` remove chaves com operadores Mongo (`$gt`, `$where`, …) de filtros vindos de query params — evita NoSQL injection no `findAll` genérico.

---

## Como os dois eixos se combinam

| Camada | Isola por | Fonte | Falha |
|---|---|---|---|
| Banco | `env` | header `env` (validado na allowlist) | `APP-0003` / `APP-0004` |
| Documento | `restaurantId` | claims do JWT | filtrado (não aparece) |

**Regra de ouro:** *quem escolhe o banco é o `env`; quem é dono do dado é o `restaurantId`.* Um vem de header (roteamento), o outro do JWT (identidade) — nunca se cruzam.

---

## Pegadinhas e limites

- **`restaurantId` no header é campo morto** — a lib `Headers` não modela mais `restaurantId` (M26): a API o ignora e usa o do JWT.
- **Índices por banco:** criar um índice não o propaga para os outros envs; rodar `db:indices` em cada um.
- **Coleções globais** (como `app.valid_environments`) ficam de fora do `withTenant` por design — são compartilhadas entre envs.

Ver também: [Arquitetura](./arquitetura.md) · [CRUD genérico](./crud-generico.md) · [Coleções & índices](./colecoes.md).
