# ☁️ Mintly — infraestrutura

Como o Mintly é buildado, testado, deployado e conectado ao banco. **O ambiente decide a nuvem**: `staging` → Vercel (serverless); `production` → AWS EC2.

![Topologia de deploy](/Documents/files/diagrams/topologia-deploy.svg)

---

## Estratégia de deploy

| Ambiente | Branch | Nuvem | Modelo | Status |
|---|---|---|---|---|
| **staging** | `staging` | **Vercel** | serverless (`api/index.ts`) | ✅ ativo |
| **production** | `main` | **AWS EC2** | processo longo (`server.ts` + `listen()`) | 🔜 não pronto |

Deploy é **manual** (`workflow_dispatch` no `deploy.yml`) com dois inputs: `environment` (staging/production) e `confirm_deploy` (checkbox). Não há input de nuvem — staging é sempre Vercel e production sempre AWS, evitando subir produção na Vercel por engano. A **criação de índices** roda dentro do job de deploy (uma aprovação por deploy).

---

## Serverless (Vercel) — `api/index.ts`

O entrypoint serverless é **diferente** do `src/server.ts` (que roda um servidor de longa duração com `listen()` para dev/AWS). Pontos que só existem no caminho serverless:

- **Sem `listen()`**: o app é construído e o request é encaminhado ao handler HTTP do Fastify via `emit`. O `vercel.json` reescreve **todas** as rotas para esta função (`rewrites: /(.*) → /api`).
- **Cold start cacheado**: `buildServer()` + `mongoConnection.connect()` rodam **uma vez** por cold start (`appPromise` cacheado); invocações seguintes reusam. Se o bootstrap falhar, o cache é zerado para permitir nova tentativa.
- **Body pré-parseado**: a Vercel consome o stream do request e expõe `req.body` **antes** do Fastify. Por isso o parser de `application/json` é trocado para usar o corpo já parseado — senão o parser padrão leria um stream vazio e `request.body` ficaria `undefined` (quebrava o login, por ex.).
- **`ensureConnected`**: entre invocações a função é congelada e a topologia do cliente Mongo pode fechar (`MongoTopologyClosedError`). Uma checagem síncrona reabre a conexão só quando o driver reporta a topologia fechada — sem handshake por request (que estouraria limites de conexão do Atlas).

> `MONGODB_MAX_POOL_SIZE` baixo (5) é essencial em serverless: cada instância abre seu pool e a plataforma cria várias instâncias.

---

## CI (GitHub Actions) — `ci.yml`

Roda em **PR e push**. Job **Quality Checks** (Node 22): `lint → typecheck → test:ci (cobertura, threshold 90%) → build → validate:swagger`. Há também um **YAML Lint**.

- **MintlyLib** tem um passo extra de **auto-version**: o bump de versão sai da **mensagem de commit** (Conventional Commits); em `staging` a versão ganha sufixo `-preview`. No merge, o `ci.yml` chama o `deploy.yml` (publish) no mesmo run.

---

## Publicação da lib (npm)

O `deploy.yml` da MintlyLib publica o pacote já versionado:

| Origem | dist-tag | Instalação |
|---|---|---|
| merge em `staging` | `preview` | `npm i mintly-lib@next` |
| merge em `main` | `latest` | `npm i mintly-lib` |

Pode ser automático (no merge, via `workflow_call`) ou manual (`workflow_dispatch`). A API e a Web consomem a lib do npm — mudanças na lib só chegam nelas após publish + bump da versão consumida.

---

## MongoDB / Atlas

- **Um cluster, um banco por `env`** (`client.db(env)`): `app` (config global), `staging`, `production`. Ver [Multi-tenant](../api/multi-tenant.md).
- **URI standard (não-SRV)**: `buildMongoUri` monta a URI a partir de campos separados (`MONGODB_HOSTS`, `MONGODB_USER`, `MONGODB_PASSWORD`, `MONGODB_REPLICA_SET`, …). O SRV (`mongodb+srv://`) depende de DNS SRV/TXT, que falha em alguns runners/ambientes. `MONGODB_URI` tem precedência quando definida (testes usam a do `mongodb-memory-server`).
- **Índices por banco**: `npm run db:indices` cria os índices no banco do `env` — roda no job de deploy. Rodar em **cada** env.
- **Allowlist de env**: `npm run db:seed-envs` insere `staging`/`production` em `app.valid_environments` (ativa a validação C2).

---

## Variáveis por ambiente (resumo)

Além das da [referência da API](../api/mintly-api.md): `MONGODB_HOSTS`/`MONGODB_USER`/`MONGODB_PASSWORD`/`MONGODB_REPLICA_SET` (conexão), `API_URL`, `VERCEL_ORG_ID`/`VERCEL_PROJECT_ID` (deploy Vercel), `MONGO_ENV` (env alvo do job de índices), `FRONTEND_URL` (link do e-mail de recuperação).

---

## Runtime — quem fala com quem

A **MintlyWeb** (Angular) chama a API pelos clients da lib, mandando em cada request os `Headers`: `env` (seleciona o banco) + `Authorization` (JWT). `env=staging` fala com o deploy da Vercel / banco `staging`; `env=production` com o AWS / banco `production`.

Ver também: [Arquitetura da API](../api/arquitetura.md) · [Processo de release](../guias/processo-de-release.md).
