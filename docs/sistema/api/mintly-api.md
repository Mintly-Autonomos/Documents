# ⚙️ MintlyApi — visão geral & referência de rotas

**Repo:** `Mintly-Autonomos/MintlyApi` · **Stack:** Node 24 · Fastify 5 · MongoDB (Atlas) · [`mintly-lib`](../libs/mintly-lib.md) · `valkyrie-jwt` · Sapphire (validação) · vitest · Mercado Pago (assinatura) · Claude/Gemini (IA).

Swagger vivo em `/documentation` (só **fora de produção**).

> **Documentação profunda:** [Arquitetura](./arquitetura.md) · [Mapa de domínio](./mapa-de-dominio.md) · [Multi-tenant](../base-de-dados/multi-tenant.md) · [Modelo de dinheiro](./dinheiro.md) · [Movimentações](./movimento.md) · [Auth & sessão](./auth.md) · [CRUD genérico](./crud-generico.md) · [Coleções & índices](../base-de-dados/colecoes.md) · [Atributos das coleções](../base-de-dados/colecoes-atributos.md) · [Erros & validação](./erros.md) · [Assinatura e pagamentos](./assinatura-e-pagamentos.md) · [Relatórios e métricas](./relatorios-e-metricas.md) · [Perfil tributário](./perfil-tributario.md) · [IA](./ia.md) · [Cardápio](./cardapio.md).

---

## Em uma tela

- **Layered Simplified**: `route → controller → use-case → repository → MongoDB`, com `RequestContext { env, userId?, restaurantId? }` atravessando tudo.
- **Multi-tenant híbrido**: `env` (header, validado na allowlist) escolhe o **banco**; `restaurantId` (do JWT) escopa os **documentos**.
- **Sessão**: JWT criptografado (valkyrie-jwt), access 15 min + refresh 7 dias com rotação; o refresh reconsulta o usuário.
- **Assinatura obrigatória**: as rotas do app exigem assinatura válida (`402 SUBSCRIPTION-0001` sem ela). A IA exige o plano **Pro**.
- **Dinheiro**: `number` no domínio, `Decimal128` na persistência; saldo em 2 buckets via `$inc` na transação; liquidação automática diária dos repasses de plataforma.

---

## Envelope de resposta

Sucesso: `{ "payload": …, "pagination"? : { page, size, totalItems, totalPages } }`
Erro: `{ "code": "AUTH-0001", "message": "…" }` (glossário completo em [Erros](./erros.md)).

---

## Rotas

Headers: `env` (**obrigatório**, roteamento + allowlist) · `Authorization: Bearer <accessToken>` nas protegidas.

Legenda de acesso:
- 🌐 **pública**
- 🔒 **login** (JWT)
- 💳 **login + assinatura válida**
- ⭐ **login + assinatura + plano Pro**

### Sistema

| Rota | Acesso | Descrição |
|---|---|---|
| `GET /health` | 🌐 | health check → `{status:"ok"}` |
| `GET /documentation` | 🌐 | Swagger UI (não-produção) |

### Auth (`/auth`)

| Rota | Acesso | Descrição | Respostas |
|---|---|---|---|
| `POST /signup` | 🌐 | pessoa + restaurante + usuário + conta "Caixa" + 6 categorias **em transação** (aceita foto de perfil) | 201 · 409 · 400 |
| `POST /login` | 🌐 | autentica; registra IP/UA/`lastAccessAt`; devolve o estado da assinatura | 200 · 401 · 403 · 429 |
| `POST /refresh` | 🌐 | rotaciona o par; reconsulta o usuário | 200 · 401 |
| `POST /logout` | 🔒 | revoga o refresh e audita | 204 · 401 |
| `POST /forgot-password` | 🌐 | dispara recuperação — **202 sempre** (Gmail; console em dev) | 202 · 400 |
| `POST /reset-password` | 🌐 | redefine com token de uso único (1h) e derruba todas as sessões | 200 · 401 · 400 |

