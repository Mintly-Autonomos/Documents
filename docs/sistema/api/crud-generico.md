# 🧱 MintlyApi — CRUD genérico

Entidades CRUD-triviais (Person, e a base de Account/Category) reaproveitam **três classes genéricas** em vez de reescrever controller/use-case/repository. Regra de negócio real ganha use-case dedicado; o resto herda.

```
CrudController<T>  →  CrudUseCase<T>  →  MongodbCrudRepository<T>  →  MongoDB
```

---

## As três classes

| Classe | Faz | Arquivo |
|---|---|---|
| `CrudController<T, ID>` | monta ctx, valida input, chama o use-case, formata resposta | `core/crud/crud-controller.ts` |
| `CrudUseCase<T, ID>` | auditoria e regras genéricas, delega ao repo | `core/crud/crud-use-case.ts` |
| `MongodbCrudRepository<T, ID>` | acesso ao Mongo com escopo de tenant | `core/crud/mongodb-crud-repository.ts` |

---

## O que a base garante (e os bugs que fecha)

### Controller

- **Usa o resultado do `parse` (A7):** `const parsed = this.orm.parse(item)` — persiste o valor **coagido/sanitizado**, não o body cru. Descarta campos extras (mass assignment) e aplica coerção do schema. Update usa o schema **parcial** (`ormPartial`).
- **404 com o recurso certo (M9):** o `Resource` é **injetado** no construtor — o `findById` que não acha lança `NotFoundError(this.resource, id)`, não mais `Resource.Person` hardcoded para tudo.
- **Paginação real (A2):** `findAll` busca `findAll` + `count` em paralelo; `totalItems`/`totalPages` vêm de `countDocuments`, não do tamanho da página.

### Use-case

- **Auditoria autoritativa:** `insert` preenche `audit { createdAt, updatedAt, createdBy, updatedBy }` no servidor (o que o client mandar é ignorado).
- **Update blindado (M12):** renova `audit.updatedAt/By` (via dot-notation, sem clobbar `createdAt`) e **descarta** `audit`, `restaurantId`, `_id` do body — o PATCH não forja o dono do tenant nem sobrescreve a auditoria.

### Repository

- **Escopo de tenant (C1):** `withTenant` injeta `restaurantId` em `findById`, `find`, `findAll`, `update`, `delete`, `insert` (ctx prevalece) e `query(mongo:filter)`.
- **404 em vez de 500 (A6/M11):** `_id` malformado → `findById` devolve `null`; `update`/`delete` lançam `NotFoundError` (o handler global mapeia 404). Antes, `new ObjectId(idInválido)` estourava 500.
- **`findAll` seguro (A5/M10):**
  - remove `page`/`size`/`orderBy`/`orderDirection`/`createdAtDirection`/`isMultipleResponse` do filtro (o client oficial sempre manda `isMultipleResponse` — se vazasse, a lista voltava vazia);
  - `sanitizeFilter` tira chaves com operadores Mongo (`$…`) → sem NoSQL injection;
  - clamp: `page ≥ 1`, `size` entre 1 e 100 (sem skip negativo / página gigante);
  - ordena por `audit.createdAt` (o campo real), não `createdAt` de topo.
- **`find` é nullable (M13):** tipado `Promise<T | null>` (o `findOne` pode não achar).

---

## Estender vs. compor

| Domínio | Como usa a base |
|---|---|
| **Person** | estende `CrudController` puro — CRUD completo (a rota `/people` tem GET/:id e DELETE) |
| **Account / Category** | estendem, **sobrescrevem** `findAll` (busca por `name` via regex) e `insert` (regras: saldo=0/isDefault=false; isSystem…), e adicionam use-cases próprios (set-default, inactivate, suggestions) |
| **Movement** | **não** usa a base — corpos dedicados e tudo transacional (ver [Mapa de domínio](./mapa-de-dominio.md)) |

> **Regra:** herde a base quando o recurso é CRUD comum; sobrescreva o método específico quando a regra difere; saia da base quando o fluxo é transacional/RPC (movimento).

---

## `query()` — pipelines e filtros

`MongodbCrudRepository.query(q, ctx)` suporta dois *kinds*:

- `mongo:filter` → `find(withTenant(filter))` (escopado por tenant);
- `mongo:pipeline` → `aggregate(pipeline)`;
- qualquer outro → `UnsupportedQueryKindError` (`APP-0002`).

Ver também: [Arquitetura](./arquitetura.md) · [Multi-tenant](./multi-tenant.md) · [Erros & validação](./erros.md).
