# ADR-005 — Dinheiro em `Decimal128`, contas em centavos

**Status:** aceita (junho/2026, nas movimentações)

## Contexto

Ponto flutuante não representa centavos com exatidão (`0.1 + 0.2 ≠ 0.3`). Num saldo acumulado por `$inc` ao longo de milhares de lançamentos, o erro se soma.

## Decisão

- **No banco:** valores de saldo e de movimentação são `Decimal128`; o `$inc` faz a soma decimal no servidor.
- **No domínio e no contrato:** `number`, por ergonomia (o front e os cálculos usam número comum).
- **Na conversão e nos cálculos:** tudo passa por **centavos inteiros** (`toCents`, arredondando a 4 casas antes para não perder o centavo em casos como `0.615 × 100`).
- O schema da lib declara `number`; o `Decimal128` é aplicado pela API na persistência.

## Alternativas consideradas

- **`number` também no banco:** mais simples, mas acumula erro de ponto flutuante no saldo.
- **Inteiros em centavos em todo lugar** (inclusive no contrato): exato, mas espalha a conversão por front, relatórios e formulários, e quebra a leitura humana do dado no banco.
- **Validar `decimal` pelo sapphire-bson:** o adaptador não suporta `decimal` (mapeia para `number`), então a conversão ficou na API.

## Consequências

- ✅ Saldo exato, mesmo com `$inc` concorrente.
- ✅ Contrato simples para o front.
- ⚠️ Toda leitura e escrita de dinheiro precisa passar pelas funções de `core/money/money.ts`; esquecer a conversão grava `number` no banco.
- ℹ️ Preço de assinatura usa inteiro em centavos (`amountCents`), porque não entra em saldo e vem de tabela fixa.

Ver: [Modelo de dinheiro](../api/dinheiro.md).