### Assinatura (`/subscription`) 🔒 — fora do portão de assinatura

| Rota | Descrição |
|---|---|
| `GET /` | estado (`active`/`expired`/`none`, `daysLeft`, `tier`) + tipos e planos à venda + renovação automática |
| `POST /checkout` | cria o pagamento (`months` 1/3/6/12, `tier` basic/pro, `autoRenew`) e devolve o `checkoutUrl` do provedor |
| `POST /cancel-renewal` | cancela a renovação automática (o acesso vale até `endsAt`) |
| `POST /mock/decide` · `POST /mock/charge-next` | só com `PAYMENT_PROVIDER=mock`: aprova/recusa o pagamento simulado e simula a próxima cobrança recorrente |

### Webhooks e administração 🌐 (protegidos por segredo, não por JWT)

| Rota | Descrição |
|---|---|
| `POST /webhooks/mercadopago?env=<ambiente>` | aviso do Mercado Pago; valida a assinatura (`MP_WEBHOOK_SECRET`) e **reconsulta** o pagamento no provedor antes de somar dias |
| `POST /admin/subscription-gift` | presente de 1 dia de assinatura; exige header `x-admin-key` = `ADMIN_API_KEY` (sem a chave configurada, 404) |

### Conta de quem está logado (`/users`) 🔒 — fora do portão de assinatura

| Rota | Descrição |
|---|---|
| `GET /me` | nome, e-mail, telefone, papel e foto |
| `PATCH /me` | edita nome e telefone |
| `PATCH /me/email` | troca o e-mail (exige a senha atual) |
| `POST /me/password` | troca a senha (exige a atual) e derruba todas as sessões |

### Restaurante (`/restaurants`)

| Rota | Acesso | Descrição |
|---|---|---|
| `POST /me/deletion-request` · `DELETE /me/deletion-request` | 🔒 | dono pede (com senha e motivo opcional) ou cancela a exclusão do restaurante |
| `GET /me` (`?month=AAAA-MM`) | 💳 | restaurante + perfil tributário do mês (RBT12, faixa, alíquota efetiva, alertas) |
| `PATCH /me` | 💳 | edita nome e regime tributário (`mei` · `simplesNacionalAnexoI`) |
| `POST /me/first-access` | 💳 | conclui o onboarding (`firstAccessAt`) |
| `GET /me/members` · `POST /me/members` · `PATCH /me/members/:id` | 💳 | funcionários (papel `member`): listar, criar, ativar/inativar, trocar senha. Limite de ativos: 5 no Básico, 20 no Pro |

### People (`/people`) 💳 — CRUD genérico + foto de perfil

| Rota | Descrição |
|---|---|
| `POST /` · `GET /` · `GET /:id` · `PATCH /:id` · `DELETE /:id` | CRUD genérico (escopado por restaurante) |
| `GET /avatar/:username` | foto pelo e-mail; outro restaurante ou inexistente responde "sem foto" |
| `PUT /me/avatar` · `DELETE /me/avatar` | troca/remove a foto do usuário logado (data URL jpeg/png/webp, até 1 MB) |

### Financial accounts (`/financial-accounts`) 💳

| Rota | Descrição |
|---|---|
| `POST /` | cria conta (saldo=0 e isDefault=false forçados pelo servidor); `platform` exige taxa + regra de repasse |
| `GET /` | lista (busca por `name`, paginação) |
| `PATCH /:id` | edita nome, status, taxa e regra de repasse (`type` é imutável) |
| `PATCH /:id/default` | define como conta padrão (transação) |
| `PATCH /:id/inactivate` | inativa (guards: saldo, conta padrão) |

### Financial categories (`/financial-categories`) 💳

