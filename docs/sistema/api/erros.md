# 🚨 MintlyApi — erros & validação

Todo erro sai no **mesmo envelope**, com um `code` de um **glossário único**. Validação é feita pelo Sapphire (contratos da lib) e por schemas Fastify (forma), ambos convertidos para o mesmo formato.

---

## Envelope de erro

```json
{ "code": "AUTH-0001", "message": "Credenciais inválidas" }
```

Validação vem com detalhe por campo:

```json
{ "code": "VALIDATION_ERROR", "message": "Validation failed", "details": { "email": ["formato inválido"] } }
```

---

## Glossário (`error-glossary.ts` — fonte única)

| Código | HTTP | Classe | Significado |
|---|---|---|---|
| `APP-0001` | 404 | `NotFoundError` | recurso não encontrado |
| `APP-0002` | 400 | `UnsupportedQueryKindError` | query kind não suportada |
| `APP-0003` | 400 | `MissingEnvError` | header `env` ausente |
| `APP-0004` | 400 | `InvalidEnvError` | `env` fora da allowlist |
| `APP-0005` | 400 | `ValidationError` | regra de domínio violada (ex.: `settledAt` no futuro, mês inválido nos relatórios) |
| `AUTH-0001` | 401 | `UnauthorizedError` | não autenticado / credencial ou token inválido |
| `AUTH-0002` | 409 | `ConflictError` | conflito (e-mail já cadastrado, duplicidade de movimento, importação em andamento) |
| `AUTH-0003` | 403 | `ForbiddenError` | conta inativa/bloqueada, senha atual errada, ação só do dono |
| `AUTH-0004` | 429 | `TooManyRequestsError` | lockout temporário |
| `SUBSCRIPTION-0001` | 402 | `SubscriptionRequiredError` | sem assinatura válida (o front leva à tela de assinatura) |
| `PAYMENT-0001` | 502 | `PaymentProviderError` | o provedor de pagamento não respondeu como esperado (a pessoa pode tentar de novo) |
| `AI-0001` | 429 | `AiLimitReachedError` | limite diário de chamadas à IA atingido |
| `AI-0002` | 503 | `AiUnavailableError` | provedor de IA sem chave ou fora do ar |
| `AI-0003` | 403 | `AiProOnlyError` | IA é só do plano Pro |
| `VALIDATION_ERROR` | 400 | — (handler) | falha de schema Fastify ou Sapphire (com `details`) |
| `INTERNAL_ERROR` | 500 | — (handler) | erro não tratado |

> **Fonte única (M14):** os códigos `APP-*`, `AUTH-*` e `SUBSCRIPTION-*` moram no `error-glossary.ts`, e as classes **referenciam** o glossário (`errorGlossary.unauthorized.code`) em vez de ter o código inline. Exceções: os erros da IA (`app/ai/ai-errors.ts`, código `AI-*`) e o `PaymentProviderError` (`app/subscription/subscription-use-cases.ts`, `PAYMENT-0001`) declaram o código no próprio arquivo.
>
> **Dois códigos de validação:** `VALIDATION_ERROR` sai do handler para falhas de *schema*; `APP-0005` sai do `ValidationError`, lançado pelo código quando uma *regra de domínio* falha. O front precisa tratar os dois como erro de dado do usuário.

---

## Hierarquia de erros

```
BaseError  →  { message, apiMessage, code, statusCode }
├── core/errors/auth/   UnauthorizedError · ConflictError · ForbiddenError · TooManyRequestsError · SubscriptionRequiredError
├── core/errors/core/   NotFoundError · UnsupportedQueryKindError · MissingEnvError · InvalidEnvError · ValidationError
├── app/ai/ai-errors    AiLimitReachedError · AiUnavailableError · AiProOnlyError
└── app/subscription    PaymentProviderError
```

Cada erro carrega seu `statusCode`; o `NotFoundError` aceita um `Resource` (ou string) para a mensagem.

---

## O handler global (`build-server.ts`)

Ordem de tratamento no `setErrorHandler`:

1. **Erro de validação do Fastify** (`error.validation`) → `400 VALIDATION_ERROR` com `details`. *(senão cairia no 500 genérico)*
2. **`BaseError`** → `reply.status(error.statusCode).send({ code, message: apiMessage })`.
3. **`SapphireValidationError`** → `400 VALIDATION_ERROR` com `fieldErrors` (ver dual-package abaixo).
4. **Qualquer outro** → `500 INTERNAL_ERROR` (logado no servidor).

---

## Validação — dois níveis

| Nível | Quem | Faz |
|---|---|---|
| **Forma** | schema Fastify (body) | campos obrigatórios existem e têm o tipo certo; alimenta o Swagger |
| **Profunda** | Sapphire (contratos da lib) | regras de senha, e-mail, união discriminada (platform×taxa), limites |

Os schemas Fastify das rotas de auth são **propositalmente frouxos** (só a forma) — a validação de regra continua no Sapphire dentro dos use-cases (B8). As duas falhas convergem para `VALIDATION_ERROR`.

---

## Dual-package hazard (pegadinha)

A `mintly-lib` é build CJS. Um `SapphireValidationError` lançado **por dentro da lib** pode ser instância de **outra classe** que a do consumidor (duas cópias do `sapphire-core` no grafo de módulos). Por isso o handler checa **os dois**:

```ts
if (error instanceof SapphireValidationError || error?.name === 'SapphireValidationError') { … }
```

Só `instanceof` falharia silenciosamente e o erro viraria 500.

Ver também: [Arquitetura](./arquitetura.md) · [mintly-lib](../libs/mintly-lib.md).
