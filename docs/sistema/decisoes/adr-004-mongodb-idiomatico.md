# ADR-004 — MongoDB idiomático: saldo embutido e Extended Reference

**Status:** aceita (maio/2026, na modelagem de contas e movimentações)

## Contexto

O Mintly usa MongoDB **de propósito**, como banco de documentos. Modelar com instinto relacional (tudo normalizado, saldo somado a cada leitura, joins) jogaria fora a vantagem do modelo — se fosse para normalizar tudo, a escolha seria um banco relacional.

## Decisão

Modelar pelo **padrão de leitura**: "o que é lido junto, fica junto".

- **Saldo embutido na conta** (Computed Pattern): `availableBalance` e `predictedBalance` são campos da conta, atualizados por `$inc` **na mesma transação** que grava a movimentação. Um comando de reconciliação (`recompute-balances`) recalcula a partir das movimentações.
- **Extended Reference** nas movimentações: conta, categoria, subcategoria e pratos guardam cópia dos campos exibidos (nome, tipo, preço do dia).
- Embutir só o que é **limitado** (subcategorias, assinatura, até 30 pratos por venda); o que cresce sem limite vira coleção (auditoria, pagamentos).

## Alternativas consideradas

- **Saldo derivado na leitura** (somar as movimentações a cada consulta): sempre consistente, mas o custo cresce com o histórico e toda tela que mostra saldo paga a agregação.
- **Referência pura** nas movimentações (só ids): menos duplicação, mas exige buscar conta e categoria em toda listagem e faz o histórico mudar quando a conta é renomeada.

## Consequências

- ✅ Ler o saldo é constante; listar movimentações não precisa de join.
- ✅ Histórico financeiro imutável: renomear, reajustar ou reconfigurar não reescreve meses fechados.
- ⚠️ Risco de **drift** do saldo: mitigado com transação em toda escrita e o comando de reconciliação.
- ⚠️ Dado duplicado: uma correção de nome na origem não se propaga para movimentos antigos.

Ver: [Modelagem NoSQL](../base-de-dados/modelagem-nosql.md) · [Modelo de dinheiro](../api/dinheiro.md).