| Rota | Descrição |
|---|---|
| `POST /` · `GET /` · `PATCH /:id` | CRUD (status não muda pelo PATCH; despesa sem `dreGroup` recebe `opex`) |
| `GET /suggestions` | sugestão por direção do movimento (recência + frequência) |
| `PATCH /:id/inactivate` · `/:id/reactivate` | muda status (auditado no `history[]`) |
| `POST /:id/subcategories` · `PATCH /:id/subcategories/:subId` | cria/renomeia subcategoria |
| `PATCH /:id/subcategories/:subId/inactivate` · `/reactivate` | subcategoria só é inativada, nunca apagada |

### Cardápio (`/menu-items`) 💳

| Rota | Descrição |
|---|---|
| `POST /` · `GET /` · `PATCH /:id` | CRUD do prato (nome, grupo, custo, vendidos/mês) |
| `PATCH /:id/price` | muda o preço (atualiza `priceUpdatedAt` e `priceReviewedAt`) |
| `POST /:id/price-review` | "manter o preço": conta como revisão sem mudar o valor |
| `GET /price-alerts` | pratos sem revisão de preço há 167 dias ou mais |
| `PATCH /:id/inactivate` · `/:id/reactivate` | muda status |

### Financial movements (`/financial-movements`) 💳

| Rota | Descrição |
|---|---|
| `POST /` | registra entrada/saída (+ pratos vendidos) e ajusta o saldo (transação) |
| `POST /import` | importa até 500 linhas de planilha; idempotente por `idempotencyKey`; resultado por linha |
| `GET /` | lista (busca textual, filtros direction/status/período, paginação) |
| `PATCH /:id` | edita (reverte + aplica saldo; mantém a taxa congelada) |
| `PATCH /:id/status` | muda status manualmente (trava a liquidação automática) |
| `POST /recompute-balances` | reconcilia o saldo de uma conta |

### Relatórios e painel 💳

| Rota | Descrição |
|---|---|
| `GET /reports/cash-flow?horizon=30` | Fluxo de Caixa: saldo dia a dia, a receber/a pagar, vencidos |
| `GET /reports/result?month=AAAA-MM` | Resultado (DRE): receita, CMV, mão de obra, impostos (pela alíquota), despesas operacionais |
| `GET /reports/expenses?month=AAAA-MM&channel=` | Custos & Despesas por grupo/categoria/subcategoria, com filtro de canal (`dineIn`/`delivery`) |
| `GET /dashboard/overview?month=AAAA-MM` | Visão Geral: cards do mês, comparação, projeção e insights |

### IA (`/ai`) ⭐

| Rota | Descrição | Respostas |
|---|---|---|
| `GET /usage` | uso do dia (limite 20/restaurante) | 200 |
| `POST /insights` | reescreve os textos dos cards de insight (`page: overview`, `month`) | 200 · 429 (limite) · 503 (sem provedor) |
| `POST /price-suggestion` | sugere aumento de preço de um prato (até 20%) | 200 · 429 · 503 |

---

## Variáveis de ambiente

