# ADR-003 — Multi-tenant: banco por `env` + `restaurantId` do JWT

**Status:** aceita

## Contexto

Um mesmo deploy precisa atender vários restaurantes e, no mesmo cluster do Atlas, separar ambientes (`staging`, `production`, testes E2E).

## Decisão

Isolamento em **dois eixos independentes**:

1. **Banco por ambiente:** o header `env` escolhe o banco físico (`client.db(env)`), validado contra a allowlist `app.valid_environments`.
2. **`restaurantId` por documento:** dentro do banco, todo documento de restaurante tem `restaurantId`, e o repositório base injeta esse filtro em **toda** operação (`withTenant`). O valor vem do JWT.

## Alternativas consideradas

- **Um banco por restaurante:** isolamento máximo, mas cria e migra um banco a cada cadastro, multiplica índices e conexões, e torna relatórios cross-tenant (liquidação, suporte) caros.
- **Um banco só com campo `env` nos documentos:** um dump, restore ou limpeza de staging poderia tocar produção; um filtro esquecido misturaria ambientes.

## Consequências

- ✅ Staging e production não se enxergam; limpar um nunca toca o outro.
- ✅ Testes de integração e E2E usam bancos próprios (`inttest_*`, `e2e`) no mesmo cluster.
- ✅ O filtro de tenant está num lugar só e fechou o IDOR que existia quando `findById`/`update`/`delete` filtravam só por `_id`.
- ⚠️ **Índices são por banco:** `db:indices` precisa rodar em cada ambiente.
- ⚠️ O vazamento entre restaurantes depende de toda consulta passar pelo filtro — inclusive agregações de relatório, onde um filtro esquecido vira um número errado que ninguém percebe.
- ⚠️ O header `env` vem do cliente: a allowlist é o que impede criar bancos arbitrários.

Ver: [Multi-tenant](../base-de-dados/multi-tenant.md).
