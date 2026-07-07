# 📦 MintlyLib — biblioteca compartilhada

**Repo:** `Mintly-Autonomos/MintlyLib` · **Pacote:** [`mintly-lib`](https://www.npmjs.com/package/mintly-lib) (npm) · **Versão:** 2.7.0-preview · **Testes:** jest · **Build:** tsc.

## Para que serve

A `mintly-lib` é a **fonte única de verdade dos contratos de dados** do Mintly. Formato de entidades, regras de validação, tipos de resposta, política de senha — tudo declarado **uma vez** aqui e consumido pelos dois lados:

- a **API** valida entrada com os schemas e persiste no formato dos tipos;
- o **frontend** importa os mesmos tipos (sem peso de banco no bundle) e consome a API pelos **clients HTTP** prontos.

Schemas em [`@ascendance-hub/sapphire-core`](https://www.npmjs.com/package/@ascendance-hub/sapphire-core) (Sapphire); os tipos TS são **inferidos do schema** (`Infer<typeof xSchema>`) — validação e tipagem nunca divergem.

---

## Contratos de dados (`core/data/`)

| Área | Exporta |
|---|---|
| `person/` | `personSchema` / `Person` (nome, telefone, cpf) + `person-ref` (extended reference) |
| `user/` | `userSchema` / `User` — credencial: email (único), `passwordHash`, `role`, `status` (`active·inactive·blocked`), `restaurantId` |
| `restaurant/` | `restaurantSchema` / `Restaurant` |
| `financial/` | contas, categorias, movimentos (ver abaixo) |
| `auth/` | `signupRequestSchema`, `loginSchema`, **`passwordSchema`** (≥8, 1 maiúscula, 1 minúscula, 1 número), `resetPasswordRequest`, e respostas `LoginResult` / `RefreshResult` / `AuthUser` / `SignupResult` |
| `common/` | `Audit`, enums de status |
| `request/` | `Headers`, `PaginationDto` / `FindAllRequestDto`, `ResponseDto` (envelope) |
| `api/` | `Entity` (base com `_id`) |

### Financeiro — união discriminada

- **`financialAccountSchema`** é uma **união discriminada por `type`**: contas `platform` **exigem** `feePercent`/`settlementDays`; `bank`/`cash`/`digitalWallet` os **proíbem** (o Sapphire recusa taxa em conta não-platform). `feePercent` aceita fracionário (12,5%) e tem `.max(100)`.
- **Schemas de insert dedicados** (`financialAccountInsertSchema`, `financialCategoryInsertSchema`): os campos que o servidor computa/força ficam de fora — `audit`/`restaurantId` opcionais; saldo/`isDefault`/`history` **rejeitados** (o servidor os força).
- **Movimento**: `financialMovementSchema` (doc completo) + corpos dedicados `registerMovementSchema` (com `accountId`/`categoryId`, não snapshots), `updateMovementSchema`, `changeMovementStatusSchema`, `recomputeBalancesSchema`. Datas usam `.coerce()` (aceitam ISO ou Date).

---

## Clients HTTP (`clients/`)

Wrappers tipados para o frontend consumir a API sem reescrever contratos, todos sobre `core/client/`:

| Client | Cobre |
|---|---|
| `AuthClient` | signup · login · refresh · logout · forgot/reset-password |
| `PersonClient` | CRUD completo (`/people`) |
| `RestaurantClient` | `/restaurants` |
| `FinancialAccountClient` | insert · find · findAll · update + `defaultUpdate` · `inactivateUpdate` |
| `FinancialCategoryClient` | insert · find · findAll · update + `inactivate`/`reactivate` · `suggestions` |
| `FinancialMovementClient` | `register` · `list` · `updateMovement` · `changeStatus` · `recomputeBalances` |

`MasterClient` instancia todos de uma vez. O `env` vai nos `Headers` de cada chamada; a base é `process.env.BACK_END_URL`.

> 🔜 **PR #24 (em revisão) — refactor dos clients:** os clients de CRUD parcial passam a **compor** o `HttpBaseClient` em vez de estender (deixam de expor `findById`/`delete` inexistentes na API); `timeout` nas conexões; validação de `BACK_END_URL`; interceptor que troca `AxiosError` cru por `ApiError { code, message, status }`; `restaurantId` sai do tipo `Headers`. **Breaking** — exige bump de versão e ajuste no frontend.

---

## Como consumir

```bash
npm install mintly-lib          # latest (estável, promovido na release)
npm install mintly-lib@next     # versão do ciclo em desenvolvimento (preview)
```

```ts
import { userSchema, passwordSchema, MasterClient, type User, type LoginResult } from 'mintly-lib'
```

---

## Decisões e pegadinhas

- **Só `sapphire-core`, sem adapters de banco** — o frontend importa a lib; o adapter BSON e validators `$jsonSchema` ficam na API. Não adicionar dependências pesadas aqui.
- **Dual package hazard**: a lib é build CJS; um `SapphireValidationError` lançado por ela pode vir de **outra instância de classe** que a do consumidor. Checar por `error.name === 'SapphireValidationError'` **além** de `instanceof` (a API já faz isso no handler).
- **Sapphire não tem `refine`/`superRefine`**: regras cross-field que dependem de outro campo ausente (ex.: taxa num PATCH sem `type`) não são verificáveis no schema — ficam no servidor.
- **Versionamento**: SemVer + `CHANGELOG.md` (Keep a Changelog, PT-BR). Publica em `next` no ciclo; `latest` só na release — ver [processo](../guias/processo-de-release.md).

## Scripts

`npm run build` (tsc → `build/`) · `typecheck` · `lint` · `pack:check` (confere o conteúdo do pacote antes de publicar). Testes em **jest**.
