# 🗄️ MintlyApi — coleções & índices

Modelagem **NoSQL idiomática**: sem joins — relações "vivas" por id + **Extended Reference** (snapshots embutidos). Cada `env` é um banco; o `app` é global.

> Os **atributos e tipos** de cada coleção estão em [Atributos das coleções](./colecoes-atributos.md).

![Coleções e relações](/Documents/files/diagrams/colecoes-er.svg)

> O diagrama é de junho e mostra só as coleções do núcleo (usuários, restaurante, contas, categorias, movimentações).

---

## As coleções

Banco do ambiente (`staging`, `production`…):

| Coleção | Papel | Escopo |
|---|---|---|
| `users` | credencial de acesso (email, hash, role, status, lockout) | por tenant (`restaurantId`) |
| `people` | dados pessoais (nome, telefone, foto de perfil) | — |
| `restaurants` | a organização dona dos dados + regime tributário + assinatura | o próprio tenant |
| `financial_accounts` | contas (caixa, banco, carteira, platform) + saldos + regra de repasse | 🏢 por tenant |
| `financial_categories` | categorias de receita/despesa + grupo do DRE + subcategorias | 🏢 por tenant |
| `financial_movements` | lançamentos (entrada/saída) + snapshots + pratos vendidos | 🏢 por tenant |
| `movement_imports` | idempotência da importação de planilha | 🏢 por tenant |
| `menu_items` | pratos do cardápio (preço, custo, revisão de preço) | 🏢 por tenant |
| `payments` | pagamentos da assinatura (Mercado Pago / simulador) | 🏢 por tenant |
| `ai_usage` | contador diário de chamadas à IA | 🏢 por tenant |
| `ai_cache` | textos já gerados pela IA (mesmos dados, mesmo dia) | 🏢 por tenant |
| `audit_logs` | trilha de eventos de segurança e de conta | por tenant |
| `password_reset_tokens` | tokens de reset (sha256, uso único) | por usuário |
| `valkyrie_signing_keys` · `valkyrie_refresh_tokens` · `valkyrie_audit_events` | chaves do JWT, sessões e trilha técnica de tokens | infra da lib |

Banco global `app`:

| Coleção | Papel |
|---|---|
| `app.valid_environments` | allowlist de `env` |
| `app.tax_settings` | DAS mensal do MEI por vigência (`validFrom`) |

---

## Extended Reference (por que sem joins)

Estas relações usam **snapshot embutido** em vez de referência pura:

- **`users.person`** = `{ _id, name }` — resumo da pessoa embutido no usuário (evita um `find` extra no login).
- **`financial_movements.account` / `.category`** = `{ _id, name, type }` e **`.subcategory`** = `{ _id, name }` — **congelam** a conta/categoria no momento do lançamento. Se a conta for renomeada depois, o histórico do movimento **não muda**.
- **`financial_movements.items[]`** = `{ menuItemId, name, qty, unitPrice }` — nome e preço do prato no dia da venda. Reajustar o cardápio não muda vendas passadas.
- **`financial_movements.feePercentApplied` / `settlementRuleApplied`** — a taxa e a regra de repasse da conta no dia do lançamento.

> Trade-off aceito: dado duplicado (o nome aparece em 2 lugares) em troca de leitura sem join e de histórico imutável. Atualizações no documento-fonte **não** se propagam ao snapshot — é intencional para o histórico financeiro. A exceção é `users.person.name`, que a troca de nome em `PATCH /users/me` atualiza junto com `people`.

**Embutido, não referenciado:** as subcategorias moram dentro da categoria (`subcategories[]`) e a assinatura dentro do restaurante (`restaurants.subscription`) — são poucas, lidas sempre junto e sem crescimento ilimitado. Já os pagamentos, que crescem sem limite, ficam em `payments`.

---

## Índices

