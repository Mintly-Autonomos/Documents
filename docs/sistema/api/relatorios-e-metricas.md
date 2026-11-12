# 📊 MintlyApi — relatórios e métricas

Os quatro relatórios do Mintly são **somente leitura**: leem as movimentações e calculam tudo na hora, sem tabela de agregados. Este documento explica **de onde sai cada número**. Os tipos completos das respostas estão em `MintlyLib/src/core/data/reports/*.ts`.

| Tela | Rota | Visão |
|---|---|---|
| Fluxo de Caixa | `GET /reports/cash-flow?horizon=30` | **caixa** (quando o dinheiro entra/sai) |
| Resultado (DRE) | `GET /reports/result?month=AAAA-MM` | **competência** (data do lançamento) |
| Custos & Despesas | `GET /reports/expenses?month=AAAA-MM&channel=dineIn\|delivery` | competência |
| Visão Geral | `GET /dashboard/overview?month=AAAA-MM` | composição dos três acima |

Código: `src/app/reports/{cash-flow,result,expenses}/` e `src/app/dashboard/`. Cada relatório tem `*.query.ts` (busca), `*-metrics.ts` (cálculo puro, testado sem banco) e `*-scenario.ts` (dados de cenário para teste e `db:seed-demo`).

---

## Convenções de todos os relatórios

| Assunto | Regra |
|---|---|
| Dinheiro | número em reais, 2 casas; somas feitas em **centavos inteiros** |
| Percentuais | **fração** (`0.36` = 36%). Exceção: `deltaPoints` da Visão Geral, em pontos percentuais |
| Variações (`delta*`) | `(atual − base) / base`; base 0 → `null` |
| Fuso | **America/Sao_Paulo** para "hoje", dias e meses (`reports/shared/period.ts`) |
| Mês | `?month=AAAA-MM`, padrão o corrente; formato inválido ou mês futuro → 400 `APP-0005` |
| Canceladas | nunca entram |
| Textos | o back manda **dados estruturados** (`insights` com `kind` e números); a frase é do front (ou da [IA](./ia.md)) |
| Sem lançamentos | tudo 200, zeros e listas vazias, sem `NaN` |

### Peças compartilhadas (`reports/shared/`)

- **Data de caixa** (`cash-date.ts`): `settledAt ?? dueDate ?? date`.
- **Canal efetivo** (`channel.ts`): o canal informado vence; sem ele, entrada em conta plataforma → `delivery`, outra entrada → `dineIn`, saída → `shared` (da casa inteira).
- **Mês atual × mês fechado** (`until-day.ts`):

| | Mês fechado | Mês atual (hoje = dia D) |
|---|---|---|
| Valor exibido | mês cheio | dia 1 até o fim do mês, **já lançado** (inclui o agendado para depois de hoje) |
| Base de comparação | meses cheios | **mesmos dias 1..D** dos meses anteriores, e o atual cortado em hoje — `comparison = { kind: 'samePeriod', untilDay: D }` |
| Histórico | meses cheios | meses cheios (o atual parcial é o último ponto) |
| Projeção | `null` | variável: linear (`até hoje × dias do mês ÷ dias decorridos` + agendado); fixo/misto: `max(valor do mês, média dos meses cheios desde o 1º gasto)` |

---

## Fluxo de Caixa

Pergunta respondida: **quanto vou ter em caixa nos próximos N dias?** `horizon` de 1 a 365 (padrão 30).

| Número | Cálculo |
|---|---|
| `cashToday` | Σ `availableBalance` das contas ativas |
| `receivable` / `payable` | Σ entradas (líquido) / saídas (bruto) **pendentes** com vencimento até o fim do horizonte — **vencidas incluídas** |
| `projectedBalance` | `cashToday + receivable − payable` (= último ponto da projeção) |
| `projection[]` | saldo no **fim** de cada dia, de hoje até hoje + horizonte. O 1º ponto já inclui o que vence hoje |
| `realized[]` | 7 dias antes de hoje, **reconstruídos de trás para frente** a partir do saldo de hoje (não existe histórico de saldo gravado) |
| `lowestBalance` | menor ponto da projeção |
| `safetyThreshold` | margem de segurança = **7 dias de saída média**; saída média = média diária dos últimos 90 dias (desde o 1º lançamento) |
| insight `criticalDay` | primeiro dia em que a projeção fica abaixo da margem de segurança |
| `weeks[]` | blocos de 7 dias da projeção (o último pode ser menor: horizonte 30 = 31 dias = 7,7,7,7,3) |
| `dueItems[]` | o que tem vencimento: pendentes (com `overdue` se venceu antes de hoje) e liquidados dos últimos 7 dias |

