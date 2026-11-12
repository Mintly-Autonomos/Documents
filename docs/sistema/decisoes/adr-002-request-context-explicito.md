# ADR-002 — `RequestContext` passado explicitamente

**Status:** aceita (maio/2026; ampliada com `userId`/`restaurantId` em junho/2026)

## Contexto

Cada request precisa carregar até o banco: o **ambiente** (qual banco usar) e, nas rotas protegidas, **quem está chamando** (usuário e restaurante). Esses dados são usados no repositório, várias camadas abaixo do controller.

## Decisão

Um objeto `RequestContext { env, userId?, restaurantId? }` é montado no controller (`buildRequestContext(request)`) e **passado como argumento** por use-case e repositório até o banco.

- `env` vem do header (validado na allowlist).
- `userId` e `restaurantId` vêm **só** dos claims do JWT validado, nunca de header.
- `requireTenant(ctx)` falha fechado (401) se a rota não passou pelo `verifyJwt`.

## Alternativas consideradas

- **`AsyncLocalStorage`** (contexto implícito por request): evita passar o parâmetro em toda assinatura, mas esconde a dependência — uma função pode ler o tenant sem que isso apareça na assinatura — e exige montar o armazenamento nos testes.
- **Ler o header em cada repositório:** espalha a regra e permitiria identidade vinda de header.

## Consequências

- ✅ Dependência visível na assinatura de cada função: fica claro o que precisa de tenant.
- ✅ Teste trivial: basta construir um objeto literal.
- ✅ Impossível o tenant vir do cliente: o único caminho é o JWT.
- ⚠️ Toda função da cadeia recebe `ctx` como último argumento — é verboso.
- ⚠️ Operações fora de request (liquidação automática) não têm contexto e recebem só o `env` ([ADR-009](./adr-009-liquidacao-por-script.md)).

Ver: [Arquitetura → RequestContext](../api/arquitetura.md#requestcontext--o-fio-que-atravessa-tudo).
