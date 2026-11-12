# ADR-009 — Liquidação automática por script agendado, não por rota

**Status:** aceita (julho/2026, problema P1)

## Contexto

Entradas em conta de plataforma (iFood, Keeta…) nascem `pending` e ficam em "a receber". Nada as movia para "disponível" quando o repasse vencia: o saldo disponível subestimava o caixa real indefinidamente (~R$ 34 mil presos no seed de staging em julho/2026).

## Decisão

- **Liquidação automática por data:** vencido o repasse, o movimento vira `settled` e o dinheiro passa para `availableBalance`. Só **entrada em conta `platform`** — boleto vencido não foi necessariamente pago.
- **Reversão pelo dono com trava:** se o repasse não caiu, o dono volta o status; `statusSource: 'manual'` faz o robô nunca mais tocar naquele movimento.
- **Gatilho:** `npm run db:settle`, um script que fala direto com o banco, agendado 1x/dia no GitHub Actions (`settle.yml`). O use-case é puro (recebe só o `env`).
- **Ambiente ⇄ branch:** cada ambiente é liquidado com o código da branch que o deploya.

## Alternativas consideradas

- **Rota HTTP chamada por um cron:** exigiria um segundo mecanismo de autenticação (segredo compartilhado) ou um "usuário de sistema" — este último obrigaria a tornar `restaurantId` opcional no usuário e criar um papel `system`, afrouxando a invariante mais importante da API: **todo token tem dono**.
- **Liquidar na leitura** (tratar como disponível o que já venceu, sem gravar): sem job, mas o saldo gravado ficaria errado e todas as leituras precisariam repetir a regra.
- **Só manual:** é o que existia, e ninguém fazia.

## Consequências

- ✅ Nenhuma superfície de ataque nova; o mesmo caminho do `db:indices` no deploy.
- ✅ Idempotente e uma transação por movimento (um documento ruim não derruba a rodada).
- ✅ Portável: virar Lambda ou rota depois é trocar o adaptador.
- ⚠️ É a única operação que roda **sem `restaurantId`** (cross-tenant); as escritas continuam filtradas pelo tenant de cada documento.
- ⚠️ O GitHub só dispara `schedule` a partir da branch default.

Ver: [Movimentações → Liquidação automática](../api/movimento.md#liquidação-automática-settleyml--npm-run-dbsettle).
