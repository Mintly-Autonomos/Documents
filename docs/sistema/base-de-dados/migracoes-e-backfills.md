# 🔁 Base de dados — migrações e backfills

O Mongo não tem `ALTER TABLE`: documentos antigos continuam com o formato de quando foram gravados. Este documento mostra **como o Mintly evolui o modelo sem quebrar o que já está no banco**, e quais scripts existem para isso.

Ver também: [Modelagem NoSQL](./modelagem-nosql.md) · [Coleções & índices](./colecoes.md) · [Infraestrutura](../infra/infraestrutura.md).

---

## Estratégia: campo novo é opcional e "ausente" tem significado

A regra do projeto é **não exigir migração para o sistema continuar funcionando**. Todo campo novo entra como **opcional**, e o código define o que a ausência significa — sempre o comportamento de antes do campo existir.

| Campo | Ausente significa | Por quê |
|---|---|---|
| `financial_movements.statusSource` | `auto` | o backlog anterior ao campo liquida na primeira rodada do settler (o filtro `$ne: 'manual'` casa com ausente) |
| `financial_movements.settledAt` | leitura cai em `dueDate ?? date` | inventar uma data mudaria o passado dos relatórios |
| `financial_movements.channel` | canal efetivo (plataforma → delivery; outra entrada → salão; saída → compartilhado) | lançamentos antigos entram nos relatórios por canal sem reprocessar |
| `financial_movements.items` | venda sem pratos informados | o ranking de mais vendidos só conta o que tem pratos |
| `financial_accounts.settlementRule` | usa o antigo `settlementDays` como "N dias após a venda" (`resolveSettlementRule`) | contas de plataforma antigas seguem calculando o repasse |
| `restaurants.firstAccessAt` | restaurante antigo, sem onboarding pendente | só os criados depois do campo (com `null`) passam pelo onboarding |
| `restaurants.subscription.tier` · `payments.tier` | Básico | quem assinou antes dos tipos de plano era Básico |
| `payments.kind` | pagamento único | a renovação automática veio depois |
| `restaurants.taxRegime` | "não configurado": imposto 0 com aviso | o dono configura quando quiser |

**Na prática:** ao adicionar um campo, (1) declare-o `.optional()` no schema da [mintly-lib](../libs/mintly-lib.md); (2) trate a ausência no código que lê, de preferência numa função pura com teste; (3) só escreva um backfill se a ausência atrapalhar uma **consulta** (um filtro de data não casa com campo ausente) ou um cálculo que não dá para fazer na leitura.

---

## Scripts de backfill

Todos ficam em `scripts/` da API, leem o banco pelo `MONGO_ENV`, são **idempotentes** (a segunda execução reporta zero) e **cross-tenant** (o tenant é campo, então uma execução cobre todos os restaurantes do ambiente).

### `db:backfill-due-date` — `predictedReceiptDate` → `dueDate`

```bash
MONGO_ENV=staging npm run db:backfill-due-date
```

1. Renomeia `predictedReceiptDate` para `dueDate` onde `dueDate` ainda não existe (`$rename`, uma operação).
2. Apaga o campo velho dos documentos que já tinham `dueDate`.
3. Remove o índice antigo `status_1_predictedReceiptDate_1`.

**Por que precisou:** o settler filtra por `dueDate`. Sem o backfill, os recebíveis gravados antes do campo nunca seriam liquidados.

### `db:backfill-dre-group` — grupo do DRE nas despesas

```bash
MONGO_ENV=staging npm run db:backfill-dre-group
```

- Categorias de despesa **de sistema** recebem o grupo pelo nome (`SYSTEM_CATEGORY_DRE_GROUPS`): CMV/Insumos → `cmv`, Salários → `labor`, Aluguel → `opex`, Impostos → `tax`.
- As demais despesas sem grupo recebem `opex` (o dono corrige depois).

**Por que precisou:** o DRE agrupa por `dreGroup`. A API já completa com `opex` ao editar, mas uma categoria nunca editada ficaria fora do relatório.

---

## Índices

Os índices são declarados em código, um arquivo por coleção em `src/infrastructure/db/indices/`, e criados por:

```bash
MONGO_ENV=staging npm run db:indices
```

- **Idempotente:** `createIndex` não faz nada quando o índice já existe; por isso roda em todo deploy e antes de toda liquidação.
- **Por banco:** cada `env` é um banco, então o comando roda por ambiente.
- **Adicionar:** edite o arquivo da coleção. **Remover:** troque a chamada por `col.dropIndex('<nome>')` no mesmo arquivo (ou num backfill, como no `db:backfill-due-date`).
- **Mudar opções de um índice existente** (ex.: tornar único, mudar a `collation`) exige apagar e recriar: `createIndex` com o mesmo nome e opções diferentes falha.

---

## Seeds de dados

| Comando | Banco | O que faz |
|---|---|---|
| `npm run db:seed-envs` | `app` | grava `staging` e `production` (ou `APP_VALID_ENVS`) em `valid_environments`, o que ativa a allowlist |
| `MEI_MONTHLY_DAS=82.05 VALID_FROM=2026-01 npm run db:seed-tax-settings` | `app` | grava o DAS do MEI vigente a partir do mês; rodar **todo começo de ano** |
| `SEED_SCENARIO=<cenário> MONGO_ENV=<env> SEED_RESTAURANT_ID=<id> npm run db:seed-demo` | do ambiente | planta dados de conferência num restaurante **recém-criado**: `cash-flow` (padrão), `tax` (13 meses cruzando de faixa) ou `result` (DRE do mês anterior). Idempotente: apaga o que plantou antes |
| `node scripts/init-replica-set.mjs` | local | inicializa o replica set `rs0` de um MongoDB local (necessário para transações) |

---

## Checklist para uma mudança de modelo

1. Campo novo **opcional** no schema da lib, com o significado da ausência escrito no comentário.
2. Leitura tolerante: função pura que trata o campo ausente + teste unitário cobrindo um documento "antigo".
3. Índice novo (se houver) no arquivo da coleção em `indices/`.
4. Backfill só se uma consulta ou cálculo depender do campo: script idempotente em `scripts/`, comando `db:<nome>` no `package.json`, uso documentado no topo do arquivo.
5. Rodar `db:indices` e o backfill em **cada** ambiente, na ordem: staging → conferir → production.
6. Atualizar [Atributos das coleções](./colecoes-atributos.md).
