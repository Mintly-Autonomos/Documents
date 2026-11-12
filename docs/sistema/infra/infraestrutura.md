# ☁️ Mintly — infraestrutura

Como o Mintly é buildado, testado, deployado e conectado ao banco. **O ambiente decide a nuvem**: `staging` → Vercel; `production` → AWS. Tudo roda em **Node 24**.

![Topologia de deploy](/Documents/files/diagrams/topologia-deploy.svg)

> O diagrama é de junho: não mostra a Web na AWS (S3 + CloudFront), o Mercado Pago, os provedores de IA nem a liquidação agendada.

---

## Estratégia de deploy

| Repo | Ambiente | Branch | Nuvem | Modelo | Status |
|---|---|---|---|---|---|
| **MintlyApi** | staging | `staging` | **Vercel** | serverless (`api/index.ts`) | ✅ ativo |
| **MintlyApi** | production | `main` | **AWS EC2** | processo longo (`server.ts` + `listen()`, pm2/systemd) | 🔜 pipeline pronto, ambiente não ativo |
| **MintlyWeb** | staging | escolhida no "Run workflow" | **Vercel** | estático | ✅ ativo |
| **MintlyWeb** | production | escolhida no "Run workflow" | **AWS S3 + CloudFront** | estático | 🔜 pipeline pronto |
| **MintlyLib** | — | `staging` / `main` | **npm** | pacote | ✅ publica a cada merge |

Deploy é **manual** (`workflow_dispatch` no `deploy.yml`) com os inputs `environment` (staging/production) e `confirm_deploy`. Não há input de nuvem — staging é sempre Vercel e production sempre AWS, evitando subir produção na Vercel por engano.

Na API, o job de deploy roda lint → typecheck → testes → build → `validate:swagger` → **`db:indices`** → deploy (uma aprovação por deploy). Antes de publicar, ele **sincroniza as variáveis** do GitHub (Secrets/Variables) para a Vercel e **falha** se faltar alguma obrigatória.

---

## Serverless (Vercel) — `api/index.ts`

O entrypoint serverless é **diferente** do `src/server.ts` (que roda um servidor de longa duração com `listen()` para dev/AWS). Pontos que só existem no caminho serverless:

- **Sem `listen()`**: o app é construído e o request é encaminhado ao handler HTTP do Fastify via `emit`. O `vercel.json` reescreve **todas** as rotas para esta função (`rewrites: /(.*) → /api`).
- **Cold start cacheado**: `buildServer()` + `mongoConnection.connect()` rodam **uma vez** por cold start (`appPromise` cacheado); invocações seguintes reusam. Se o bootstrap falhar, o cache é zerado para permitir nova tentativa.
- **Body pré-parseado**: a Vercel consome o stream do request e expõe `req.body` **antes** do Fastify. Por isso o parser de `application/json` é trocado para usar o corpo já parseado — senão o parser padrão leria um stream vazio e `request.body` ficaria `undefined`.
- **`ensureConnected`**: entre invocações a função é congelada e a topologia do cliente Mongo pode fechar (`MongoTopologyClosedError`). Uma checagem síncrona reabre a conexão só quando o driver reporta a topologia fechada — sem handshake por request.
- **`NODE_ENV=production` até na staging:** a Vercel força esse valor, então o Swagger fica desligado e o atalho de CORS para localhost não vale. Para desenvolver o front local contra a staging, inclua `http://localhost:4200` no `CORS_ORIGINS` da staging.

> `MONGODB_MAX_POOL_SIZE` baixo (5) é essencial em serverless: cada instância abre seu pool e a plataforma cria várias instâncias.

---

## Liquidação automática — `settle.yml`

Workflow agendado da API (cron **06:00 UTC**, todo dia) que roda `npm run db:indices` + `npm run db:settle` no banco do ambiente. Move os repasses de plataforma vencidos de "a receber" para "disponível" (ver [Movimentações](../api/movimento.md)).

- **Ambiente ⇄ branch:** staging é liquidada com o código da branch `staging`; production com o da `main` — um commit na staging nunca mexe em saldo de produção.
- **Environments dedicados (`settle-staging`, `settle-production`)** sem regra de aprovação: os environments de deploy exigem revisor, e um job noturno não pode ficar esperando clique.
- **Só a staging está no agendamento.** Production roda só manual, até o primeiro deploy real (ela ainda não está na allowlist).
- ⚠️ O GitHub só dispara `schedule` a partir da **branch default** do repositório; enquanto o arquivo não estiver nela, a liquidação roda por `workflow_dispatch`.

---

## CI (GitHub Actions) — `ci.yml`

| Repo | Passos |
|---|---|
| **MintlyApi** | lint → typecheck → `test:ci` (cobertura, threshold 90%) → build → `validate:swagger` (+ YAML lint) |
| **MintlyWeb** | lint → `format:check` → typecheck → `test:ci` → `build:ci` |
| **MintlyLib** | lint → typecheck → build → `pack:check` (**os testes jest não rodam no CI**) + auto-version |