| Coleção | Índice | Tipo | Por quê |
|---|---|---|---|
| `users` | `{ email: 1 }` | **único** | e-mail é a credencial; impede duplicata |
| `financial_accounts` | `{ restaurantId, name, type }` (collation pt, sem acento/caixa) | **único** | não repetir conta no mesmo restaurante |
| `financial_accounts` | `{ restaurantId, status }` | filtro | listar ativas |
| `financial_accounts` | `{ restaurantId }` com `isDefault: true` | **único parcial** | só uma conta padrão por restaurante |
| `financial_categories` | `{ restaurantId, name, type }` (collation pt) | **único** | não repetir categoria |
| `financial_categories` | `{ restaurantId, status }` | filtro | listar ativas |
| `financial_categories` | `{ restaurantId, type, status, lastUsedAt: -1, usage: -1 }` | ordenação | sugestão de categoria |
| `financial_movements` | `{ restaurantId, date: -1 }` | listagem | mais recente → antiga |
| `financial_movements` | `{ restaurantId, status }` | filtro | por status |
| `financial_movements` | `{ restaurantId, 'account._id', title, 'audit.createdAt': -1 }` | dup | detecção de duplicidade (<2min) |
| `financial_movements` | `{ status, direction, 'account.type', dueDate }` | varredura | liquidação automática (cross-tenant) |
| `financial_movements` | `{ restaurantId, status, dueDate }` · `{ restaurantId, status, settledAt }` | relatórios | Fluxo de Caixa (a receber/pagar, vencidos, realizado) |
| `movement_imports` | `{ restaurantId, key }` | **único** | uma importação por chave |
| `movement_imports` | `{ createdAt: 1 }` | **TTL 30d** | a chave expira e o arquivo pode ser reimportado |
| `menu_items` | `{ restaurantId, name }` (collation pt) | **único** | não repetir prato |
| `menu_items` | `{ restaurantId, status, priceReviewedAt }` | filtro | alertas de revisão de preço |
| `payments` | `{ providerPaymentId }` (só quando é string) | **único parcial** | aviso repetido do provedor não soma dias duas vezes |
| `payments` | `{ restaurantId, createdAt: -1 }` | listagem | histórico do restaurante |
| `ai_usage` · `ai_cache` | `{ expireAt: 1 }` | **TTL** | contador some 3 dias depois; cache, 2 dias |
| `audit_logs` | `{ restaurantId, createdAt: -1 }` · `{ userId, event, createdAt: -1 }` | consulta | trilha por tenant / usuário |
| `audit_logs` | `{ createdAt: 1 }` | **TTL 365d** | expira sozinho; não cresce sem limite (M19) |
| `password_reset_tokens` | `{ expiresAt: 1 }` | **TTL** | token some ao expirar |

As coleções `ai_usage` e `ai_cache` usam `_id` em texto (`restaurantId:dia…`), então a busca pelo dia é direto pela chave primária.

### Como os índices nascem

Módulos em `src/infrastructure/db/indices/<coleção>.ts` expõem `ensure(collection)`; o runner `ensureAllIndexes(env)` roda todos. Disparado por:

```bash
npm run db:indices      # cria os índices no banco do env (MONGO_ENV)
```

Roda no job de deploy e antes de cada liquidação (`settle.yml`).

> ⚠️ **Índice é por banco.** Criar num env não propaga para os outros — rodar `db:indices` em **cada** env (staging, production). O TTL do reset e o unique do e-mail que a `RegisterUseCase`/`PasswordResetRepository` garantem sob demanda (1x por env por processo) são um backstop; o job é a fonte.

---

## Eventos de auditoria (`audit_logs`)

| Grupo | Eventos |
|---|---|
| cadastro | `account_created`, `restaurant_created`, `terms_accepted`, `onboarding_completed` |
| sessão | `login`, `login_failed`, `logout`, `account_temporarily_blocked` |
| senha | `password_recovery_requested`, `password_reset`, `password_changed`, `password_confirmation_failed` |
| conta | `account_updated`, `email_changed`, `avatar_updated`, `avatar_removed` |
| funcionários | `member_created`, `member_updated`, `members_deactivated_by_plan` |
| exclusão | `deletion_requested`, `deletion_cancelled` |

Cada evento guarda `userId`, `restaurantId`, `data` e `createdAt`. Escrita via `logAudit(event, userId, env, restaurantId, data)` — `env` é **obrigatório** (senão gravaria num banco órfão, M20).

---

## Seeds e ferramentas

- `npm run db:indices` — cria/garante índices por env.
- `npm run db:seed-envs` — insere `staging`/`production` em `app.valid_environments` (ativa a allowlist, C2).
- `npm run db:seed-tax-settings` — grava o DAS do MEI vigente em `app.tax_settings`.
- `npm run db:seed-demo` — restaurante de demonstração.
- `npm run db:settle` — liquidação automática (ver [Movimentações](./movimento.md)).

Ver também: [Atributos das coleções](./colecoes-atributos.md) · [Multi-tenant](./multi-tenant.md) · [Modelo de dinheiro](./dinheiro.md) · [mintly-lib](../libs/mintly-lib.md).
