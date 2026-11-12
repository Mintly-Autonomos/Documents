# 🗺️ MintlyApi — mapa de domínio

Este é o **mapa de quem chama quem** dentro da API: qual controller aciona qual use-case, e qual use-case toca qual repository/collection. É a referência para entender o impacto de uma mudança ("se eu mexer no saldo, o que roda?") sem ter que ler todos os arquivos.

![Mapa de domínio: use-cases → collections](/Documents/files/diagrams/mapa-de-dominio.svg)

> O diagrama cobre o núcleo de junho (auth, pessoas, contas, categorias, movimentações). Os módulos que entraram depois (assinatura, IA, cardápio, relatórios, conta e funcionários) estão só nas tabelas abaixo.

---

## Camadas (o fluxo genérico)

```
route → controller → use-case / query → repository → MongoDB
                          ↑
                   RequestContext { env, userId?, restaurantId? }
```

Ver [Arquitetura](./arquitetura.md) para o detalhe de cada camada. Aqui o foco é o **grafo de chamadas**. ⚡ = roda em transação Mongo.

Três observações que quebram o fluxo "puro" e valem destaque:

- **Use-cases transacionais escrevem em `db.collection(...)` diretamente**, sem passar por um repository. Isso é proposital: uma transação Mongo precisa que **todas** as escritas compartilhem a mesma `ClientSession`, e o CRUD genérico não expõe sessão. O helper `applyBalanceImpact(...)` centraliza o `$inc` de saldo.
- **`CrudUseCase` é genérico**: Person, Account, Category e MenuItem herdam insert/find/findAll/update/delete dele. Account, Category e MenuItem **sobrescrevem** `findAll`/`insert` (para escopo e regras) e adicionam use-cases próprios.
- **Relatórios não escrevem nada**: são *queries* que leem `financial_movements` (e contas/categorias/restaurante) e calculam em memória, com o cálculo puro separado em `*-metrics.ts` para testar sem banco.

---

## Auth (`/auth`) — `AuthController`

| Rota | Use-case | Repository | Externo | Tx |
|---|---|---|---|---|
| `POST /signup` | `RegisterUseCase` | — (collections diretas) | valkyrie-jwt (pós-commit) | ⚡ |
| `POST /login` | `AuthUseCase.login` | `AuthRepository` + leitura da assinatura | valkyrie · audit | — |
| `POST /refresh` | `AuthUseCase.refresh` | `AuthRepository` | valkyrie | — |
| `POST /logout` | `AuthUseCase.logout` | — | valkyrie · audit | — |
| `POST /forgot-password` | `PasswordRecoveryUseCase.requestRecovery` | `Auth` + `PasswordResetRepository` | email | — |
| `POST /reset-password` | `PasswordRecoveryUseCase.resetPassword` | `Auth` + `PasswordResetRepository` | valkyrie (`revokeAllSessions`) | — |

> **`RegisterUseCase`** faz person + restaurant (`firstAccessAt: null`) + user + conta "Caixa" padrão + 6 categorias + 4 eventos de auditoria numa **única transação**; o `jwt.generate` roda **depois** do commit (senão deixaria refresh token órfão em retry).

## Conta de quem está logado (`/users`) — `account.use-cases.ts`

| Rota | Use-case | Collections | Tx |
|---|---|---|---|
| `GET /me` | `GetMyAccountQuery` | `users`, `people` | — |
| `PATCH /me` | `UpdateMyAccountUseCase` | `people` + `users.person.name` | ⚡ |
| `PATCH /me/email` | `ChangeMyEmailUseCase` (confere a senha) | `users` | — |
| `POST /me/password` | `ChangeMyPasswordUseCase` (confere a senha, revoga sessões) | `users`, `valkyrie_refresh_tokens` | — |

## Restaurante (`/restaurants`)

| Rota | Use-case / Query | Collections | Tx |
|---|---|---|---|
| `GET /me` | `GetRestaurantProfileQuery` → `TaxProfileQuery` | `restaurants`, `financial_movements`, `app.tax_settings` | — |
| `PATCH /me` | `UpdateRestaurantUseCase` | `restaurants` | — |
| `POST /me/first-access` | `RestaurantRepository.completeFirstAccess` (só grava se ainda estiver `null`) | `restaurants` | — |
| `GET/POST/PATCH /me/members` | `ListMembersQuery` · `CreateMemberUseCase` · `UpdateMemberUseCase` | `users`, `people` (limite por plano; inativar revoga sessões) | ⚡ (criação) |
| `POST/DELETE /me/deletion-request` | `RequestDeletionUseCase` · `CancelDeletionUseCase` | `restaurants`, `audit_logs` | — |

