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

| Código | HTTP | Significado |
|---|---|---|
| `AUTH-0001` | 401 | não autenticado / credencial ou token inválido |
| `AUTH-0002` | 409 | conflito (e-mail já cadastrado) |
| `AUTH-0003` | 403 | conta inativa ou bloqueada |
| `AUTH-0004` | 429 | lockout temporário |
| `APP-0001` | 404 | recurso não encontrado |
| `APP-0002` | 400 | query kind não suportada |
| `APP-0003` | 400 | header `env` ausente |
| `APP-0004` | 400 | `env` fora da allowlist |
| `VALIDATION_ERROR` | 400 | falha de validação (com `details`) |
| `INTERNAL_ERROR` | 500 | erro não tratado |

> **Fonte única (M14):** os códigos moram todos no `error-glossary.ts`. Os erros de auth (`UnauthorizedError`, `ConflictError`, …) **referenciam** o glossário (`errorGlossary.unauthorized.code`), não têm o código inline — antes havia duas fontes de verdade.

---

## Hierarquia de erros

```
BaseError  →  { message, apiMessage, code, statusCode }
├── auth/    UnauthorizedError · ConflictError · ForbiddenError · TooManyRequestsError
└── core/    NotFoundError · UnsupportedQueryKindError · MissingEnvError · InvalidEnvError
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