**Repasses de plataforma agrupados:** entradas em conta `platform` viram **um item por conta × data de repasse × status** (`kind: 'platformPayout'`, título "Repasse <conta>", `itemCount` = nº de pedidos), em vez de uma linha por pedido. Venda à vista não entra na lista de vencimentos.

---

## Resultado (DRE)

Pergunta respondida: **quanto sobrou no mês?** Competência; a classificação vem do `dreGroup` **atual** da categoria (reclassificar muda meses passados).

```
Receita bruta              Σ entradas (bruto)
− Impostos                 pela alíquota/DAS (não pelos lançamentos)  ← ver Perfil tributário
= Receita líquida
− CMV                      despesas com dreGroup = cmv
= Margem bruta
− Despesas operacionais    labor + opex + taxa de plataforma
= Lucro líquido            netMargin = lucro ÷ receita bruta
```

- **Impostos:** Simples → alíquota efetiva × receita bruta; MEI → DAS fixo do mês (só a partir do mês do 1º lançamento); sem regime → 0 e insight `taxRegimeNotConfigured`. Despesas lançadas com `dreGroup = tax` (o DAS pago) **saem** do DRE para não contar o imposto duas vezes. Ver [Perfil tributário](./perfil-tributario.md).
- **Taxa de plataforma:** `feeValue` das entradas em conta `platform`, numa linha só ("Taxa de plataforma").
- **`operatingExpenseItems`:** composição das despesas operacionais por categoria, maior primeiro (categoria zerada no mês e no anterior não aparece).
- **Ponto de equilíbrio:**
  - custos fixos = despesas `fixed` + `mixed` (misto conta como fixo); variáveis = o resto;
  - margem de contribuição = `(receita líquida − variáveis) ÷ receita líquida`;
  - `breakEvenRevenue` = receita **bruta** que paga os fixos;
  - `reachedOnDay` = dia do mês em que a receita acumulada passou o equilíbrio (só depois de atingido).
- **Insights:** `profitChanged` (lucro subiu/caiu vs. base), `largestOpexItem`, `taxRegimeNotConfigured`.
- `history`: 6 meses cheios (receita, lucro, margem).

---

## Custos & Despesas

Pergunta respondida: **onde está indo o dinheiro e o que saiu do normal?** Competência; entram **todas as saídas** (inclusive o DAS lançado) + a taxa de plataforma.

| Número | Cálculo |
|---|---|
| `total` | Σ saídas + taxas; com `deltaPrevious` e `deltaAverage3` (média de M−1..M−3, desde o 1º lançamento) |
| `cmv.pctOfRevenue` | CMV ÷ receita bruta; **alvo 28–35%** |
| `primeCost` | CMV + mão de obra (`labor`) ÷ receita bruta; **alvo ≤ 65%** |
| `platformFee` | Σ taxas; `pctOfDelivery` = taxa ÷ receita bruta das **contas de plataforma** |
| `byBehavior` | total por `fixed` / `variable` / `mixed` |
| `items[]` | uma linha por categoria e **uma por conta de plataforma** ("Taxa iFood"), maior primeiro, com `subitems[]` por subcategoria ("Sem subitem" por último) e `history` de 6 meses |
| `projection` | só no mês atual (regra da tabela acima) |

**Filtro de canal:** `channel=dineIn|delivery` filtra pelo canal efetivo. Despesas `shared` (da casa) ficam de fora e somam em `sharedExcluded`. `channel=shared` → 400. Enquanto o dono não marca canal nas saídas, o filtro "Salão" mostra quase nada (o rateio é pendência de negócio).

### Anomalia ("Fique de olho")

