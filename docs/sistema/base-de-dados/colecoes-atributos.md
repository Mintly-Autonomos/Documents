# 🧬 Base de dados — atributos das coleções

> Cada coleção com o tipo de cada campo e um exemplo de preenchimento. Para papel, escopo e índices, ver [Coleções & índices](../api/colecoes.md).
>
> Atualizado em 12/11/2026 a partir do **`origin/staging`** dos dois repositórios:
> - **MintlyLib** `2.27.0-preview`: schemas Sapphire em `src/core/data/**`
> - **MintlyApi**: tipos dos repositórios em `src/app/**`, usados nas coleções que não têm schema na lib
> - **valkyrie-jwt** `0.1.1`: stores Mongo da biblioteca de JWT, para as coleções `valkyrie_*`
>
> A lista de coleções confere com o banco `staging` do Atlas (print de 12/11/2026); `valid_environments` e `tax_settings` ficam no banco `app`.

## Como ler os blocos

Cada coleção tem um bloco com o **tipo** de cada campo e, no comentário ao lado, um **exemplo de preenchimento**:

```jsonc
{
  "campo": string,                 // "exemplo de valor"
  "opcional"?: number,             // `?` = campo opcional
  "enum": "a" | "b",               // valores aceitos
  "comPadrao": number = 0,         // `= X` = valor padrão quando não enviado
  "lista": Item[]                  // array
}
```

## Convenções

- **Coleção** em `snake_case`, **campo** em `camelCase`, valores de enum em inglês.
- Cada `env` (header `env`) é um **banco separado** (ex.: `staging`). Só `valid_environments` e `tax_settings` ficam no banco global `app`.
- `ObjectId` é o `_id` do Mongo; no contrato da lib ele chega como `string` (`Entity = { id?, _id? }`). Algumas coleções usam `_id` do tipo `string` composto. Nesses casos isso está indicado.
- **`Date`** é BSON Date. Nos exemplos aparece em ISO. Os campos marcados com `coerce` aceitam ISO string na entrada.
- **`Decimal128`** é dinheiro: `number` no contrato da lib e `Decimal128` quando a API grava. Os campos `…Cents` são inteiros em centavos.
- **Extended Reference**: subdocumentos como `account`, `category`, `items[]` e `user.person` são cópias congeladas no momento da gravação. Se a origem muda depois, a cópia não muda.
- **TTL**: o Mongo apaga o documento sozinho depois do prazo indicado.

### Subdocumentos reutilizados

**`Audit`**: aparece em todas as entidades da lib.

```jsonc
{
  "createdAt": Date,               // "2026-11-04T19:40:00.000Z"  (coerce)
  "updatedAt": Date,               // "2026-11-04T19:40:00.000Z"  (coerce)
  "createdBy"?: string,            // "6650a1f0c2e4b1a9d0f1a002"  (userId; vazio no signup)
  "updatedBy"?: string             // "6650a1f0c2e4b1a9d0f1a002"  (userId)
}
```

**`HistoryEntry`**: aparece em contas, categorias e movimentações.

```jsonc
{
  "at": Date,                      // "2026-11-04T19:47:00.000Z"  (coerce)
  "by": string,                    // "6650a1f0c2e4b1a9d0f1a002"  (userId)
  "action": string,                // "created" | "statusChanged" | ...
  "detail"?: string                // "status: pending → settled"
}
```

**`SettlementRule`**: regra de repasse de uma plataforma (iFood, Keeta, 99…). União discriminada por `kind`; cada variante tem os próprios campos:

```jsonc
{ "kind": "afterDays", "days": number }                         // { "kind": "afterDays", "days": 30 }  (0–365; 0 = cai na hora)
{ "kind": "weekly",    "weekday": number }                      // { "kind": "weekly", "weekday": 3 }  (0 = domingo … 6 = sábado)
{ "kind": "biweekly",  "firstDay": number, "secondDay": number } // { "kind": "biweekly", "firstDay": 5, "secondDay": 20 }  (1–31, dias diferentes)
{ "kind": "monthly",   "day": number }                          // { "kind": "monthly", "day": 10 }  (1–31; 31 em mês curto = último dia)
```

