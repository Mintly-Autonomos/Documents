# 🗺️ MintlyApi — mapa de domínio

Este é o **mapa de quem chama quem** dentro da API: qual controller aciona qual use-case, e qual use-case toca qual repository/collection. É a referência para entender o impacto de uma mudança ("se eu mexer no saldo, o que roda?") sem ter que ler todos os arquivos.

![Mapa de domínio: use-cases → collections](/Documents/files/diagrams/mapa-de-dominio.svg)

---

## Camadas (o fluxo genérico)

```
route → controller → use-case → repository → MongoDB
                          ↑
                   RequestContext { env, userId?, restaurantId? }
```

Ver [Arquitetura](./arquitetura.md) para o detalhe de cada camada. Aqui o foco é o **grafo de chamadas**.

Duas observações que quebram o fluxo "puro" e valem destaque:

- **Use-cases transacionais escrevem em `db.collection(...)` diretamente**, sem passar por um repository. Isso é proposital: uma transação Mongo precisa que **todas** as escritas compartilhem a mesma `ClientSession`, e o CRUD genérico não expõe sessão. Então `RegisterUseCase` e os use-cases de movimento manipulam as collections na mão, dentro do `session.withTransaction(...)`. O helper `applyBalanceImpact(...)` centraliza o `$inc` de saldo.
- **`CrudUseCase` é genérico**: Person, Account e Category herdam insert/find/findAll/update/delete dele. Account e Category **sobrescrevem** `findAll`/`insert` (para escopo e regras) e adicionam use-cases próprios (set-default, inactivate…).

---

## Mapa Controller → Use-case → Repository/Collection

### Auth (`/auth`) — `AuthController`

*(as collections tocadas estão no diagrama do topo)*

| Rota | Use-case | Repository | Externo | Tx |
|---|---|---|---|---|
| `POST /signup` | `RegisterUseCase` | — (collections diretas) | valkyrie-jwt (pós-commit) | ⚡ |
| `POST /login` | `AuthUseCase.login` | `AuthRepository` | valkyrie · audit | — |
| `POST /refresh` | `AuthUseCase.refresh` | `AuthRepository` | valkyrie | — |
| `POST /logout` | `AuthUseCase.logout` | — | valkyrie · audit | — |
| `POST /forgot-password` | `PasswordRecoveryUseCase.requestRecovery` | `Auth` + `PasswordResetRepository` | email | — |
| `POST /reset-password` | `PasswordRecoveryUseCase.resetPassword` | `Auth` + `PasswordResetRepository` | valkyrie | — |

> **`RegisterUseCase`** faz person + restaurant + user + conta "Caixa" padrão + 6 categorias + 4 eventos de auditoria numa **única transação**; o `jwt.generate` roda **depois** do commit (senão deixaria refresh token órfão em retry).

### Person (`/people`) — `PersonController extends CrudController`

| Rota | Use-case | Repository | Collection |
|---|---|---|---|
| `POST · GET · GET/:id · PATCH · DELETE` | `CrudUseCase` (genérico) | `PersonRepository` → `MongodbCrudRepository` | `people` |

Person é o único CRUD **completo** exposto (a rota `/people` tem GET/:id e DELETE). Tudo escopado por `restaurantId` na base (fix do IDOR).

### Account (`/financial-accounts`) — `FinancialAccountController extends CrudController`

| Rota | Use-case | Repository | Collection | Tx |
|---|---|---|---|---|
| `POST · GET · PATCH` | `CrudUseCase` + override de `insert`/`findAll` | `FinancialAccountRepository` | `financial_accounts` | — |
| `PATCH /:id/default` | `SetDefaultAccountUseCase` | `FinancialAccountRepository` | `financial_accounts` | ⚡ |
| `PATCH /:id/inactivate` | `InactivateAccountUseCase` | `FinancialAccountRepository` | `financial_accounts` | ⚡ |

> `insert` força `availableBalance=0`, `predictedBalance=0`, `isDefault=false` (o client não injeta saldo/padrão). `SetDefault` desmarca o padrão atual e marca o novo **na mesma transação** (invariante "um só padrão").

### Category (`/financial-categories`) — `FinancialCategoryController extends CrudController`

| Rota | Use-case | Repository | Collection |
|---|---|---|---|
| `POST · GET · PATCH` | `CrudUseCase` + override de `insert`/`findAll` | `FinancialCategoryRepository` | `financial_categories` |
| `PATCH /:id/inactivate` · `/:id/reactivate` | `InactivateCategoryUseCase` | `FinancialCategoryRepository` | `financial_categories` |
| `GET /suggestions` | `SuggestCategoriesQuery` (read-only) | `FinancialCategoryRepository` | `financial_categories` |

> `status` não muda pelo PATCH genérico — só por `inactivate`/`reactivate`, que registram a mudança em `history[]`. Categorias `isSystem` (as do onboarding) não podem ser editadas.

### Movement (`/financial-movements`) — `FinancialMovementController`

Não estende `CrudController`: os corpos são dedicados (`accountId`/`categoryId`, não os snapshots) e **todo** use-case roda em transação, ajustando o saldo da conta no mesmo commit.

| Rota | Use-case | Repository | Tx |
|---|---|---|---|
| `POST /` | `RegisterMovementUseCase` | `FinancialMovementRepository` (findDuplicate) | ⚡ |
| `PATCH /:id` | `UpdateMovementUseCase` | — (collections diretas) | ⚡ |
| `PATCH /:id/status` | `ChangeMovementStatusUseCase` | — | ⚡ |
| `GET /` | `FinancialMovementRepository` (findAll + count) | — | — |
| `POST /recompute-balances` | `RecomputeBalancesUseCase` | — | ⚡ |

> **Correção de saldo** (register/update/changeStatus): calcula o `BalanceImpact` (bucket + delta), reverte o efeito antigo e aplica o novo via `applyBalanceImpact` (`$inc` Decimal128 escopado por `restaurantId`). Ver [Modelo de dinheiro](./dinheiro.md).

---

## Matriz use-case × collection

Essa matriz é exatamente o **diagrama no topo desta página** — cada card mostra quais collections o use-case escreve, com o badge ⚡ nos transacionais. (`valkyrie_*` é infra do JWT, gerida pela lib valkyrie; não aparece como collection de domínio.)

---

## Onde cada peça mora (código)

- **Controllers:** `src/app/<domínio>/*-controller.ts` · genérico: `src/core/crud/crud-controller.ts`
- **Use-cases:** `src/app/<domínio>/use-cases/*.ts` · genérico: `src/core/crud/crud-use-case.ts`
- **Repositories:** `src/app/<domínio>/*-repository.ts` · base: `src/core/crud/mongodb-crud-repository.ts`
- **Saldo (helper):** `src/app/financial-movement/movement-balance.ts` + regras puras `movement-rules.ts`
- **Auditoria:** `src/app/audit/audit-service.ts`

> 🔜 O mapa **telas → funções do client** (quem no front chama qual método) fica para quando documentarmos a MintlyWeb (com os prints das telas).
