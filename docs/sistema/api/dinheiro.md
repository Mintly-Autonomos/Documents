# 💰 MintlyApi — modelo de dinheiro

Dinheiro em software é onde float mata. O Mintly usa **duas representações** e nunca deixa float chegar perto de um total.

![Modelo de dinheiro](/files/diagrams/dinheiro.svg)

---

## Duas representações

| Onde | Tipo | Por quê |
|---|---|---|
| **Domínio** (use-cases, regras) | `number` | ergonomia — cálculos e respostas são number |
| **Persistência** (MongoDB) | `Decimal128` | dinheiro exato; `$inc` faz aritmética decimal no servidor |

A conversão acontece **na borda do repository** (`core/money/money.ts`):

```ts
toCents(v)         // v * 100 arredondado a 4 casas → inteiro (sem drift de float)
toDecimal128(v)    // number → Decimal128, passando por centavos inteiros
decimalToNumber(d) // Decimal128 (ou string/number do banco) → number, na leitura
```

> **`toCents` e o centavo perdido:** `Math.round(v * 100)` sozinho erra em bordas (`0.615 * 100 = 61.4999…` → 61). A correção arredonda a 4 casas antes: `round(Number((v*100).toFixed(4)))` → 62. Ver o baixo B1.

---

## Fee e net — em centavos inteiros

O cálculo de taxa/líquido (`computeFeeNet`, `movement-rules.ts`) roda **em centavos inteiros**, e só então vira `Decimal128`. Regras:

- **Taxa só se aplica a ENTRADA em conta `platform`** (receber via iFood/Rappi desconta a taxa). Saída ou conta não-platform: `feeValue = 0`, `netValue = grossValue`.
- "Platform" tem **uma fonte de verdade**: `isPlatformAccount(account)` (`type === 'platform'`). O schema (união discriminada) garante que só contas platform têm `feePercent`/`settlementDays` (M7).

---

## Saldo — dois buckets

O saldo de uma conta vive em **dois campos** `Decimal128`:

| Bucket | Significado |
|---|---|
| `availableBalance` | disponível — já caiu |
| `predictedBalance` | a receber — vai cair (prazo de liquidação) |

O `BalanceImpact` (bucket + delta) decide o efeito de uma movimentação:

| status | bucket | direção → delta |
|---|---|---|
| `settled` | `availableBalance` | `in → +netValue` · `out → −grossValue` |
| `pending` | `predictedBalance` | `in → +netValue` · `out → −grossValue` |
| `cancelled` | — (nenhum) | sem impacto |

Entrada credita o **líquido** (`netValue`); saída debita o **bruto** (`grossValue`).

---

## Aplicando o impacto — `applyBalanceImpact`

Dentro da transação, o saldo muda via `$inc` Decimal128 **escopado por `restaurantId`**:

```ts
accounts.updateOne(
  { _id: accountId, restaurantId },                              // nunca toca conta de outro tenant
  { $inc: { [bucket]: toDecimal128(delta * sign) },
    $set: { 'audit.updatedAt': now } },
  { session },
)
// matchedCount === 0 → NotFoundError  (conta sumiu → falha alto, sem drift silencioso)
```

- **register** aplica o impacto (`sign +1`).
- **update** reverte o efeito antigo (`−1`) na conta antiga e aplica o novo (`+1`) na conta nova — retroativo se resolve sozinho.
- **changeStatus** reverte o bucket do status antigo e aplica o do novo (ex.: `pending → settled` move de `predicted` para `available`).
- **recompute-balances** recalcula o saldo de uma conta a partir das movimentações (reconciliação).

Tudo dentro de `session.withTransaction(...)`: a movimentação e o ajuste de saldo commitam **juntos ou nada**.

---

## Limite conhecido (futuro)

> ⚠️ **Liquidação por data não existe** (C3 / P1). Um movimento `pending` de conta platform **não migra** automaticamente para `settled` quando o `predictedReceiptDate` vence — fica preso em `predictedBalance`. Falta um settler por data (ou é reconciliação manual, a decidir). Registrado em `PROBLEMAS-FUTUROS.md`.

Ver também: [Mapa de domínio](./mapa-de-dominio.md) · [Arquitetura](./arquitetura.md).
