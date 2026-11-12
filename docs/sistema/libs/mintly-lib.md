# 📦 MintlyLib — biblioteca compartilhada

**Repo:** `Mintly-Autonomos/MintlyLib` · **Pacote:** [`mintly-lib`](https://www.npmjs.com/package/mintly-lib) (npm) · **Versão:** 2.27.0-preview (staging) · **Testes:** jest · **Build:** tsc (CommonJS).

## Para que serve

A `mintly-lib` é a **fonte única de verdade dos contratos de dados** do Mintly. Formato de entidades, regras de validação, tipos de resposta, política de senha, preços de assinatura, limites da IA — tudo declarado **uma vez** aqui e consumido pelos dois lados:

- a **API** valida entrada com os schemas e persiste no formato dos tipos;
- o **frontend** importa os mesmos tipos (sem peso de banco no bundle) e consome a API pelos **clients HTTP** prontos.

Schemas em [`@ascendance-hub/sapphire-core`](https://www.npmjs.com/package/@ascendance-hub/sapphire-core) (Sapphire); os tipos TS são **inferidos do schema** (`Infer<typeof xSchema>`) — validação e tipagem nunca divergem.

---

## Contratos de dados (`core/data/`)

| Área | Exporta |
|---|---|
| `person/` | `personSchema` / `Person` (nome, telefone, foto opcional) + `personRefSchema` (extended reference) + `avatarSchema` / `updateAvatarRequestSchema` (data URL jpeg/png/webp, até 1 MB) |
| `user/` | `userSchema` / `User` — credencial: email (único), `passwordHash`, `role` (`owner`·`member`), `status` (`active`·`inactive`·`blocked`), `restaurantId` |
| `restaurant/` | `restaurantSchema` / `Restaurant` (regime tributário, `firstAccessAt`, `deletionRequestedAt`), `restaurantUpdateSchema`, tipos do perfil tributário (`RestaurantTaxProfile`, `TaxInsight`) |
| `account/` | conta de quem está logado e funcionários: `accountUpdateSchema`, `changeEmailRequestSchema`, `changePasswordRequestSchema`, `memberCreateRequestSchema`, `memberUpdateRequestSchema`, `deletionRequestSchema` |
| `financial/` | contas, categorias, movimentos, regra de repasse, importação (ver abaixo) |
| `menu/` | `menuItemSchema` / `MenuItem`, insert/update/price, `PRICE_REVIEW_ALERT_DAYS` (167) |
| `reports/` | tipos de resposta e query de Fluxo de Caixa, Resultado (DRE), Custos & Despesas e Visão Geral |
| `subscription/` | tipos, planos (1/3/6/12 meses), preços em centavos, descontos, limite de funcionários por tipo, `computeSubscriptionState`, `applySubscriptionPurchase`, `subscriptionCheckoutSchema` |
| `ai/` | `aiInsightsRequestSchema`, `aiPriceSuggestionRequestSchema`, limites (`AI_DAILY_LIMIT` = 20, palavras por texto, aumento máximo de 20%) e tipos de resposta |
| `auth/` | `signupRequestSchema`, `loginSchema`, **`passwordSchema`** (≥8, 1 maiúscula, 1 minúscula, 1 número), `resetPasswordRequest`, e respostas `LoginResult` / `RefreshResult` / `AuthUser` / `SignupResult` (com o estado da assinatura) |
| `common/` | `auditSchema` / `Audit`, `RecordStatus` |
| `request/` | `Headers`, `PaginationDto` / `FindAllRequestDto`, `ResponseDto` (envelope) |
| `api/` | `Entity` (base com `_id`) |

Os atributos de cada coleção que esses schemas descrevem estão em [Atributos das coleções](../api/colecoes-atributos.md).

### Financeiro — união discriminada

- **`financialAccountSchema`** é uma **união discriminada por `type`**: contas `platform` **exigem** `feePercent` e regra de repasse; `bank`/`cash`/`digitalWallet` as **proíbem**. `feePercent` aceita fracionário (12,5%) e tem `.max(100)`.
- **Regra de repasse** (`settlementRuleSchema`, `settlement-rule.ts`): união por `kind` — `afterDays`, `weekly`, `biweekly`, `monthly`. Funções puras usadas pela API e pelo front: `resolveSettlementRule` (cai no antigo `settlementDays` quando não há regra), `settlementDueDate` (quando cai o repasse de uma venda), `describeSettlementRule` (texto para a tela), `validateSettlementRule`.
- **`financialCategorySchema`** também é união por `type`: só despesa tem `dreGroup` (`cmv`·`labor`·`tax`·`opex`). Subcategorias têm schemas próprios (`subcategoryInsertSchema`, `subcategoryUpdateSchema`).
- **Schemas de insert dedicados** (`financialAccountInsertSchema`, `financialCategoryInsertSchema`): os campos que o servidor computa/força ficam de fora — `audit`/`restaurantId` opcionais; saldo/`isDefault`/`history` **rejeitados**.
- **Movimento**: `financialMovementSchema` (doc completo, união por `direction`) + corpos dedicados `registerMovementSchema` (com `accountId`/`categoryId`/`items: [{ menuItemId, qty }]`, não snapshots), `updateMovementSchema`, `changeMovementStatusSchema`, `recomputeBalancesSchema`, `importMovementsSchema` (até 500 linhas + `idempotencyKey`). Datas informadas pelo usuário usam `.coerce()` (aceitam ISO ou Date).

---

## Clients HTTP (`clients/`)

Wrappers tipados para o frontend consumir a API sem reescrever contratos, todos sobre `core/client/`:

| Client | Cobre |
|---|---|
| `AuthClient` | signup · login · refresh · logout · forgotPassword · resetPassword |
| `UserClient` | getMe · updateMe · changeEmail · changePassword |
| `RestaurantClient` | me · updateMe · completeFirstAccess · listMembers · createMember · updateMember · requestDeletion · cancelDeletion |
| `PersonClient` | CRUD (`/people`) + getAvatarByUsername · updateMyAvatar · removeMyAvatar |
| `FinancialAccountClient` | insert · find · findAll · update + defaultUpdate · inactivateUpdate |
| `FinancialCategoryClient` | insert · find · findAll · update + inactivate/reactivate · suggestions · add/update/inactivate/reactivate subcategoria |
| `FinancialMovementClient` | register · importMovements · list · updateMovement · changeStatus · recomputeBalances |
| `MenuItemClient` | insert · find · findAll · update · updatePrice · keepPrice · priceAlerts · inactivate/reactivate |
| `ReportClient` | cashFlow · result · expenses |
| `DashboardClient` | overview |
| `SubscriptionClient` | overview · checkout · cancelRenewal · mockDecide · mockChargeNext |
| `AiClient` | usage · insights · priceSuggestion |

`MasterClient` instancia todos de uma vez (o pacote expõe os clients por ele). O `env` vai nos `Headers` de cada chamada; a base é `process.env.BACK_END_URL`.

Comportamento comum (`core/client/create-connection.ts`):
- **`BACK_END_URL` obrigatória** — sem ela o client lança na construção, em vez de chamar `undefined/...`.
- **Timeout** configurável (`HTTP_TIMEOUT_MS`).
- **`ApiError { code, message, status }`** — um interceptor troca o `AxiosError` cru pelo envelope de erro da API.
- **`Headers` fechado:** só `env` e `authorization`. O antigo `restaurantId` saiu do tipo — a API sempre o tirou do JWT.
- Os clients de CRUD parcial **compõem** o `HttpBaseClient` em vez de estendê-lo, para não expor `findById`/`delete` que a API não tem.

---

## Como consumir

```bash
npm install mintly-lib@preview  # versão do ciclo em desenvolvimento (publicada a cada merge em staging)
npm install mintly-lib          # latest (promovido na release)
```

> ⚠️ Hoje as dist-tags estão `preview: 2.27.0-preview`, `next: 1.2.0` (antiga, não é mais usada) e `latest: 1.0.0`. A API e a Web fixam a versão `2.27.0-preview`.

```ts
import { userSchema, passwordSchema, MasterClient, type User, type LoginResult } from 'mintly-lib'
```

---

## Decisões e pegadinhas

- **Só `sapphire-core`, sem adapters de banco** — o frontend importa a lib; `Decimal128` e validators `$jsonSchema` ficam na API. Não adicionar dependências pesadas aqui.
- **Regras compartilhadas como funções puras:** preço de plano, estado da assinatura e vencimento de repasse moram aqui para que API e front calculem igual (a API decide, o front só mostra).
- **Dual package hazard**: a lib é build CJS; um `SapphireValidationError` lançado por ela pode vir de **outra instância de classe** que a do consumidor. Checar por `error.name === 'SapphireValidationError'` **além** de `instanceof` (a API já faz isso no handler).
- **Sapphire não tem `refine`/`superRefine`**: regras cross-field viram união discriminada (conta platform × taxa, categoria × `dreGroup`, movimento × categoria); as que dependem do dado gravado (ex.: taxa num PATCH sem `type`) ficam no servidor.
- **`s.date()` não aceita ISO string**: campo que chega do request precisa de `.coerce()`; datas preenchidas pelo sistema ficam estritas.
- **Versionamento**: SemVer + `CHANGELOG.md` (Keep a Changelog, PT-BR). O CI faz o bump pela mensagem de commit; em `staging` a versão ganha `-preview` e é publicada com a dist-tag `preview`; `latest` só na release — ver [processo](../guias/processo-de-release.md).

## Scripts

`npm run build` (tsc → `build/`) · `typecheck` · `lint` · `test` (jest, 27 specs) · `pack:check` (confere o conteúdo do pacote antes de publicar).

> ⚠️ **Os testes não rodam no CI:** o `ci.yml` executa lint, typecheck, build e `pack:check`, mas não o `npm test`. Ao alterar um schema, rode `npm test` localmente.

---

> **Sapphire** (validação) e **valkyrie-jwt** (sessão) são libs de membros do grupo. Como cada uma está integrada ao Mintly está em [Bibliotecas externas](./bibliotecas-externas.md).
