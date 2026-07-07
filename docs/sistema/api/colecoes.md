# 🗄️ MintlyApi — coleções & índices

Modelagem **NoSQL idiomática**: sem joins — relações "vivas" por id + **Extended Reference** (snapshots embutidos). Cada `env` é um banco; o `app` é global.

![Coleções e relações](/Documents/files/diagrams/colecoes-er.svg)

---

## As coleções

| Coleção | Papel | Escopo |
|---|---|---|
| `users` | credencial de acesso (email, hash, role, status, lockout) | por tenant (`restaurantId`) |
| `people` | dados pessoais (nome, telefone, cpf) | — |
| `restaurants` | a organização dona dos dados | — |
| `financial_accounts` | contas (caixa, banco, carteira, platform) + saldos | 🏢 por tenant |
| `financial_categories` | categorias de receita/despesa | 🏢 por tenant |
| `financial_movements` | lançamentos (entrada/saída) + snapshots | 🏢 por tenant |
| `audit_logs` | trilha de eventos de segurança | por tenant |
| `password_reset_tokens` | tokens de reset (sha256, uso único) | por usuário |
| `valkyrie_*` | refresh tokens (infra da sessão) | infra da lib |
| `app.valid_environments` | allowlist de `env` (banco `app` global) | **global** |

---

## Extended Reference (por que sem joins)

Duas relações usam **snapshot embutido** em vez de referência pura:

- **`users.person`** = `{ _id, name }` — resumo da pessoa embutido no usuário (evita um `find` extra no login).
- **`financial_movements.account` / `.category`** = `{ _id, name, type }` — **congelam** a conta/categoria no momento do lançamento. Se a conta for renomeada depois, o histórico do movimento **não muda**.

> Trade-off aceito: dado duplicado (o nome aparece em 2 lugares) em troca de leitura sem join e de histórico imutável. Atualizações no documento-fonte **não** se propagam ao snapshot — é intencional para o histórico financeiro.

---

## Índices

| Coleção | Índice | Tipo | Por quê |
|---|---|---|---|
| `users` | `{ email: 1 }` | **único** | e-mail é a credencial; impede duplicata |
| `financial_accounts` | `{ restaurantId, name, type }` | único | não repetir conta no mesmo restaurante |
| `financial_accounts` | `{ status, name }` (collation pt) | ordenação | listar ativas primeiro, alfabética real |
| `financial_categories` | (por tenant/nome) | — | listagem e unicidade |
| `financial_movements` | `{ restaurantId, date: -1 }` | listagem | mais recente → antiga |
| `financial_movements` | `{ restaurantId, status }` | filtro | por status |
| `financial_movements` | `{ restaurantId, 'account._id', title, 'audit.createdAt': -1 }` | dup | detecção de duplicidade (<2min) — usa `audit.createdAt` (B4) |
| `audit_logs` | `{ restaurantId, createdAt: -1 }` · `{ userId, event, createdAt: -1 }` | consulta | trilha por tenant / usuário |
| `audit_logs` | `{ createdAt: 1 }` | **TTL 365d** | expira sozinho; não cresce sem limite (M19) |
| `password_reset_tokens` | `{ expiresAt: 1 }` | **TTL** | token some ao expirar |

### Como os índices nascem

Módulos em `src/infrastructure/db/indices/<coleção>.ts` expõem `ensure(collection)`; o runner `ensureAllIndexes(env)` roda todos. Disparado por:

```bash
npm run db:indices      # cria os índices no banco do env (MONGO_ENV)
```

> ⚠️ **Índice é por banco.** Criar num env não propaga para os outros — rodar `db:indices` em **cada** env (staging, production). O TTL do reset e o unique do e-mail que a `RegisterUseCase`/`PasswordResetRepository` garantem sob demanda (1x por env por processo) são um backstop; o job é a fonte.

---

## Eventos de auditoria (`audit_logs`)

`account_created`, `restaurant_created`, `terms_accepted`, `onboarding_completed`, `login`, `login_failed`, `account_temporarily_blocked`, `logout`, `password_recovery_requested`, `password_reset`.

Cada evento guarda `userId`, `restaurantId`, `data` e `createdAt`. Escrita via `logAudit(event, env, restaurantId, data)` — `env` é **obrigatório** (senão gravaria num banco órfão, M20).

---

## Seeds e ferramentas

- `npm run db:indices` — cria/garante índices por env.
- `npm run db:seed-envs` — insere `staging`/`production` em `app.valid_environments` (ativa a allowlist, C2).

Ver também: [Multi-tenant](./multi-tenant.md) · [Modelo de dinheiro](./dinheiro.md) · [mintly-lib](../libs/mintly-lib.md).