## Person (`/people`) — `PersonController extends CrudController`

| Rota | Use-case | Collection |
|---|---|---|
| `POST · GET · GET/:id · PATCH · DELETE` | `CrudUseCase` (genérico) | `people` |
| `GET /avatar/:username` | `GetPersonAvatarUseCase` | `users` → `people` |
| `PUT · DELETE /me/avatar` | `UpdatePersonAvatarUseCase` | `people`, `audit_logs` |

## Account (`/financial-accounts`) — `FinancialAccountController extends CrudController`

| Rota | Use-case | Collection | Tx |
|---|---|---|---|
| `POST · GET · PATCH` | `CrudUseCase` + override de `insert`/`findAll` + `account-rules.ts` | `financial_accounts` | — |
| `PATCH /:id/default` | `SetDefaultAccountUseCase` | `financial_accounts` | ⚡ |
| `PATCH /:id/inactivate` | `InactivateAccountUseCase` | `financial_accounts` | ⚡ |

> `insert` força `availableBalance=0`, `predictedBalance=0`, `isDefault=false`. `account-rules.ts` confere a coerência platform ⇔ taxa/regra de repasse num PATCH (depende do tipo gravado, que o schema não conhece). `SetDefault` desmarca o padrão atual e marca o novo **na mesma transação** (o índice único parcial garante "um só padrão").

## Category (`/financial-categories`) — `FinancialCategoryController extends CrudController`

| Rota | Use-case | Collection |
|---|---|---|
| `POST · GET · PATCH` | `CrudUseCase` + override de `insert`/`findAll` + `category-rules.ts` | `financial_categories` |
| `PATCH /:id/inactivate` · `/:id/reactivate` | `InactivateCategoryUseCase` | `financial_categories` |
| `GET /suggestions` | `SuggestCategoriesQuery` (read-only) | `financial_categories` |
| `/:id/subcategories[...]` | `SubcategoryUseCase` + `subcategory-rules.ts` | `financial_categories` |

> `status` não muda pelo PATCH genérico — só por `inactivate`/`reactivate`, que registram a mudança em `history[]`. Categorias `isSystem` (as do onboarding) não podem ser editadas. Despesa sem `dreGroup` recebe `opex`.

## Cardápio (`/menu-items`) — `MenuItemController extends CrudController`

| Rota | Use-case | Collection |
|---|---|---|
| `POST · GET · PATCH` | `CrudUseCase` + `menu-item-rules.ts` | `menu_items` |
| `PATCH /:id/price` · `POST /:id/price-review` · `GET /price-alerts` | métodos do controller + repository | `menu_items` |
| `PATCH /:id/inactivate` · `/reactivate` | repository | `menu_items` |

## Movement (`/financial-movements`) — `FinancialMovementController`

Não estende `CrudController`: os corpos são dedicados (`accountId`/`categoryId`, não os snapshots) e **todo** use-case de escrita roda em transação, ajustando o saldo da conta no mesmo commit.

| Rota | Use-case | Collections | Tx |
|---|---|---|---|
| `POST /` | `RegisterMovementUseCase` | escreve `financial_movements` e `financial_accounts`; lê `financial_categories` e `menu_items` (pratos) | ⚡ |
| `POST /import` | `ImportMovementsUseCase` → `RegisterMovementUseCase.executeBatch` | + `movement_imports` (idempotência) | ⚡ |
| `PATCH /:id` | `UpdateMovementUseCase` | `financial_movements`, `financial_accounts` | ⚡ |
| `PATCH /:id/status` | `ChangeMovementStatusUseCase` | `financial_movements`, `financial_accounts` | ⚡ |
| `GET /` | `FinancialMovementRepository` (findAll + count) | `financial_movements` | — |
| `POST /recompute-balances` | `RecomputeBalancesUseCase` | `financial_movements`, `financial_accounts` | ⚡ |
| *(agendado)* `npm run db:settle` | `SettleDueMovementsUseCase` | `financial_movements`, `financial_accounts` | ⚡ por movimento |

> **Correção de saldo** (register/update/changeStatus/settle): calcula o `BalanceImpact` (bucket + delta), reverte o efeito antigo e aplica o novo via `applyBalanceImpact` (`$inc` Decimal128 escopado por `restaurantId`). Ver [Modelo de dinheiro](./dinheiro.md) e [Movimentações](./movimento.md).