**`RecordStatus`**: `"active" | "inactive"`

---

## Visão geral

| Coleção | Papel | Escopo | Origem do schema |
|---|---|---|---|
| [`people`](#people) | dados pessoais + foto de perfil | — | lib `personSchema` |
| [`users`](#users) | credencial de acesso | `restaurantId` | lib `userSchema` + campos da API |
| [`restaurants`](#restaurants) | organização dona dos dados (tenant) + assinatura | — | lib `restaurantSchema` + campos da API |
| [`financial_accounts`](#financial_accounts) | contas (banco, caixa, carteira, plataforma) e saldos | `restaurantId` | lib `financialAccountSchema` |
| [`financial_categories`](#financial_categories) | categorias de receita e despesa (+ subcategorias) | `restaurantId` | lib `financialCategorySchema` |
| [`financial_movements`](#financial_movements) | lançamentos (entrada e saída) + pratos vendidos | `restaurantId` | lib `financialMovementSchema` |
| [`movement_imports`](#movement_imports) | idempotência da importação de planilha | `restaurantId` | API `MovementImportDoc` |
| [`menu_items`](#menu_items) | pratos do cardápio | `restaurantId` | lib `menuItemSchema` |
| [`payments`](#payments) | pagamentos da assinatura | `restaurantId` | API `PaymentRecord` |
| [`ai_usage`](#ai_usage) | contador diário de chamadas à IA | `restaurantId` | API `AiRepository` |
| [`ai_cache`](#ai_cache) | cache dos textos gerados pela IA | `restaurantId` | API `AiRepository` |
| [`audit_logs`](#audit_logs) | trilha de eventos de segurança e de conta | `restaurantId` | API `AuditLog` |
| [`password_reset_tokens`](#password_reset_tokens) | tokens de recuperação de senha | `userId` | API `PasswordResetToken` |
| [`valkyrie_signing_keys`](#valkyrie_signing_keys) | chaves que assinam os JWT | infra | valkyrie-jwt |
| [`valkyrie_refresh_tokens`](#valkyrie_refresh_tokens) | refresh tokens (sessões) | infra | valkyrie-jwt |
| [`valkyrie_audit_events`](#valkyrie_audit_events) | eventos de emissão e validação de token | infra | valkyrie-jwt |
| [`valid_environments`](#valid_environments) (banco `app`) | lista de `env` permitidos | global | API `env-allowlist` |
| [`tax_settings`](#tax_settings) (banco `app`) | DAS mensal do MEI por vigência | global | API `TaxSettingsRepository` |

---

## `people`

```jsonc
{
  "_id": ObjectId,                 // "6650a1f0c2e4b1a9d0f1a001"
  "name": string,                  // "Maria Souza"
  "phone": string,                 // "+5511987654321"
  "avatar"?: string,               // "data:image/png;base64,iVBORw0KGgo…"  (data URL jpeg/png/webp; máx. 1 MB)
  "audit": Audit                   // { "createdAt": "2026-11-04T19:40:00.000Z", "updatedAt": "2026-11-04T19:40:00.000Z" }
}
```

---

## `users`

```jsonc
{
  "_id": ObjectId,                          // "6650a1f0c2e4b1a9d0f1a002"
  "person": {                               // Extended Reference → people
    "_id": string,                          // "6650a1f0c2e4b1a9d0f1a001"
    "name": string                          // "Maria Souza"
  },
  "email": string,                          // "maria@docesdamaria.com.br"  (formato e-mail; índice único)
  "passwordHash": string,                   // "scrypt$…"  (nunca exposto na resposta)
  "status": "active" | "inactive" | "blocked",  // "active"
  "role": "owner" | "member",               // "owner"  (member = funcionário criado pelo dono)
  "restaurantId": string,                   // "6650a1f0c2e4b1a9d0f1a003"
  "termsAcceptedAt"?: Date,                 // "2026-11-04T19:40:00.000Z"  (coerce)
  "lastAccessAt"?: Date,                    // "2026-11-12T11:02:00.000Z"  (coerce)
  "audit": Audit,                           // { "createdAt": "...", "updatedAt": "..." }

  // ── campos só da API (UserRecord), fora do contrato da lib ──
  "loginAttempts"?: number,                 // 0  (tentativas de login erradas seguidas)
  "blockedUntil"?: Date | null              // null  ou "2026-11-12T11:17:00.000Z"  (bloqueio → 429)
}
```

---

## `restaurants`

```jsonc
{
  "_id": ObjectId,                                   // "6650a1f0c2e4b1a9d0f1a003"
  "name": string,                                    // "Doces da Maria"
  "taxRegime"?: "mei" | "simplesNacionalAnexoI",     // "simplesNacionalAnexoI"  (vazio = imposto 0 + aviso)
  "firstAccessAt"?: Date | null,                     // "2026-11-04T19:52:00.000Z"  (coerce; null = onboarding pendente; ausente = restaurante antigo)
  "deletionRequestedAt"?: Date | null,               // null  (pedido de exclusão; o dono pode cancelar; o motivo vai p/ audit_logs)
  "audit": Audit,                                    // { "createdAt": "...", "updatedAt": "..." }

  // ── assinatura: só na API (gravada pelos use-cases de subscription), fora do restaurantSchema ──
  "subscription"?: {
    "endsAt": Date,                                  // "2027-02-02T19:47:00.000Z"  (acesso vale enquanto agora < endsAt)
    "tier"?: "basic" | "pro",                        // "pro"  (ausente = basic)
    "plan"?: 1 | 3 | 6 | 12,                         // 3  (meses do último plano pago)
    "lastPaymentId"?: string,                        // "6650a1f0c2e4b1a9d0f1a080"  (→ payments._id)
    "giftedAt"?: Date,                               // "2026-11-04T19:40:00.000Z"  (acesso cortesia concedido)
    "updatedAt": Date,                               // "2026-11-04T19:47:00.000Z"
    "recurring"?: {                                  // renovação automática (Mercado Pago preapproval)
      "preapprovalId": string,                       // "2c9380848f…"  (id da assinatura no provedor)
      "status": "pending" | "authorized" | "paused" | "cancelled",  // "authorized"
      "tier": "basic" | "pro",                       // "pro"
      "months": 1 | 3 | 6 | 12,                      // 3
      "provider": "mock" | "mercadopago",            // "mercadopago"
      "startedAt": Date,                             // "2026-11-04T19:47:00.000Z"
      "cancelledAt"?: Date,                          // "2026-12-01T10:00:00.000Z"
      "updatedAt": Date                              // "2026-11-04T19:47:00.000Z"
    }
  }
}
```

> O perfil tributário (`RestaurantTaxProfile`) e o estado da assinatura (`active` / `expired` / `none`, `daysLeft`) são **calculados** na leitura e não são gravados.

---

## `financial_accounts`

União discriminada por `type`: a conta `platform` exige `feePercent` e uma regra de repasse (`settlementRule` ou, nas contas antigas, `settlementDays`). Os outros tipos não aceitam esses campos.

```jsonc
{
  "_id": ObjectId,                    // "6650a1f0c2e4b1a9d0f1a010"
  "restaurantId": string,             // "6650a1f0c2e4b1a9d0f1a003"
  "name": string,                     // "iFood"  (único por restaurantId + name + type)
  "type": "bank" | "cash" | "digitalWallet" | "platform",  // "platform"  (não pode ser alterado depois)
  "feePercent": number,               // 12.5  (0–100; obrigatório só se type = "platform", proibido nos outros)
  "settlementRule"?: SettlementRule,  // { "kind": "weekly", "weekday": 3 }  (só platform; a regra que vale)
  "settlementDays"?: number,          // 30  (só platform; formato antigo = "N dias após a venda")
  "status": RecordStatus,             // "active"
  "isDefault": boolean,               // false  (sempre false no insert; muda só pelo SetDefault)
  "availableBalance": Decimal128 = 0, // 3200.00  (atualizado só pelas movimentações)
  "predictedBalance": Decimal128 = 0, // 5480.90  (atualizado só pelas movimentações)
  "history": HistoryEntry[] = [],     // [{ "at": "2026-11-04T19:45:00.000Z", "by": "6650...a002", "action": "created" }]
  "audit": Audit                      // { "createdAt": "...", "updatedAt": "..." }
}
```

> Em conta `platform`, pelo menos um entre `settlementRule` e `settlementDays` precisa existir. Essa checagem é feita na API (`account-rules.ts`). A leitura usa `settlementRule ?? { kind: "afterDays", days: settlementDays }`.

---

## `financial_categories`

União discriminada por `type`: só a categoria de despesa tem `dreGroup`, e nela o campo é obrigatório.

```jsonc
{
  "_id": ObjectId,                                  // "6650a1f0c2e4b1a9d0f1a020"
  "restaurantId": string,                           // "6650a1f0c2e4b1a9d0f1a003"
  "name": string,                                   // "CMV/Insumos"
  "type": "revenue" | "expense",                    // "expense"
  "dreGroup": "cmv" | "labor" | "tax" | "opex",     // "cmv"  (obrigatório só se type = "expense"; no insert vazio a API grava "opex")
  "behavior": "fixed" | "variable" | "mixed",       // "variable"
  "operationalNature": "operational" | "nonOperational",  // "operational"
  "status": RecordStatus,                           // "active"
  "isSystem": boolean,                              // true  (categoria padrão criada no signup)
  "usage": number = 0,                              // 42  (inteiro; contador p/ sugestão; não editável; ⚠️ hoje nenhuma rota incrementa)
  "lastUsedAt"?: Date,                              // "2026-11-04T19:47:00.000Z"  (coerce; não editável; ⚠️ hoje nenhuma rota preenche)
  "subcategories": [                                // = []  (gerida só por /:id/subcategories)
    {
      "_id": string,                                // "6650a1f0c2e4b1a9d0f1a021"
      "name": string,                               // "Chocolate"  (máx. 60)
      "status": RecordStatus                        // "active"  (só inativa, nunca apaga)
    }
  ],
  "history": HistoryEntry[] = [],                   // []
  "audit": Audit                                    // { "createdAt": "...", "updatedAt": "..." }
}
```

---

## `financial_movements`

União discriminada por `direction`: `in` exige `category.type = "revenue"` e `out` exige `category.type = "expense"`.

```jsonc
{
  "_id": ObjectId,                          // "6650a1f0c2e4b1a9d0f1a030"
  "restaurantId": string,                   // "6650a1f0c2e4b1a9d0f1a003"
  "direction": "in" | "out",                // "out"  (não pode ser alterado depois)
  "title": string,                          // "Chocolates Callebaut — NF 05/10"  (máx. 120)

  "grossValue": Decimal128,                 // 1501.25  (> 0)
  "feeValue": Decimal128 = 0,               // 0  (≥ 0; calculado pelo servidor — taxa da plataforma)
  "netValue": Decimal128,                   // 1501.25  (≥ 0; calculado: bruto − taxa)
  "feePercentApplied"?: number,             // 12.5  (0–100; taxa da conta platform congelada no registro)
  "settlementDaysApplied"?: number,         // 30  (inteiro ≥ 0; prazo antigo da conta platform congelado no registro)
  "settlementRuleApplied"?: SettlementRule, // { "kind": "weekly", "weekday": 3 }  (regra da conta congelada no registro)

  "date": Date,                             // "2026-10-05T03:00:00.000Z"  (coerce; data do lançamento)
  "dueDate"?: Date,                         // "2026-11-02T03:00:00.000Z"  (coerce; vencimento; vazio = à vista)
  "settledAt"?: Date,                       // "2026-11-02T03:00:00.000Z"  (coerce; quando pagou/recebeu de fato)

  "status": "pending" | "settled" | "cancelled",  // "settled"
  "statusSource"?: "auto" | "manual",       // "auto"  (vazio = auto; manual trava a liquidação automática)

  "account": {                              // Extended Reference → financial_accounts
    "_id": string,                          // "6650a1f0c2e4b1a9d0f1a011"
    "name": string,                         // "Nubank PJ"
    "type": "bank" | "cash" | "digitalWallet" | "platform"  // "bank"
  },
  "category": {                             // Extended Reference → financial_categories
    "_id": string,                          // "6650a1f0c2e4b1a9d0f1a020"
    "name": string,                         // "CMV/Insumos"
    "type": "revenue" | "expense"           // "expense"  (tem que bater com direction)
  },
  "subcategory"?: {                         // Extended Reference → categories.subcategories
    "_id": string,                          // "6650a1f0c2e4b1a9d0f1a021"
    "name": string                          // "Chocolate"
  },
  "channel"?: "dineIn" | "delivery" | "shared",  // "shared"  (vazio = relatórios usam o canal efetivo)

  "items"?: [                               // pratos vendidos (máx. 30); Extended Reference → menu_items
    {
      "menuItemId": string,                 // "6650a1f0c2e4b1a9d0f1a090"
      "name": string,                       // "Brigadeiro gourmet"  (cópia do cardápio no dia)
      "qty": number,                        // 12  (inteiro 1–99)
      "unitPrice": number                   // 4.50  (≥ 0; cópia do preço no dia)
    }
  ],

  "paymentMethod": "cash" | "pix" | "debit" | "credit" | "transfer" | "boleto" | "digitalWallet",  // "boleto"
  "counterparty"?: {
    "name": string,                         // "Callebaut Brasil"
    "kind": "client" | "supplier",          // "supplier"
    "refId"?: string                        // "6650a1f0c2e4b1a9d0f1a070"
  },
  "fiscalNote"?: string,                    // "05/10"
  "description"?: string,                   // "Cobertura meio amargo 10kg"  (máx. 500)
  "origin": "manual" | "sefaz",             // "manual"

  "history": HistoryEntry[] = [],           // [{ "at": "2026-11-04T19:47:00.000Z", "by": "6650...a002", "action": "created" }]
  "audit": Audit                            // { "createdAt": "...", "updatedAt": "...", "createdBy": "6650...a002" }
}
```

> Para ler a data em que o dinheiro realmente se moveu: `settledAt ?? dueDate ?? date`.
>
> **O request não tem o mesmo formato do documento.** O `POST /financial-movements` (`registerMovementSchema`) recebe `accountId`, `categoryId`, `subcategoryId` e `items: [{ menuItemId, qty }]`, e não os snapshots. Ele também aceita `confirmDuplicate`. O servidor monta as referências (nome e preço dos pratos vêm do cardápio) e calcula `feeValue`, `netValue` e `dueDate` dentro da transação.

---

## `movement_imports`

Só existe na API. Guarda a chave de idempotência de cada importação de planilha (`POST /financial-movements/import`, até 500 linhas). A importação é **tudo ou nada**: se qualquer linha falha, nada é gravado e a chave é apagada, então só ficam aqui importações em andamento ou concluídas. Reenviar a chave de uma importação concluída devolve o resultado guardado, sem gravar de novo. Tem índice único em `{ restaurantId, key }` e TTL de **30 dias** sobre `createdAt`.

```jsonc
{
  "_id": ObjectId,                          // "6650a1f0c2e4b1a9d0f1a0a0"
  "restaurantId": string,                   // "6650a1f0c2e4b1a9d0f1a003"
  "key": string,                            // "sha256:3f1c9e…"  (idempotencyKey enviada pelo front; 8–128 caracteres)
  "status": "processing" | "done",          // "done"
  "createdAt": Date,                        // "2026-11-10T14:00:00.000Z"
  "result"?: {                              // ImportMovementsResult (presente quando status = "done")
    "replayed": boolean,                    // false
    "total": number,                        // 120
    "created": number,                      // 120
    "failed": number,                       // 0  (importação gravada = todas as linhas criadas)
    "results": [
      {
        "row": number,                      // 7  (linha da planilha; 1 = primeira linha de dados)
        "status": "created" | "failed",     // "created"
        "movement"?: FinancialMovement,     // { ...documento de financial_movements }
        "error"?: { "code": string, "message": string }  // só na resposta de importação desfeita: { "code": "DUPLICATE", "message": "Possível duplicata…" }
      }
    ]
  }
}
```

---

## `menu_items`

Pratos do cardápio. O preço deve ser revisado a cada ~6 meses; o sistema avisa depois de **167 dias** sem revisão.

```jsonc
{
  "_id": ObjectId,                 // "6650a1f0c2e4b1a9d0f1a090"
  "restaurantId": string,          // "6650a1f0c2e4b1a9d0f1a003"
  "name": string,                  // "Brigadeiro gourmet"  (máx. 80)
  "category"?: string,             // "Doces"  (grupo livre do cardápio; máx. 40)
  "price": number,                 // 4.50  (≥ 0; alterado por PATCH /menu-items/:id/price)
  "cost": number = 0,              // 1.80  (≥ 0; ingredientes + embalagem; base da margem)
  "soldPerMonth": number = 0,      // 300  (inteiro ≥ 0; informado pelo dono; base da popularidade)
  "status": RecordStatus,          // "active"
  "priceUpdatedAt": Date,          // "2026-05-01T12:00:00.000Z"  (coerce; última vez que o VALOR mudou)
  "priceReviewedAt": Date,         // "2026-10-20T12:00:00.000Z"  (coerce; última revisão: mudou OU decidiu manter)
  "audit": Audit                   // { "createdAt": "...", "updatedAt": "..." }
}
```

---

## `payments`

Só existe na API. Um documento por pagamento da assinatura (pagamento único ou cada cobrança da renovação automática).

```jsonc
{
  "_id": ObjectId,                          // "6650a1f0c2e4b1a9d0f1a080"
  "restaurantId": string,                   // "6650a1f0c2e4b1a9d0f1a003"
  "userId"?: string,                        // "6650a1f0c2e4b1a9d0f1a002"  (quem iniciou o checkout)
  "provider": "mock" | "mercadopago",       // "mercadopago"
  "tier"?: "basic" | "pro",                 // "pro"  (ausente = basic; pagamentos antigos)
  "months": 1 | 3 | 6 | 12,                 // 3  (plano: 30, 90, 180 ou 360 dias)
  "amountCents": number,                    // 65522  (inteiro, centavos; Pro 3 meses = R$ 655,22 com 5% off)
  "kind"?: "one_time" | "recurring",        // "recurring"  (ausente = one_time)
  "preapprovalId"?: string,                 // "2c9380848f…"  (id da renovação automática no provedor)
  "status": "pending" | "approved" | "rejected" | "cancelled" | "refunded",  // "approved"
  "providerPaymentId"?: string,             // "1325467890"  (id no provedor; único; chega pelo webhook)
  "mockDecision"?: "approved" | "rejected", // "approved"  (só no provedor simulado)
  "createdAt": Date,                        // "2026-11-04T19:45:00.000Z"
  "updatedAt": Date,                        // "2026-11-04T19:47:00.000Z"
  "appliedAt"?: Date,                       // "2026-11-04T19:47:00.000Z"  (já somado à assinatura; impede somar 2x)
  "grantedMs"?: number,                     // 7776000000  (tempo que este pagamento deu à assinatura; o estorno desconta isso)
  "supersededAt"?: Date,                    // "2026-12-10T09:00:00.000Z"  (uma compra posterior recomeçou a contagem)
  "revokedAt"?: Date                        // "2026-12-15T09:00:00.000Z"  (estorno/chargeback já descontado)
}
```

---

## `ai_usage`

Só existe na API. Contador de chamadas à IA por restaurante e por dia; o limite é **20 chamadas/dia** e textos servidos do cache não contam. Tem TTL sobre `expireAt` (3 dias depois do dia).

```jsonc
{
  "_id": string,                   // "6650a1f0c2e4b1a9d0f1a003:2026-11-12"  (restaurantId:dia)
  "restaurantId": string,          // "6650a1f0c2e4b1a9d0f1a003"
  "day": string,                   // "2026-11-12"
  "count": number,                 // 7  (chamadas gastas no dia; volta 1 quando a IA falha)
  "updatedAt": Date,               // "2026-11-12T15:30:00.000Z"
  "expireAt": Date                 // "2026-11-15T15:30:00.000Z"  (TTL)
}
```

---

## `ai_cache`

Só existe na API. Guarda o texto que a IA já gerou para os mesmos dados no mesmo dia, para não gastar outra chamada. Tem TTL sobre `expireAt` (2 dias).

```jsonc
{
  "_id": string,                   // "6650a1f0c2e4b1a9d0f1a003:insights-overview:2026-11-12:9b2e…"  (restaurantId:kind:dia:hash dos dados)
  "restaurantId": string,          // "6650a1f0c2e4b1a9d0f1a003"
  "kind": string,                  // "insights-overview" | "price-suggestion"
  "payload": object | object[],   // [{ "index": 0, "kind": "cmvHigh", "title": "…", "description": "…" }]
  "createdAt": Date,               // "2026-11-12T15:30:00.000Z"
  "expireAt": Date                 // "2026-11-14T15:30:00.000Z"  (TTL)
}
```

> `payload` é o texto devolvido pela IA: a lista de `AiInsightText` nos cards de insight, ou `{ suggestedPrice, increasePercent, reason }` na sugestão de preço (aumento de no máximo 20%).

---

## `audit_logs`

Só existe na API, sem schema Sapphire. Tem TTL de 365 dias sobre `createdAt`.

```jsonc
{
  "_id": ObjectId,                 // "6650a1f0c2e4b1a9d0f1a040"
  "event": AuditEvent,             // "login"  (lista abaixo)
  "userId": string,                // "6650a1f0c2e4b1a9d0f1a002"
  "restaurantId"?: string,         // "6650a1f0c2e4b1a9d0f1a003"
  "data": object,                  // { "ip": "189.0.0.1", "userAgent": "Mozilla/5.0…" }  (livre; padrão {})
  "createdAt": Date                // "2026-11-12T11:02:00.000Z"
}
```

`AuditEvent`:
- **cadastro:** `account_created`, `restaurant_created`, `terms_accepted`, `onboarding_completed`
- **sessão:** `login`, `login_failed`, `logout`, `account_temporarily_blocked`
- **senha:** `password_recovery_requested`, `password_reset`, `password_changed`, `password_confirmation_failed`
- **conta:** `account_updated`, `email_changed`, `avatar_updated`, `avatar_removed`
- **funcionários:** `member_created`, `member_updated`, `members_deactivated_by_plan`
- **exclusão:** `deletion_requested` (o `reason` informado fica em `data`), `deletion_cancelled`

---

## `password_reset_tokens`

Só existe na API. Tem TTL sobre `expiresAt`.

```jsonc
{
  "_id": ObjectId,                 // "6650a1f0c2e4b1a9d0f1a050"
  "token": string,                 // "9f86d081884c7d65…"  (sha256; o token original nunca é gravado)
  "userId": string,                // "6650a1f0c2e4b1a9d0f1a002"
  "expiresAt": Date,               // "2026-11-12T12:02:00.000Z"  (precisa ser BSON Date p/ o TTL)
  "usedAt"?: string | null,        // null  ou "2026-11-12T11:10:00.000Z"  (uso único)
  "createdAt": string              // "2026-11-12T11:02:00.000Z"  (ISO string)
}
```

---

## `valkyrie_signing_keys`

Criada pela biblioteca **valkyrie-jwt**: são as chaves HMAC que assinam os JWT. Na Mintly o `tenantId` é sempre `"mintly"`, e o isolamento entre ambientes vem do banco do `env`.

```jsonc
{
  "_id": string,                   // "mintly:vk_3b9f0c…"  (tenantId:keyId)
  "tenantId": string,              // "mintly"
  "keyId": string,                 // "vk_3b9f0c2a7e…"  (vai no header `kid` do JWT)
  "algorithm": string,             // "HS256"
  "keyMaterial": string,           // "q8Zp…=="  (64 bytes aleatórios em base64 — SEGREDO)
  "createdAt": Date,               // "2026-06-08T12:00:00.000Z"
  "retiresAt": Date | null,        // null  (quando a chave deixa de assinar)
  "isActive": boolean              // true  (rotacionar desativa as anteriores)
}
```

---

## `valkyrie_refresh_tokens`

Criada pela **valkyrie-jwt**. Um documento por refresh token emitido; tokens da mesma sessão formam uma família (rotação).

```jsonc
{
  "_id": string,                          // "rt_8c1d…"  (= refreshTokenId)
  "refreshTokenId": string,               // "rt_8c1d…"
  "familyId": string,                     // "fam_42ab…"  (sessão; reuso de token revoga a família inteira)
  "tenantId": string,                     // "mintly"
  "subject": string,                      // "6650a1f0c2e4b1a9d0f1a002"  (userId)
  "tokenHash": string,                    // "e3b0c442…"  (hash do refresh token; o token original não é gravado)
  "fingerprintHash": string | null,       // "a1b2…"  (vínculo com o cliente, quando usado)
  "createdAt": Date,                      // "2026-11-12T11:02:00.000Z"
  "expiresAt": Date,                      // "2026-11-19T11:02:00.000Z"  (7 dias)
  "audiences": string[],                  // []
  "roles": string[],                      // []
  "permissions": string[],                // []
  "claims": object,                       // { "name": "Maria Souza", "email": "maria@…", "restaurantId": "6650…a003", "role": "owner", "status": "active" }
  "claimsJson": string,                   // "{\"name\":\"Maria Souza\",…}"  (mesmas claims serializadas)
  "consumedAt": Date | null,              // null  (quando foi trocado por um novo no /auth/refresh)
  "replacedByRefreshTokenId": string | null,  // null  ou "rt_9d2e…"
  "revokedAt": Date | null,               // null  (logout, troca de senha ou reuso detectado)
  "revocationReason": string | null       // null  ou "logout"
}
```

---

## `valkyrie_audit_events`

Criada pela **valkyrie-jwt**: trilha técnica de tokens. É diferente de `audit_logs`, que guarda eventos de negócio da Mintly.

```jsonc
{
  "_id": ObjectId,                 // "6650a1f0c2e4b1a9d0f1a0b0"
  "name": string,                  // "token.issued" | "token.validated" | "token.rejected" | "key.rotated"
  "tenantId": string | null,       // "mintly"
  "subject": string | null,        // "6650a1f0c2e4b1a9d0f1a002"  (userId)
  "tokenId": string | null,        // "jti_51fa…"
  "occurredAt": Date,              // "2026-11-12T11:02:00.000Z"
  "data": object                   // { "reason": "expired" }  (valores string | null)
}
```

---

## `valid_environments`

Fica no banco global **`app`**, por isso não aparece no banco `staging`. É a lista de valores permitidos no header `env`. A API guarda essa lista em cache.

```jsonc
{
  "_id": ObjectId,                 // "6650a1f0c2e4b1a9d0f1a060"
  "name": string                   // "staging"  (populado por `npm run db:seed-envs`)
}
```

---

## `tax_settings`

Também fica no banco global **`app`**. Guarda o valor do DAS mensal do MEI, que muda todo ano e por isso não fica no código. O cálculo usa o documento com o maior `validFrom` até o mês consultado.

```jsonc
{
  "_id": ObjectId,                 // "6650a1f0c2e4b1a9d0f1a061"
  "validFrom": string,             // "2026-01"  (AAAA-MM; comparado como texto)
  "meiMonthlyDas": number,         // 82.05  (populado por `MEI_MONTHLY_DAS=82.05 VALID_FROM=2026-01 npm run db:seed-tax-settings`)
  "updatedAt": Date                // "2026-01-05T12:00:00.000Z"
}
```