| Var | Default | Uso |
|---|---|---|
| `MONGODB_HOSTS` / `MONGODB_USER` / `MONGODB_PASSWORD` / `MONGODB_REPLICA_SET` / `MONGODB_AUTH_SOURCE` / `MONGODB_TLS` | — | conexão Atlas **sem SRV** (a API monta a URI) |
| `MONGODB_URI` | — | alternativa: string completa, tem precedência (usada nos testes) |
| `MONGODB_MAX_POOL_SIZE` | `5` | pool (baixo p/ serverless) |
| `PORT` | `3000` | porta HTTP |
| `NODE_ENV` | — | `production` desliga Swagger, exige e-mail, `CORS_ORIGINS` e `PAYMENT_PROVIDER` |
| `API_URL` | `http://localhost:3000` | URL pública (Swagger, CSP, retorno do webhook) |
| `CORS_ORIGINS` | — | allowlist CSV de origens do front. Fora de produção, localhost é liberado |
| `JWT_ISSUER` / `JWT_ACCESS_LIFETIME_SECONDS` / `JWT_REFRESH_LIFETIME_SECONDS` | `mintly` / `900` / `604800` | sessão |
| `MAX_LOGIN_ATTEMPTS` / `BLOCK_DURATION_MINUTES` | `5` / `15` | lockout |
| `RECOVERY_TOKEN_EXPIRY_HOURS` | `1` | validade do token de reset |
| `GMAIL_USER` / `GMAIL_APP_PASSWORD` | — | SMTP do Gmail (App Password). Sem eles: console em dev, **erro em produção** |
| `EMAIL_FROM` / `FRONTEND_URL` | `Mintly <…>` / `http://localhost:4200` | e-mail de recuperação |
| `PAYMENT_PROVIDER` | `mock` (só fora de produção) | `mock` (simulador) ou `mercadopago` |
| `MP_ACCESS_TOKEN` / `MP_WEBHOOK_SECRET` / `MP_SANDBOX` | — | Mercado Pago |
| `ADMIN_API_KEY` | — | habilita `POST /admin/subscription-gift` |
| `AI_PROVIDER` | `claude` | `claude` ou `gemini` |
| `ANTHROPIC_API_KEY` / `ANTHROPIC_BASE_URL` / `ANTHROPIC_MODEL` | — / oficial / `claude-haiku-5-5` | IA via Claude |
| `GEMINI_API_KEY` / `GEMINI_BASE_URL` / `GEMINI_MODEL` / `GEMINI_THINKING_LEVEL` | — / oficial / `gemini-3.5-flash-lite` / — | IA via Gemini |

Sem a chave do provedor de IA escolhido, as rotas `/ai` respondem **503** e o app segue com os textos padrão.

---

## Scripts e ferramentas

- `npm run dev` · `build` · `start` · `typecheck` · `lint` · `validate:swagger`
- `npm test` · `test:unit` · `test:int` · `test:cov` / `test:ci` (**threshold 90%** nas 4 métricas) · `test:e2e` (local, contra Atlas)
- `npm run db:indices` — cria/garante índices no banco do env (`MONGO_ENV`).
- `npm run db:seed-envs` — insere `staging`/`production` em `app.valid_environments` (ativa a allowlist; lista via `APP_VALID_ENVS`).
- `npm run db:settle` — liquidação automática dos repasses vencidos (roda todo dia pelo workflow `settle.yml`).
- `npm run db:seed-tax-settings` — grava o DAS do MEI vigente em `app.tax_settings` (`MEI_MONTHLY_DAS`, `VALID_FROM=AAAA-MM`).
- `npm run db:seed-demo` — popula um restaurante de demonstração (`SEED_RESTAURANT_ID`, `SEED_SCENARIO`).
- `npm run db:backfill-due-date` · `db:backfill-dre-group` — migrações de dados pontuais dos módulos novos.
- `insomnia/MintlyApi.insomnia_v4.json` — collection Insomnia com as rotas.

---

## Testes

Pirâmide vitest: **unit** (`*.spec.ts`, mocks) → **integration** (`*.int.spec.ts`, Fastify `inject` + `mongodb-memory-server` em replica set, por causa das transações) → **E2E** local. 114 arquivos de teste (39 de integração), cobertura mínima de 90%. TDD é a regra — ver [convenções](../guias/convencoes.md).

---

## Limites conhecidos

- **Produção ainda não está no ar:** o pipeline de AWS EC2 existe, mas `production` não está na allowlist nem no agendamento da liquidação. Ver [Infraestrutura](../infra/infraestrutura.md).
- **Agendamento só na branch default:** o `cron` do `settle.yml` só dispara a partir da branch default do GitHub; até lá a liquidação roda por `workflow_dispatch`.
- **`VALIDATION_ERROR` × `APP-0005`:** erros de schema (Fastify/Sapphire) saem como `VALIDATION_ERROR`; regras de domínio usam `ValidationError` (`APP-0005`). O front precisa tratar os dois.