- **Auto-version da MintlyLib:** o bump sai da **mensagem de commit** (Conventional Commits). Em `staging` a versão ganha sufixo `-preview` e é criada a tag `vX.Y.Z-preview`; no merge em `main` o sufixo é removido. Em seguida o `ci.yml` chama o `deploy.yml` (publish) no mesmo run.

---

## Publicação da lib (npm)

O `deploy.yml` da MintlyLib publica o pacote já versionado:

| Origem | dist-tag | Instalação |
|---|---|---|
| merge em `staging` | `preview` | `npm i mintly-lib@preview` |
| merge em `main` | `latest` | `npm i mintly-lib` |

Pode ser automático (no merge, via `workflow_call`) ou manual (`workflow_dispatch`). A API e a Web consomem a lib do npm com versão fixa — mudanças na lib só chegam nelas após publish + bump da versão consumida.

> Estado atual das dist-tags: `preview` = `2.27.0-preview`, `latest` = `1.0.0`, e `next` = `1.2.0` (tag antiga, não é mais publicada).

---

## MongoDB / Atlas

- **Um cluster, um banco por `env`** (`client.db(env)`): `app` (config global: `valid_environments`, `tax_settings`), `staging`, `production`. Ver [Multi-tenant](../api/multi-tenant.md).
- **URI standard (não-SRV)**: `buildMongoUri` monta a URI a partir de campos separados (`MONGODB_HOSTS`, `MONGODB_USER`, `MONGODB_PASSWORD`, `MONGODB_REPLICA_SET`, `MONGODB_AUTH_SOURCE`, `MONGODB_TLS`). O SRV (`mongodb+srv://`) depende de DNS SRV/TXT, que falha em alguns runners/redes. `MONGODB_URI` tem precedência quando definida (testes usam a do `mongodb-memory-server`).
- **Índices por banco**: `npm run db:indices` cria os índices no banco do `env` — roda no deploy e antes de cada liquidação. Rodar em **cada** env.
- **Allowlist de env**: `npm run db:seed-envs` insere `staging`/`production` em `app.valid_environments` (ativa a validação C2).
- **DAS do MEI**: `npm run db:seed-tax-settings` grava o valor vigente em `app.tax_settings` (muda todo ano).

---

## Serviços externos

| Serviço | Uso | Config |
|---|---|---|
| **Gmail SMTP** | e-mail de recuperação de senha | `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `EMAIL_FROM`, `FRONTEND_URL` |
| **Mercado Pago** | checkout da assinatura, renovação automática, webhook em `{API_URL}/webhooks/mercadopago?env=<ambiente>` | `PAYMENT_PROVIDER=mercadopago`, `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `MP_SANDBOX` (`PAYMENT_PROVIDER=mock` usa o simulador) |
| **Anthropic (Claude)** | IA dos cards e da sugestão de preço (padrão) | `AI_PROVIDER=claude`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` |
| **Google (Gemini)** | IA alternativa | `AI_PROVIDER=gemini`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_THINKING_LEVEL` |

---

## Variáveis por ambiente (resumo)

Lista completa na [referência da API](../api/mintly-api.md#variáveis-de-ambiente). No deploy da staging, o workflow separa:

- **Obrigatórias** (o deploy falha sem elas): `MONGODB_HOSTS`, `MONGODB_USER`, `MONGODB_PASSWORD`, `MONGODB_REPLICA_SET`, `MONGODB_AUTH_SOURCE`, `MONGO_ENV`, `API_URL`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `EMAIL_FROM`, `FRONTEND_URL`, `CORS_ORIGINS`, `PAYMENT_PROVIDER`.
- **Opcionais**: `MONGODB_TLS`, `MP_*`, `ADMIN_API_KEY`, `AI_PROVIDER`, `ANTHROPIC_*`, `GEMINI_*`.
- **Do próprio deploy**: `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `VERCEL_TOKEN` (Vercel); `AWS_EC2_HOST`, `AWS_EC2_USER`, `AWS_EC2_SSH_KEY`, `AWS_APP_DIR`, `AWS_PROCESS_NAME` (EC2: envio por `scp` e restart via pm2 ou systemd).

> O job de production da API ainda não repassa as variáveis de pagamento e de IA; isso precisa entrar junto com o primeiro deploy real.

---

## Runtime — quem fala com quem

A **MintlyWeb** (Angular) chama a API pelos clients da lib, mandando em cada request os `Headers`: `env` (seleciona o banco) + `Authorization` (JWT). `env=staging` fala com o deploy da Vercel / banco `staging`; `env=production` com o AWS / banco `production`. O **Mercado Pago** chama a API pelo webhook; a API chama o **Mercado Pago**, o **Gmail** e o provedor de **IA**.

Ver também: [Arquitetura da API](../api/arquitetura.md) · [Processo de release](../guias/processo-de-release.md).
