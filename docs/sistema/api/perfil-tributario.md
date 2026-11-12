# 🧾 MintlyApi — perfil tributário

O Mintly calcula o imposto do restaurante a partir da **receita lançada** e do **regime tributário** configurado. O resultado alimenta a linha "Impostos" do [DRE](./relatorios-e-metricas.md#resultado-dre) e o `GET /restaurants/me`, que mostra a faixa, a alíquota e os alertas.

Código: `src/app/tax/` — `tax-rules.ts` (regras puras), `tax-profile.query.ts` (consulta), `tax-repository.ts` (receita por mês), `tax-settings-repository.ts` (DAS do MEI). Tipos: `restaurant-tax.ts` na [mintly-lib](../libs/mintly-lib.md).

> O Mintly **estima** o imposto para a gestão; não emite guia nem substitui o contador.

---

## Regimes suportados

`restaurants.taxRegime` (alterado por `PATCH /restaurants/me`):

| Regime | Como o imposto é calculado |
|---|---|
| `mei` | **DAS fixo** por mês, que não varia com a venda. O valor vigente vem de `app.tax_settings` |
| `simplesNacionalAnexoI` | **alíquota efetiva** (Anexo I — Comércio) × receita bruta do mês |
| *(não configurado)* | imposto 0 no DRE + alerta `taxRegimeNotConfigured` |

---

## Receita usada: RBT12

A **RBT12** é a receita bruta dos **12 meses civis anteriores** ao mês de referência (LC 123):

- Receita = Σ `grossValue` das **entradas não canceladas**, agrupada por mês civil em São Paulo. **Pendentes contam** — faturamento é competência.
- **Menos de 12 meses de histórico** (`rbt12Proportional: true`):
  - no 1º mês de atividade → receita do próprio mês × 12;
  - de 1 a 11 meses → média dos meses anteriores × 12.
- O "início da atividade" é o mês do primeiro lançamento não cancelado (qualquer direção).

Uma consulta de receita de M−13 até M serve a RBT12 do mês, a do mês anterior (para detectar troca de faixa) e o acumulado do ano (teto do MEI).

---

## Simples Nacional — Anexo I

| Faixa | RBT12 até | Alíquota nominal | Parcela a deduzir |
|---|---|---|---|
| 1 | R$ 180.000 | 4,0% | — |
| 2 | R$ 360.000 | 7,3% | R$ 5.940 |
| 3 | R$ 720.000 | 9,5% | R$ 13.860 |
| 4 | R$ 1.800.000 | 10,7% | R$ 22.500 |
| 5 | R$ 3.600.000 | 14,3% | R$ 87.300 |
| 6 | R$ 4.800.000 | 19,0% | R$ 378.000 |

**Alíquota efetiva** = `(RBT12 × nominal − dedução) ÷ RBT12`. Com RBT12 = 0 (sem venda), vale a nominal da faixa 1. Acima de R$ 4,8 milhões o cálculo usa a faixa 6 e emite `simplesLimitExceeded` (a empresa sairia do Simples).

O imposto do mês no DRE é `receita bruta do mês × alíquota efetiva`, arredondado em centavos.

---

## MEI

- **DAS mensal:** `app.tax_settings` guarda um documento por vigência (`validFrom: 'AAAA-MM'`, `meiMonthlyDas`). Vale o de maior `validFrom` até o mês consultado. O valor muda todo ano e **nunca fica no código**: `MEI_MONTHLY_DAS=82.05 VALID_FROM=2026-01 npm run db:seed-tax-settings`.
- O DAS só entra no DRE a partir do mês do primeiro lançamento.
- **Teto anual:** R$ 81.000. No **ano de início** é proporcional: R$ 6.750 × meses do início da atividade até dezembro. O uso do teto (`meiCap.usedPct`) é a receita de janeiro até o mês ÷ teto.

---

## Alertas (`insights`)

| Alerta | Quando |
|---|---|
| `bracketChanged` | a faixa do Simples deste mês é diferente da do mês anterior (traz as duas faixas, as alíquotas e a RBT12) |
| `meiCapNear` | MEI usou **80% ou mais** do teto do ano |
| `simplesLimitExceeded` | RBT12 acima de R$ 4,8 milhões |
| `taxRegimeNotConfigured` | restaurante sem regime |

Os alertas são **determinísticos** e calculados na leitura; não há notificação gravada.

---

## Resposta de `GET /restaurants/me?month=AAAA-MM`

`{ restaurant, tax }`, com `tax: RestaurantTaxProfile`:

| Campo | Conteúdo |
|---|---|
| `regime` | o regime ou `null` |
| `referenceMonth` | mês consultado (padrão: o corrente) |
| `rbt12`, `monthsOfHistory`, `rbt12Proportional` | a RBT12 e como ela foi calculada |
| `effectiveRate`, `bracket`, `previousBracketIndex` | Simples: alíquota (fração) e faixa |
| `meiMonthlyDas`, `meiCap` | MEI: DAS vigente e uso do teto |
| `insights` | os alertas acima |

Taxas são **frações** (`0.06728` = 6,728%).

---

## Limites conhecidos

- **Só o Anexo I** (comércio). Restaurantes enquadrados em outro anexo, Lucro Presumido ou Real não são calculados.
- A receita vem dos **lançamentos**, não de notas fiscais: o que o dono não lançar não entra na RBT12.
- Mudança de regime vale para todos os meses: o DRE de meses passados é recalculado com o regime atual.

Ver também: [Relatórios e métricas](./relatorios-e-metricas.md) · [Migrações e seeds](../base-de-dados/migracoes-e-backfills.md#seeds-de-dados).
