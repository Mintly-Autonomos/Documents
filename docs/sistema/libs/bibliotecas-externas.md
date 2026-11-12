# 🧩 Bibliotecas externas

Além da [`mintly-lib`](./mintly-lib.md) (nossa), o Mintly usa duas bibliotecas **feitas por membros do grupo**: **valkyrie-jwt** (sessão) e **Sapphire** (validação). Esta página documenta o que cada uma faz e **como está integrada**.

---

## 🔑 valkyrie-jwt — sessão / JWT

Biblioteca de autenticação por JWT criptografado, com rotação de refresh token. É o que sustenta a sessão da API. Versão usada: `valkyrie-jwt@0.1.1`.

### O que faz
- Emite um **access token** (curto, 15 min) + **refresh token** (longo, 7 dias).
- Tokens **criptografados** (AES-256-GCM) — não é um JWT assinado "aberto", o payload não é legível sem a chave.
- **Rotação**: cada `refresh` emite um par novo e invalida o refresh anterior; reuso de um refresh já rotacionado é detectado e a família é negada.
- Persiste tudo no banco do `env` (`createMongoStores`): **`valkyrie_signing_keys`** (chaves que assinam/criptografam, com rotação), **`valkyrie_refresh_tokens`** (sessões, agrupadas por família) e **`valkyrie_audit_events`** (`token.issued`, `token.validated`, `token.rejected`, `key.rotated`). Formato em [Atributos das coleções](../api/colecoes-atributos.md#valkyrie_signing_keys).

### Como a API usa
Um serviço **por `env`** (o banco é por ambiente):

```ts
const jwt = getJwtService(ctx.env)          // ValkyrieJwtService do env
```

| Método | Onde | Para quê |
|---|---|---|
| `generate({ tenantId, subject, claims })` | login, **signup (pós-commit)** | emite o par de tokens |
| `validate(accessToken)` | hook `verify-jwt` (rotas 🔒) e no `refresh` | valida e devolve `{ succeeded, subject, claims }` |
| `refresh(refreshToken)` | `POST /auth/refresh` | rotaciona o par |
| `revokeRefreshToken(token)` | logout, refresh negado | derruba uma sessão |

Para derrubar **todas** as sessões de um usuário (reset/troca de senha, funcionário inativado, rebaixamento de plano), a API atualiza direto o `valkyrie_refresh_tokens` em `session-revocation.ts` (`revokeAllSessions`), marcando `revokedAt` em todos os tokens ainda válidos do `subject`.

O `tenantId` passado à lib é sempre `"mintly"`: o isolamento entre ambientes já vem do banco do `env`.

Pontos de integração no código: `auth-use-case.ts` (login/refresh/logout), `register-use-case.ts` (`generate` **depois** do commit — senão deixaria token órfão em retry, ver M4), `core/hooks/verify-jwt.ts` (valida o Bearer e anexa os claims ao request). Detalhe do fluxo em [Auth & sessão](../api/auth.md).

### Como está linkada
Dependência npm da **API** (não da `mintly-lib` nem do front — sessão é responsabilidade do servidor). Config via env: `JWT_ISSUER`, `JWT_ACCESS_LIFETIME_SECONDS`, `JWT_REFRESH_LIFETIME_SECONDS`. Proteção do token: `ValkyrieTokenProtection.Encrypted`.

---

## 🛡️ Sapphire (`@ascendance-hub/sapphire-core`) — validação / schemas

Biblioteca de schema e validação (estilo Zod), versão `@ascendance-hub/sapphire-core@1.2.0`: declara-se o formato do dado uma vez, e dela saem **a validação em runtime** e **o tipo TypeScript** (inferido). É a base sobre a qual a `mintly-lib` declara todos os contratos.

### O que faz
- **Schemas declarativos**: `s.object({...})`, `s.string()`, `s.number().min().max()`, `s.type().enum(...)`, `s.type().literal(...)`, `s.array(...)`, `.optional()`, `.default()`.
- **Composição**: `.extend()` (herda + adiciona), `.partial()` (tudo opcional), `s.type().union([...])` (união discriminada).
- **Tipos inferidos**: `Infer<typeof xSchema>` — validação e tipagem **nunca divergem**.
- **`safeParse` / `parse`**: valida e coage; lança `SapphireValidationError` (com `flatten().fieldErrors`) no `parse`.

### Como é usada
- **`mintly-lib`** declara **todos** os contratos com Sapphire (person, user, restaurant, financial, menu, subscription, ai, auth…). Ex.: a conta financeira é uma **união discriminada** por `type` (platform exige `feePercent` + regra de repasse; os outros proíbem), e a regra de repasse é outra união por `kind`.
- **A API** valida entrada com esses schemas: `orm.parse(body)` no `CrudController` (usa o resultado coagido — fecha mass assignment), `financialMovementSchema.parse(doc)` nos use-cases de movimento, `signupRequestSchema.parse(...)` no signup.
- O handler global converte `SapphireValidationError` → `400 VALIDATION_ERROR` com `details` por campo.

### Como está linkada
Dependência da **`mintly-lib`** (que a reexporta nos schemas); a API a consome **transitivamente**. O front importa só os tipos inferidos, sem peso de banco.

### Pegadinhas
- **Dual package hazard**: a `mintly-lib` é build CJS; um `SapphireValidationError` lançado por dentro dela pode vir de **outra instância de classe** que a do consumidor. Por isso o handler checa `error.name === 'SapphireValidationError'` **além** de `instanceof` (senão viraria 500). Ver [Erros & validação](../api/erros.md).
- **Sem `refine`/`superRefine`**: regras cross-field que dependem de um campo que pode não vir (ex.: taxa num PATCH sem `type`) não são verificáveis no schema — ficam no servidor (ver P5 em problemas futuros).

---

Ver também: [mintly-lib](./mintly-lib.md) · [Auth & sessão](../api/auth.md) · [Erros & validação](../api/erros.md).
