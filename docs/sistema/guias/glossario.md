# 📖 Glossário

Termos de negócio e técnicos usados no Mintly. A coluna **No código** mostra o nome usado na API, na lib e no banco (o código é em inglês; a interface, em português).

---

## Finanças do restaurante

| Termo | Significado | No código |
|---|---|---|
| **Movimentação / lançamento** | qualquer entrada ou saída de dinheiro registrada | `financial_movements`, `FinancialMovement` |
| **Entrada / saída** | dinheiro que entra (venda) ou sai (compra, despesa) | `direction: 'in' \| 'out'` |
| **Valor bruto / taxa / líquido** | o valor da venda, o que a plataforma desconta e o que sobra | `grossValue`, `feeValue`, `netValue` |
| **Conta financeira** | onde o dinheiro está: caixa, banco, carteira digital ou plataforma | `financial_accounts`, `type: cash \| bank \| digitalWallet \| platform` |
| **Conta plataforma** | conta de um app de delivery (iFood, Keeta, 99…), que cobra taxa e repassa depois | `type: 'platform'` |
| **Repasse** | quando a plataforma transfere o dinheiro das vendas para o restaurante | `settlementRule` (regra), `dueDate` (data) |
| **Taxa de plataforma** | percentual que a plataforma desconta de cada venda | `feePercent`, `feeValue` |
| **Vencimento** | dia em que o dinheiro deve entrar ou sair (repasse, boleto, fiado) | `dueDate` |
| **Liquidação** | o momento em que o dinheiro de fato entra ou sai | `status: 'settled'`, `settledAt` |
| **Pendente / liquidado / cancelado** | ainda não mexeu no caixa / já mexeu / não vale mais | `pending` / `settled` / `cancelled` |
| **Saldo disponível** | dinheiro que já está na conta | `availableBalance` |
| **Saldo previsto** | o que ainda vai entrar menos o que ainda vai sair | `predictedBalance` |
| **Categoria** | classificação do lançamento (Venda Balcão, Aluguel…) | `financial_categories` |
| **Subcategoria / subitem** | detalhe dentro da categoria (CMV/Insumos → Frango) | `subcategories[]` |
| **Despesa fixa / variável / mista** | não muda com a venda (aluguel) / muda (insumos) / parte de cada (energia) | `behavior: fixed \| variable \| mixed` |
| **Operacional / não operacional** | ligada à operação do negócio / fora dela | `operationalNature` |
| **Canal** | onde a venda ou despesa acontece: salão, delivery ou da casa inteira | `channel: dineIn \| delivery \| shared` |
| **Canal efetivo** | o canal informado ou, sem ele, o deduzido pela regra (plataforma → delivery…) | `effectiveChannel()` |
| **Contraparte** | cliente ou fornecedor do lançamento | `counterparty` |
| **Nota fiscal** | número da nota informado no lançamento | `fiscalNote` |

## Relatórios

| Termo | Significado | No código |
|---|---|---|
| **Competência** | conta o lançamento pela data em que aconteceu, mesmo que o dinheiro mexa depois (DRE, Custos) | `date` |
| **Caixa** | conta pela data em que o dinheiro mexeu (Fluxo de Caixa) | `settledAt ?? dueDate ?? date` |
| **DRE** (Demonstração do Resultado) | receita − impostos − CMV − despesas operacionais = lucro | `GET /reports/result` |
| **Receita bruta / líquida** | total vendido / depois dos impostos | `grossRevenue` / `netRevenue` |
| **CMV** (Custo da Mercadoria Vendida) | custo dos ingredientes e insumos; alvo de 28–35% da receita | `dreGroup: 'cmv'` |
| **Mão de obra** | salários e pró-labore | `dreGroup: 'labor'` |
| **Prime cost** | CMV + mão de obra; alvo de até 65% da receita | `primeCost` |
| **Despesas operacionais (opex)** | demais despesas da operação | `dreGroup: 'opex'`, `operatingExpenses` |
| **Margem bruta / líquida** | receita líquida − CMV / lucro ÷ receita bruta | `grossMargin` / `netMargin` |
| **Ponto de equilíbrio** | receita bruta que paga os custos fixos | `breakEvenRevenue` |
| **Margem de contribuição** | quanto de cada real vendido sobra depois dos custos variáveis | `contributionMarginPct` |
| **Fôlego** | quantos dias o caixa de hoje cobre, na saída média diária | `runwayDays` |
| **Margem de segurança** | 7 dias de saída média; abaixo disso o dia é "crítico" | `safetyThreshold`, `criticalDay` |
| **Nota de saúde financeira** | nota de 0 a 100 combinando margem, fôlego, prime cost e tendência da receita | `health.score` |
| **Anomalia ("Fique de olho")** | gasto bem acima da média dos últimos meses | `anomalies[]` |
| **Mês atual × mês fechado** | no mês em andamento a comparação usa os mesmos dias dos meses anteriores | `comparison.kind: 'samePeriod'` |

