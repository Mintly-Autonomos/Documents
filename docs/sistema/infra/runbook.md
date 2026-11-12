# 📟 Runbook — operação do Mintly

Procedimentos do dia a dia e o que fazer quando algo dá errado. Os comandos de banco assumem `mongosh` conectado ao cluster, no banco do ambiente (`use staging`).

> Antes de mexer em **production**, faça o mesmo em **staging** e confira.

Ver também: [Infraestrutura](./infraestrutura.md) · [Migrações e seeds](../base-de-dados/migracoes-e-backfills.md) · [Processo de release](../guias/processo-de-release.md).

---

## Procedimentos de rotina

### Deploy

| O quê | Como |
|---|---|
| API em staging | GitHub → MintlyApi → Actions → **MintlyApi Deploy** → `environment=staging`, marcar `confirm_deploy` → aprovar. Roda testes, `db:indices` e publica na Vercel |
| API em production | o mesmo com `environment=production` (código da `main`, AWS EC2) |
| Web | GitHub → MintlyWeb → Actions → **deploy.yml**, escolhendo a branch no "Use workflow from"; `staging` → Vercel, `production` → S3 + CloudFront |
| Lib | automático no merge (`staging` → `preview`, `main` → `latest`); manual pelo `deploy.yml` da lib com `dist_tag` |

Depois do deploy da API: `GET <API_URL>/health` deve responder `{"status":"ok"}`.

### Variável de ambiente nova

1. Cadastre em GitHub → Settings → Secrets/Variables do repositório (segredo em **Secrets**, valor público em **Variables**).
2. Se for obrigatória, inclua no `REQUIRED` do `deploy.yml` (o deploy passa a falhar sem ela).
3. Rode o deploy: ele sincroniza as variáveis com a Vercel. Não edite variáveis direto no painel da Vercel — o próximo deploy sobrescreve.

### Liquidação manual dos repasses

O `settle.yml` roda todo dia às 06:00 UTC (só staging no agendamento). Para rodar agora: Actions → **Settle Due Movements** → escolher o ambiente. É idempotente.

### Começo de ano: DAS do MEI

O valor do DAS muda todo ano. Sem ele, o DRE de restaurantes MEI sai com imposto 0.

```bash
MEI_MONTHLY_DAS=<valor> VALID_FROM=<AAAA>-01 MONGO_ENV=<env> npm run db:seed-tax-settings
```

(grava no banco `app`, vale para todos os ambientes)

### Webhook do Mercado Pago

- **Pagamento único:** a API manda a URL do aviso em cada cobrança (`{API_URL}/webhooks/mercadopago?env=<env>`). Só precisa de `API_URL` correto no deploy.
- **Renovação automática:** os avisos chegam no webhook cadastrado no **painel do Mercado Pago** (Suas integrações → Webhooks): URL `{API_URL}/webhooks/mercadopago`, tópicos `payment`, `subscription_preapproval` e `subscription_authorized_payment`. Copie a "assinatura secreta" para `MP_WEBHOOK_SECRET`.

### Liberar acesso a um restaurante

| Caso | Como |
|---|---|
| teste rápido (1 dia) | `POST /admin/subscription-gift` com header `x-admin-key: <ADMIN_API_KEY>`, `env` e corpo `{ "email": "<dono>" }` |
| liberação por prazo | `db.restaurants.updateOne({ _id: ObjectId("<id>") }, { $set: { "subscription.endsAt": ISODate("2027-01-01"), "subscription.tier": "pro" } })` |

### Novo ambiente na allowlist

`APP_VALID_ENVS=staging,production,<novo> npm run db:seed-envs`. A API guarda a lista em cache por **1 minuto**. Depois, rode `db:indices` no banco novo.

---

## Problemas e respostas

### Ninguém consegue acessar (400 `APP-0004`)

O `env` enviado não está em `app.valid_environments`. Confira a lista (`use app; db.valid_environments.find()`), corrija com `db:seed-envs` e espere até 1 minuto pelo cache.

### O front perdeu a API (erro de CORS no navegador)

A origem do front não está em `CORS_ORIGINS`. A API responde normalmente, mas o navegador bloqueia. Inclua a origem completa (com `https://` e sem barra no fim) nos Secrets e faça o deploy. Lembre: a staging roda com `NODE_ENV=production`, então `localhost` não é liberado automaticamente.