## Relatórios e painel (somente leitura)

| Rota | Query | Lê |
|---|---|---|
| `GET /reports/cash-flow` | `CashFlowQuery` (`cash-flow-metrics.ts`) | `financial_movements`, `financial_accounts` |
| `GET /reports/result` | `ResultQuery` (`result-metrics.ts`) + `TaxProfileQuery` | `financial_movements`, `financial_categories`, `restaurants`, `app.tax_settings` |
| `GET /reports/expenses` | `ExpensesQuery` (`expenses-metrics.ts`, `expenses-detail.ts`) | `financial_movements`, `financial_categories` |
| `GET /dashboard/overview` | `OverviewQuery` (`overview-metrics.ts`) — compõe `ResultQuery` + `CashFlowQuery` + `ExpensesQuery` | o que essas três leem |

Peças comuns em `reports/shared/`: `period.ts` (mês e fuso), `cash-date.ts` (`settledAt ?? dueDate ?? date`), `channel.ts` (canal efetivo).

## Assinatura (`/subscription`, `/webhooks`, `/admin`)

| Rota | Use-case | Collections | Externo | Tx |
|---|---|---|---|---|
| `GET /subscription` | `GetSubscriptionOverviewUseCase` | `restaurants` | — | — |
| `POST /subscription/checkout` | `CreateCheckoutUseCase` | `payments` | Mercado Pago / mock | — |
| `POST /webhooks/mercadopago` | `ConfirmPaymentUseCase` · `ConfirmAuthorizedPaymentUseCase` · `SyncPreapprovalUseCase` | `payments`, `restaurants.subscription` | Mercado Pago (reconsulta) | ⚡ |
| `POST /subscription/cancel-renewal` | `CancelRenewalUseCase` | `restaurants.subscription.recurring` | Mercado Pago | — |
| `POST /subscription/mock/*` | `MockDecideUseCase` · `MockChargeNextUseCase` | `payments`, `restaurants` | — | ⚡ |
| `POST /admin/subscription-gift` | `GiftSubscriptionUseCase` | `restaurants` | — | — |

> Pagamento aprovado soma os dias do plano a `subscription.endsAt` na mesma transação que marca `payments.appliedAt` (aviso repetido não soma de novo). Rebaixar para o Básico com mais de 5 funcionários ativos inativa os excedentes e revoga as sessões deles (`member-limit-enforcement.ts`).

## IA (`/ai`)

| Rota | Use-case | Collections | Externo |
|---|---|---|---|
| `GET /usage` | `AiRepository.usage` | `ai_usage` | — |
| `POST /insights` | `AiInsightsUseCase` (reaproveita o `OverviewQuery`) | `ai_usage`, `ai_cache` | Claude / Gemini |
| `POST /price-suggestion` | `AiPriceSuggestionUseCase` | `menu_items`, `ai_usage`, `ai_cache` | Claude / Gemini |

> Os dados enviados à IA são montados no servidor a partir do token. O texto devolvido passa por `ai-text-rules.ts` (limite de palavras, aumento máximo de 20%). O mesmo pedido no mesmo dia vem do cache e não gasta chamada; falha da IA devolve a chamada ao contador.

---

## Onde cada peça mora (código)

- **Controllers:** `src/app/<domínio>/*-controller.ts` · genérico: `src/core/crud/crud-controller.ts`
- **Use-cases / queries:** `src/app/<domínio>/use-cases/*.ts` e `*.query.ts` · genérico: `src/core/crud/crud-use-case.ts`
- **Repositories:** `src/app/<domínio>/*-repository.ts` · base: `src/core/crud/mongodb-crud-repository.ts`
- **Saldo (helper):** `src/app/financial-movement/movement-balance.ts` + regras puras `movement-rules.ts`
- **Hooks:** `src/core/hooks/verify-jwt.ts`, `require-active-subscription.ts`, `src/app/ai/require-pro-tier.ts`
- **Auditoria:** `src/app/audit/audit-service.ts` · **Revogação de sessões:** `src/app/auth/session-revocation.ts`
- **Índices:** `src/infrastructure/db/indices/<coleção>.ts`

> 🔜 O mapa **telas → funções do client** (quem no front chama qual método) fica para a documentação da [MintlyWeb](../web/mintly-web.md).
