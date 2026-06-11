# 📦 MintlyLib — biblioteca compartilhada

**Repo:** `Mintly-Autonomos/MintlyLib` · **Pacote:** [`mintly-lib`](https://www.npmjs.com/package/mintly-lib) (npm) · **Versão atual:** 1.2.0

## Para que serve

A `mintly-lib` é a **fonte única de verdade dos contratos de dados** do Mintly. Tudo que API e frontend precisam concordar — formato de entidades, regras de validação, tipos de resposta, política de senha — mora aqui, declarado **uma vez** e consumido pelos dois lados:

- a **API** valida entrada com os schemas e persiste documentos no formato dos tipos;
- o **frontend** importa os mesmos tipos (sem peso de dependências de banco no bundle) e consome a API pelos **clients HTTP** prontos.

Os schemas são declarados com [`@ascendance-hub/sapphire-core`](https://www.npmjs.com/package/@ascendance-hub/sapphire-core) (Sapphire), e os tipos TypeScript são **inferidos do schema** (`Infer<typeof xSchema>`) — validação e tipagem nunca divergem.

## Conteúdo (v1.2.0)

### Contratos de dados (`core/data/`)

| Área | O que exporta |
|---|---|
| `person/` | `personSchema` / `Person` (dados pessoais: nome, telefone, cpf) + *extended reference* (`person-ref-schema`) para embutir resumo de pessoa em outros documentos |
| `user/` | `userSchema` / `User` — **credencial de acesso** separada dos dados pessoais: email (único), `passwordHash`, `role`, `status` (`active · inactive · blocked`), vínculo com `restaurantId` |
| `restaurant/` | `restaurantSchema` / `Restaurant` — a organização dona dos dados |
| `financial/` | `financialAccountSchema` / `FinancialAccount` e `financialCategorySchema` / `FinancialCategory` (contas e categorias criadas no onboarding) |
| `auth/` | `signupRequestSchema`, `loginSchema`, **`passwordSchema`** (política única: ≥8 caracteres, 1 maiúscula, 1 minúscula, 1 número) e tipos de resposta `LoginResult`, `RefreshResult`, `AuthUser` |
| `common/` | `Audit` (createdAt/updatedAt), enums de status |
| `request/` | `Headers`, `PaginationDto`/`FindAllRequestDto`, envelope de resposta |
| `api/` | `Entity` (base com `_id`) |

### Clients HTTP (`clients/`)

Wrappers tipados para o frontend consumir a API sem reescrever contratos: `AuthClient`, `PersonClient`, `RestaurantClient`, `FinancialAccountClient`, `FinancialCategoryClient` — todos sobre uma base comum (`core/client/`).

## Como consumir

```bash
npm install mintly-lib          # latest (estável, promovido na release)
npm install mintly-lib@next     # versão do ciclo em desenvolvimento
```

```ts
import { userSchema, passwordSchema, type User, type LoginResult } from 'mintly-lib'
```

## Decisões e pegadinhas

- **Só `sapphire-core`, sem adapters de banco** — o frontend importa a lib; o adapter BSON (e validators `$jsonSchema`) ficam na API. Não adicionar dependências pesadas aqui.
- **Dual package hazard**: a lib é build CJS; erros do Sapphire lançados por ela podem vir de **outra instância de classe** que a do consumidor. Checar erro por `error.name === 'SapphireValidationError'` além de `instanceof`.
- **Versionamento**: SemVer + `CHANGELOG.md` (Keep a Changelog, PT-BR). Publicação em `next` durante o ciclo; `latest` só na release ([processo](../guias/processo-de-release.md)).

## Scripts

`npm run build` (tsc → `build/`) · `typecheck` · `lint` · `pack:check` (confere o conteúdo do pacote antes de publicar).