### Tudo responde 402 `SUBSCRIPTION-0001`

A assinatura do restaurante venceu ou não existe: `db.restaurants.findOne({ _id: ObjectId("<id>") }, { subscription: 1 })`. Se a pessoa pagou e não liberou, veja o próximo item.

### Pagou e a assinatura não liberou

1. Ache o pagamento: `db.payments.find({ restaurantId: "<id>" }).sort({ createdAt: -1 }).limit(3)`.
2. `status: pending` e sem `providerPaymentId` → o aviso **não chegou**. Causas comuns: `API_URL` ausente no deploy (a URL do aviso vira `localhost` — aparece no log da cobrança), webhook do painel errado (renovação automática), ou a API estava fora do ar. Reenvie o aviso pelo painel do Mercado Pago.
3. Aviso chegou e foi recusado com 401 → `MP_WEBHOOK_SECRET` diferente da assinatura secreta do painel.
4. Log "valor do provedor (…) difere do cobrado (…). Nada foi concedido." → o valor pago não bate com o cobrado; não libere à mão sem conferir no Mercado Pago.
5. Para liberar enquanto investiga: gravar `subscription.endsAt` (procedimento acima).

### E-mail de recuperação não chega

Em produção sem `GMAIL_USER`/`GMAIL_APP_PASSWORD` a API **falha** ao enviar (de propósito, para não "fingir" que enviou). Confira as variáveis e se a senha de app do Gmail ainda é válida. A resposta da rota é sempre 202, então o erro só aparece no log. Confira também o `FRONTEND_URL`: é ele que monta o link do e-mail.

### Usuário bloqueado por tentativas (429 `AUTH-0004`)

O bloqueio expira sozinho (`BLOCK_DURATION_MINUTES`, padrão 15). Para liberar antes:

```js
db.users.updateOne({ email: "<email>" }, { $set: { loginAttempts: 0, blockedUntil: null } })
```

### Derrubar todas as sessões de um usuário

Equivalente ao que a troca de senha faz:

```js
db.valkyrie_refresh_tokens.updateMany({ subject: "<userId>", revokedAt: null }, { $set: { revokedAt: new Date(), revocationReason: "manual" } })
```

O access token ainda vale por até 15 minutos.

### IA responde 503 (`AI-0002`)

A chave do provedor escolhido não está configurada ou o provedor falhou. O motivo vai para o log da API. O app continua com os textos padrão; não há impacto além da IA. Se o problema é limite de uso do provedor, trocar `AI_PROVIDER` (claude ↔ gemini) e fazer deploy resolve.

### Saldo de uma conta não bate com as movimentações

`POST /financial-movements/recompute-balances` com `{ accountId }` recalcula os dois saldos a partir das movimentações. Antes, confira se a diferença não vem de repasses pendentes que deveriam ter sido liquidados (rode a liquidação).

### Repasses de plataforma não estão saindo de "a receber"

1. Confira se o `settle.yml` rodou (Actions). O agendamento só dispara a partir da **branch default** do repositório.
2. Movimentos com `statusSource: "manual"` nunca são liquidados pelo robô (alguém mudou o status à mão).
3. Movimentos antigos sem `dueDate` precisam do `db:backfill-due-date`.

### E2E falhando com 400 `APP-0004`

O `global-setup` do E2E registra `e2e` na allowlist e remove ao final. Se uma execução foi interrompida, `e2e` pode ter ficado ou sumido no meio. Rode a suite de novo; se persistir, confira `app.valid_environments`.

---

## Pedido de exclusão de restaurante

O dono pede pelo app. Isso só marca `restaurants.deletionRequestedAt` — nada é apagado automaticamente. Para encontrar pedidos pendentes:

```js
db.restaurants.find({ deletionRequestedAt: { $ne: null, $exists: true } }, { name: 1, deletionRequestedAt: 1 })
```

O motivo informado fica em `audit_logs` (evento `deletion_requested`). A exclusão em si ainda é manual e não tem procedimento definido — ver [Segurança e LGPD](../guias/seguranca-e-lgpd.md#o-que-a-política-promete-e-o-que-o-sistema-faz).
