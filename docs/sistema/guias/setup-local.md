# 🧰 Setup local — do zero ao app rodando

Como subir **MintlyApi** + **MintlyWeb** na sua máquina e, se precisar, testar uma mudança da **MintlyLib** antes de publicar.

---

## Pré-requisitos

| Ferramenta | Versão | Observação |
|---|---|---|
| Node.js | **24.x** | a API e a Web declaram `engines.node: 24.x` |
| npm | 11 | o CI usa `npm@11.11.0` |
| Git | — | com acesso à org `Mintly-Autonomos` |
| MongoDB | Atlas (recomendado) ou local em **replica set** | transações exigem replica set |

```bash
git clone https://github.com/Mintly-Autonomos/MintlyApi.git
git clone https://github.com/Mintly-Autonomos/MintlyWeb.git
git clone https://github.com/Mintly-Autonomos/MintlyLib.git   # só se for mexer nos contratos
```

Trabalhe a partir da branch **`staging`** de cada repositório: é onde está o código mais novo (veja [Convenções](./convencoes.md)).

---

## 1. API

```bash
cd MintlyApi
npm ci
cp .env.example .env
```

### Banco

**Opção A — Atlas (recomendado).** Preencha no `.env` os campos separados (formato **sem SRV**):

```env
MONGODB_USER=<user>
MONGODB_PASSWORD=<pass>
MONGODB_HOSTS=<host-00>.<cluster>.mongodb.net:27017,<host-01>…:27017,<host-02>…:27017
MONGODB_REPLICA_SET=<replica-set>
MONGODB_AUTH_SOURCE=admin
```

Se você só tem a string `mongodb+srv://…`, descubra hosts e replica set com `nslookup -type=SRV _mongodb._tcp.<cluster>.mongodb.net` e `nslookup -type=TXT <cluster>.mongodb.net` (no PowerShell: `Resolve-DnsName -Type SRV …`). O SRV é evitado porque algumas redes bloqueiam esse lookup.

**Opção B — Mongo local.** Precisa ser replica set, senão signup e lançamentos (que usam transação) falham:

```bash
docker run -d -p 27017:27017 --name mongodb mongo --replSet rs0
node scripts/init-replica-set.mjs        # uma vez, inicializa o rs0
```

e no `.env`: `MONGODB_URI=mongodb://localhost:27017/?replicaSet=rs0` (tem precedência sobre os campos separados).

> ⚠️ **Banco compartilhado.** A Web local manda `env: staging` em todo request. Se a sua API local aponta para o cluster do Atlas, você está lendo e gravando no **banco `staging` de verdade** — o mesmo da API publicada. Para testar sem afetar ninguém, use Mongo local ou um usuário de teste próprio.

### O que funciona sem configurar nada

| Recurso | Sem variável | Para ligar |
|---|---|---|
| E-mail de recuperação | o link aparece **no console** da API | `GMAIL_USER` + `GMAIL_APP_PASSWORD` |
| Pagamento | **simulador** (`PAYMENT_PROVIDER` vale `mock` fora de produção) | `PAYMENT_PROVIDER=mercadopago` + `MP_*` |
| CORS | `localhost`/`127.0.0.1` liberados fora de produção | — |
| IA | rotas `/ai` respondem 503 | `ANTHROPIC_API_KEY` (ou `AI_PROVIDER=gemini` + `GEMINI_API_KEY`) |
| Swagger | em `http://localhost:3000/documentation` | — |

### Rodar

```bash
npm run dev            # http://localhost:3000, com hot reload
curl http://localhost:3000/health
```

### Dados iniciais (opcional)

```bash
MONGO_ENV=staging npm run db:indices                       # índices do banco que você vai usar
MEI_MONTHLY_DAS=82.05 VALID_FROM=2026-01 npm run db:seed-tax-settings   # imposto do MEI no DRE
```

Para conferir relatórios com dados prontos, crie um restaurante pelo cadastro e rode `db:seed-demo` nele (ver [Migrações e seeds](../base-de-dados/migracoes-e-backfills.md#seeds-de-dados)).

---

## 2. Web

```bash
cd MintlyWeb
npm ci
npm start              # http://localhost:4200, aponta para http://localhost:3000
```

- **`src/environments/environment.development.ts`** define `apiUrl` e `mintlyEnv`. Não commite mudanças nele.
- **Sem API rodando:** coloque `useMocks: true` no `environment.ts` (só local, nunca commitado). Os services passam a ler `src/app/mocks/*.json`.
- **Front local contra a API de staging publicada:** troque `apiUrl` para a URL da staging. A staging roda com `NODE_ENV=production`, então `http://localhost:4200` precisa estar no `CORS_ORIGINS` dela.

---

## 3. Primeiro acesso no app

1. Cadastre-se em `/auth/cadastro`. O cadastro já cria a conta "Caixa" e 6 categorias.
2. O app leva à tela de **assinatura**: escolha um plano e, no **simulador**, clique em aprovar. Para usar a IA, escolha o **Pro**.
3. Conclua o onboarding.

Atalhos para liberar uma conta sem passar pelo simulador:
- `POST /admin/subscription-gift` com `{ email }` e header `x-admin-key` (exige `ADMIN_API_KEY` no `.env`) — dá 1 dia;
- ou grave `subscription.endsAt` (e `subscription.tier: "pro"`) direto no documento do restaurante.

---

## 4. Testar uma mudança da MintlyLib antes de publicar

A API e a Web usam a lib **do npm**, com versão fixa. Para testar localmente:

```bash
cd MintlyLib && npm ci && npm run build
cd ../MintlyApi && npm install ../MintlyLib      # o mesmo vale para a Web
```

Isso troca a dependência por `file:../MintlyLib` no `package.json` e no lock. **Não commite essa troca**: depois de publicar a lib, volte para a versão do npm (`npm install mintly-lib@<versão>`). Lembre de rodar `npm test` na lib — o CI dela não roda os testes.

---

## 5. Antes de abrir o PR

| Repo | Comandos |
|---|---|
| API | `npm run lint && npm run typecheck && npm run test:cov && npm run validate:swagger` |
| Web | `npm run lint && npm run format:check && npm run typecheck && npm run test:ci` |
| Lib | `npm run lint && npm run typecheck && npm test && npm run build && npm run pack:check` |

Detalhes em [Estratégia de testes](./estrategia-de-testes.md).

---

## Problemas comuns

| Sintoma | Causa provável |
|---|---|
| `Transaction numbers are only allowed on a replica set member` | Mongo local sem replica set (ver opção B) |
| 400 `APP-0004` em toda chamada | o `env` não está em `app.valid_environments` do cluster (use `staging`) |
| Erro de conexão com `mongodb+srv` | rede bloqueando DNS SRV: use os campos separados |
| 402 em tudo depois do login | restaurante sem assinatura: aprove no simulador ou use o presente |
| Front sem resposta da API, erro de CORS no navegador | API apontada é a publicada e `localhost:4200` não está no `CORS_ORIGINS` dela |
| `BACK_END_URL não configurada` | a lib foi instanciada antes do `main.ts` definir a URL (não crie `MasterClient` em import de módulo) |

Mais casos operacionais no [Runbook](../infra/runbook.md).