## Impostos

| Termo | Significado | No código |
|---|---|---|
| **MEI** | Microempreendedor Individual: paga um valor fixo por mês, com teto anual de R$ 81 mil | `taxRegime: 'mei'` |
| **DAS** | guia mensal de imposto do MEI e do Simples | `meiMonthlyDas`, `app.tax_settings` |
| **Simples Nacional — Anexo I** | regime do comércio com alíquota por faixa de faturamento | `taxRegime: 'simplesNacionalAnexoI'` |
| **RBT12** | receita bruta dos 12 meses anteriores; define a faixa do Simples | `rbt12` |
| **Alíquota efetiva** | `(RBT12 × nominal − dedução) ÷ RBT12` — o percentual que de fato incide | `effectiveRate` |

## Cardápio

| Termo | Significado | No código |
|---|---|---|
| **Prato** | item do cardápio, com preço e custo | `menu_items`, `MenuItem` |
| **Revisão de preço** | mudar o preço ou decidir mantê-lo; o app avisa depois de 167 dias sem revisão | `priceReviewedAt`, `price-alerts` |
| **Vendidos no mês** | unidades vendidas nos últimos 30 dias, somadas das vendas que informaram pratos | `soldPerMonth` / `items[]` |
| **Análise de cardápio** (menu engineering) | classifica os pratos por popularidade × margem em Melhores, Populares, Promissores e Fracos | `cardapio.builder.ts` |

## Assinatura

| Termo | Significado | No código |
|---|---|---|
| **Tipo de plano** | Básico ou Pro | `tier: basic \| pro` |
| **Plano / duração** | 1, 3, 6 ou 12 meses (30, 90, 180 ou 360 dias) | `months`, `plan` |
| **Renovação automática** | cobrança recorrente no mesmo cartão a cada ciclo | `subscription.recurring`, `preapprovalId` |
| **Estorno / chargeback** | pagamento devolvido; desconta da assinatura os dias que ele tinha dado | `refunded`, `revokedAt` |
| **Simulador** | provedor de pagamento falso, que aprova ou recusa numa tela do app | `PAYMENT_PROVIDER=mock` |

## Fontes externas (Workers)

| Termo | Significado |
|---|---|
| **CEASA / CEAGESP** | centrais de abastecimento de hortifruti no atacado (CEAGESP = São Paulo) |
| **PROHORT** | programa da CONAB que publica preços e volumes negociados nas CEASAs |
| **SIDRA / IPCA** | sistema de dados do IBGE / índice oficial de inflação, com subgrupos de alimentos |

---

## Termos técnicos

| Termo | Significado |
|---|---|
| **Tenant** | o "dono" isolado dos dados — no Mintly, o restaurante (`restaurantId`) |
| **`env` / ambiente** | header que escolhe o banco (`staging`, `production`, `e2e`) |
| **Allowlist** | lista de valores aceitos; a de ambientes fica em `app.valid_environments`, a de origens do front em `CORS_ORIGINS` |
| **`RequestContext`** | objeto `{ env, userId, restaurantId }` passado da rota até o banco |
| **Layered Simplified** | a arquitetura em camadas da API ([ADR-001](../decisoes/adr-001-layered-simplified.md)) |
| **Use-case / query** | classe com uma regra de negócio que escreve / que só lê e calcula |
| **Extended Reference** | referência por id + cópia dos campos mostrados junto (ex.: nome da conta no lançamento) |
| **Computed Pattern** | guardar no documento um valor já calculado (ex.: saldo na conta) |
| **União discriminada** | schema que muda conforme um campo (ex.: conta `platform` exige taxa) |
| **Backfill** | script que preenche um campo novo em documentos antigos |
| **Idempotente** | rodar duas vezes dá o mesmo resultado que rodar uma |
| **TTL** | índice que faz o Mongo apagar o documento depois de um prazo |
| **Replica set** | modo do MongoDB com réplicas; necessário para transações |
| **`Decimal128`** | tipo numérico decimal exato do MongoDB, usado para dinheiro |
| **Settler** | o robô de liquidação automática (`db:settle`) |
| **Webhook** | chamada que um serviço externo faz para a API para avisar de um evento (pagamento) |
| **Access / refresh token** | credencial curta usada em cada request / credencial longa que gera um novo access token |
| **dist-tag** | etiqueta de versão no npm (`latest`, `preview`) |
| **Sapphire** | biblioteca de schemas e validação usada pela mintly-lib |
| **valkyrie-jwt** | biblioteca de sessão (JWT) usada pela API |
| **ADR** | registro de uma decisão de arquitetura ([Decisões](../decisoes/README.md)) |

Ver também: [Relatórios e métricas](../api/relatorios-e-metricas.md) · [Perfil tributário](../api/perfil-tributario.md) · [Atributos das coleções](../base-de-dados/colecoes-atributos.md).