Avaliada por **subitem** (categoria sem subitens é avaliada inteira; taxa de plataforma nunca). Dispara quando **todas** valem:

| Regra | Valor |
|---|---|
| meses de base desde o 1º gasto daquela unidade | ≥ 2 |
| média dos 3 meses anteriores | > 0 |
| excedente (`valor − média`) | ≥ R$ 100 |
| excedente ÷ média | ≥ 50% |
| no mês atual | só a partir do dia 7, contra a média do mesmo período |

Os números vêm em `anomalyRule`, para o front explicar o critério.

---

## Visão Geral

Composição: **DRE + Custos do mês consultado + Fluxo de Caixa de 30 dias a partir de hoje**. Cada número tem a mesma fonte da tela de origem (`OverviewQuery` chama `ResultQuery`, `ExpensesQuery` e `CashFlowQuery`).

- **Cards:** lucro, receita, caixa hoje, projeção de 30 dias + **fôlego** (`runwayDays` = `floor(caixa de hoje ÷ saída média diária)`; média 0 → `null`; caixa ≤ 0 → 0), CMV e prime cost (com `deltaPoints`).
- **`revenueVsExpense`:** 6 meses; o mês atual aparece duas vezes (real e `projected: true`). "Despesa" aqui = todas as saídas.
- **`profitWaterfall`:** a cascata do DRE do mês.
- **Insights:** no máximo 4, ordenados `warning → positive → info`: `cashTight`, `cmvAboveTarget` (`impact` = excesso sobre o teto do alvo), `primeCostAboveTarget`, `expenseAnomaly` (a primeira de Custos), `breakEvenReached`, `taxRegimeNotConfigured`.

### Nota de saúde financeira (0–100)

Quatro pilares, cada um com nota linear entre duas pontas (limitada a 0–100), combinados pela média ponderada:

| Pilar | Peso | Nota 0 | Nota 100 |
|---|---|---|---|
| `netMargin` (margem líquida) | 0,30 | ≤ 0% | ≥ 10% |
| `runway` (fôlego, dias) | 0,30 | 0 | ≥ 45 |
| `primeCost` | 0,25 | ≥ 85% | ≤ 65% |
| `revenueTrend` (receita × média dos 3 meses anteriores com receita) | 0,15 | ≤ −20% | ≥ 0% |

- Pilar sem dado sai e os pesos se redistribuem; **menos de 2 pilares → `score: null`** (`noData`).
- Faixas: < 40 `risk` · < 70 `attention` · ≥ 70 `healthy`.
- **Base (`basisMonth`):** no mês atual, margem, prime cost e tendência usam o **último mês fechado** (o mês pela metade não derruba a nota) e o fôlego é o de hoje. Em mês passado, usa o próprio mês **sem** fôlego (não existe o caixa daquela época), e a nota não muda com o tempo.
- Os insights de CMV/prime cost usam a mesma base; os cards mostram o mês consultado. Os dois podem diferir.

> Os pesos, pontas e a regra de anomalia são **palpites de negócio** (pendências N4/N5) — calibrar com dados reais.

---

## Três sentidos de "despesa"

| Onde | O que soma |
|---|---|
| Custos (`total`) e Visão Geral (`expense`) | **todas as saídas**: CMV, pessoal, opex, DAS lançado, taxas |
| DRE (`operatingExpenses`) | pessoal + opex + taxa de plataforma (sem CMV, sem DAS lançado) |
| Imposto do DRE (`taxes`) | calculado pela alíquota/DAS, não pelos lançamentos |

---

## Limites conhecidos

- **Receitas e Previsões** dependem de um domínio de vendas que ainda não existe (pendências N1/N2); as telas da Web usam montagem própria no front (`receitas.builder.ts`, `previsoes.builder.ts`).
- Sem histórico de saldo gravado, a série realizada do Fluxo de Caixa é reconstruída e cobre só 7 dias.
- Tudo é calculado a cada request; com volume grande de movimentos, o caminho é materializar agregados mensais.

Ver também: [Movimentações](./movimento.md) · [Perfil tributário](./perfil-tributario.md) · [IA](./ia.md) · [Modelo de dinheiro](./dinheiro.md).
