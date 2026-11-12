# ADR-010 — Relatórios calculados na leitura, com a regra separada da consulta

**Status:** aceita (setembro/2026, design dos módulos novos)

## Contexto

Os módulos Fluxo de Caixa, Resultado (DRE), Custos & Despesas e Visão Geral precisam de muitos números derivados (margens, prime cost, ponto de equilíbrio, projeção, anomalia, nota de saúde), com regras de negócio que ainda iam mudar (vários limites são palpites a calibrar).

## Decisão

- **Calcular a cada request**, a partir das movimentações — sem tabela de agregados.
- Em cada relatório, separar **consulta** (`*-repository.ts`, que devolve somas cruas) de **regra** (`*-metrics.ts`, função pura de números para números).
- **Competência** no DRE, Receitas e Custos; **caixa** no Fluxo de Caixa — os dois números divergem **por construção**.
- A API devolve **número cru** e **dados estruturados** (insights com `kind`); formatação e frases são do front (ou da IA).
- Três regras para toda agregação: filtrar por `restaurantId`, usar o fuso de São Paulo, somar em centavos.

## Alternativas consideradas

- **Agregados materializados** (totais por mês gravados): leitura mais rápida, mas cada mudança de regra exige reprocessar, e qualquer edição de lançamento precisa atualizar os agregados.
- **Calcular no front:** menos carga na API, mas espalha a regra e baixa todos os lançamentos para o navegador.

## Consequências

- ✅ Mudar uma regra é mudar uma função pura, com teste unitário rápido — o que torna viável a cobertura de 90%.
- ✅ Reclassificar uma categoria vale na hora para todos os meses.
- ⚠️ O custo cresce com o volume de lançamentos; o caminho futuro é materializar agregados mensais.
- ⚠️ Sem histórico de saldo gravado, a série realizada do Fluxo de Caixa é reconstruída e cobre só 7 dias.

Ver: [Relatórios e métricas](../api/relatorios-e-metricas.md).
