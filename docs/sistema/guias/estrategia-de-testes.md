# 🧪 Estratégia de testes

Como cada repositório do Mintly é testado, o que roda no CI e as ferramentas que tornam os testes possíveis (banco em memória, cenários, isolamento das variáveis de deploy).

---

## Visão geral

| Repo | Runner | Camadas | No CI | Cobertura mínima |
|---|---|---|---|---|
| **MintlyApi** | vitest 4 | unit · integration · E2E | unit + integration | **90%** (linhas, statements, branches, funções) |
| **MintlyWeb** | vitest (via `ng test`, builder `@angular/build:unit-test`) | unit de componentes, services e utilitários | sim | — |
| **MintlyLib** | jest 30 + ts-jest | unit dos schemas e clients | **não** | — |
| **Workers** | vitest | unit de parser, normalizer e worker (com mocks das fontes) | não há CI | — |
| **Documents** | vitest | unit das libs do site (`src/lib/`) | — | — |

**TDD é a regra** em todos: teste falhando antes da implementação, inclusive em correção de bug ([Convenções](./convencoes.md)).

---

## MintlyApi

### Pirâmide

| Camada | Arquivos | O que testa | Banco |
|---|---|---|---|
| **Unit** | `src/**/*.spec.ts` | regras puras (`*-rules.ts`, `*-metrics.ts`), use-cases com dependências mockadas, controllers | nenhum (mocks) |
| **Integration** | `src/**/*.int.spec.ts` | rotas reais via `fastify.inject()`, do hook ao Mongo | `mongodb-memory-server` |
| **E2E** | `tests/e2e/*.e2e.spec.ts` | fluxos de ponta a ponta contra o Atlas | cluster real, banco `e2e` |

O `vitest.config.ts` define dois **projetos** (`unit` e `integration`) e roda os arquivos em sequência (`fileParallelism: false`), porque os testes de integração compartilham o singleton de conexão.

```bash
npm test                # tudo, em watch
npm run test:unit       # só unit
npm run test:int        # só integração
npm run test:cov        # tudo + cobertura (o CI usa test:ci, igual)
npm run test:e2e        # E2E, só local
```

### Onde colocar a lógica para testar barato

O código é organizado para que a maior parte das regras seja testada **sem banco**:

- **Regras puras** em arquivos próprios: `movement-rules.ts`, `account-rules.ts`, `category-rules.ts`, `tax-rules.ts`, `menu-item-rules.ts`, `ai-text-rules.ts`.
- **Relatórios** separam a busca (`*.query.ts`) do cálculo (`*-metrics.ts`). O cálculo recebe dados prontos e devolve o relatório: os testes cobrem regras de mês atual, projeção, anomalia e nota de saúde com entradas pequenas.
- **Datas:** funções recebem `now`/`today` por parâmetro (ou um `clock` injetável nos use-cases), então não dependem do relógio.

### Integração: banco em memória

`tests/helpers/`:

- **`startInMemoryMongo({ replSet })`** sobe um Mongo em memória e injeta o client no singleton `MongoDBConnection`. Com `replSet: true` sobe um replica set de 1 nó — o **único modo em que transações funcionam**. Suites sem transação usam o standalone, que sobe mais rápido.
- **Limpeza** de todas as coleções no `beforeEach`, para isolar os casos.
- **`buildTestServer()`** monta o Fastify completo (hooks, rotas, error handler) pronto para `inject()`, sem conectar no Mongo.

As suites escolhem o próprio `env` (por exemplo `inttest_*`): com a allowlist vazia no banco em memória, qualquer `env` é aceito, e o banco em memória é limpo entre os casos.

### Isolamento do ambiente (`src/test-support/`)

- **`clean-payment-env.ts`** — apaga as variáveis do deploy (`PAYMENT_PROVIDER`, `MP_*`, `AI_PROVIDER`, chaves de IA…) antes dos testes. O job de deploy roda os testes com as variáveis da Vercel no ambiente; sem isso, criar uma variável no GitHub mudaria o resultado dos testes e travaria o deploy. Teste que precisa de uma delas a define explicitamente.
- **`skip-subscription-gate.ts`** — nos testes de integração que **não são** sobre assinatura, troca o portão de assinatura por um que deixa passar. O comportamento real é testado em `subscription.int.spec.ts`, que desfaz a troca (`vi.unmock`). Não existe nada parecido no código de produção.
- **IA e pagamento** são trocados por implementações falsas nos testes (`TextGenerator`, provedor `mock`).

### Cenários (`*-scenario.ts`)

Cada relatório tem um arquivo de cenário com dados de conferência (lançamentos, contas, categorias) e os valores esperados. O mesmo cenário serve aos testes de integração e ao `npm run db:seed-demo`, que planta os dados num restaurante real para conferir a tela.

### E2E

- Roda contra o **mesmo cluster do staging**, no banco `e2e` (header `env: e2e`), com o `.env.e2e` (veja `.env.e2e.example`).
- O `global-setup.ts` **registra `e2e` na allowlist** antes da suite e remove depois. Sem isso, depois do `db:seed-envs` toda a suite tomaria 400 `APP-0004`; deixar `e2e` cadastrado para sempre faria a API publicada aceitar um ambiente de teste.
- Cobre pessoas, movimentações, subcategoria/canal, imposto, Fluxo de Caixa, Resultado, Custos e Visão Geral.
- **Não roda no CI** (depende de credencial do Atlas).

---

## MintlyWeb

- `npm test` (watch) / `npm run test:ci` — vitest com jsdom pelo builder de testes do Angular. 65 specs.
- Distribuição: componentes de página (`pages/`), services (chamadas à lib, montagem de dados), utilitários de `shared/` (formatação, gráficos, mensagens de erro), guards e o tour.
- **Padrão:** lógica de verdade em service, builder (`*.builder.ts`) ou função de `shared/`, testável sem renderizar; o template fica fino. Os builders do cardápio, receitas e previsões são funções puras.
- Os services são testados com o client da lib mockado. Alguns specs (IA, sessão) alternam `environment.useMocks` para cobrir os dois caminhos.

---

## MintlyLib

- `npm test` — jest + ts-jest, 27 specs: schemas (validação de cada união discriminada, coerção de datas, schemas estritos que recusam campo extra) e clients (rota e método chamados).
- ⚠️ **O CI não roda os testes** — só lint, typecheck, build e `pack:check`. Rode `npm test` antes de abrir PR que mexa em schema.
- Para conferir um schema rapidamente, `tsx` está instalado: `npx tsx -e "…schema.safeParse(…)"`.

---

## Checklist por tipo de mudança

| Mudança | Testes esperados |
|---|---|
| Regra de negócio nova | unit da função pura + integration da rota que a usa |
| Rota nova | integration com o envelope de sucesso e os erros (400/401/404/409/402) |
| Escrita em mais de um documento | integration com `replSet: true`, incluindo o caso de falha no meio (nada gravado) |
| Campo novo no modelo | unit lendo um documento **sem** o campo (formato antigo) — ver [Migrações](../base-de-dados/migracoes-e-backfills.md) |
| Relatório | unit do `*-metrics.ts` com mês atual e mês fechado; atualizar o cenário |
| Schema da lib | spec do schema (aceita o válido, recusa o inválido) + `npm test` local |
| Tela nova | spec do componente ou do service/builder com os estados carregando/erro/vazio |
