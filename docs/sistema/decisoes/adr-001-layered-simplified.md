# ADR-001 — Arquitetura "Layered Simplified"

**Status:** aceita

## Contexto

A MintlyApi precisa de **portabilidade de banco** (a interface de repositório e o tipo `Query` preveem Mongo e SQL) e de uma estrutura fácil de explicar e de testar. Ao mesmo tempo, boa parte das entidades começa como CRUD simples, e o time é pequeno.

## Decisão

Camadas formais e explícitas — **`route → controller → use-case → repository`** — com três simplificações:

- **CRUD genérico** (`CrudController` → `CrudUseCase` → `MongodbCrudRepository`) atende entidades triviais até surgir regra de negócio; aí nasce um use-case dedicado (`RegisterMovementUseCase`, `SetDefaultAccountUseCase`…).
- **Interface `CrudRepository<T, ID>`** em `core/crud/`, com a implementação Mongo separada: é o ponto de troca de banco.
- **Leitura agregada** em *queries* (`*.query.ts`) com o cálculo puro em `*-metrics.ts`.

## Alternativas consideradas

- **Arquitetura hexagonal completa** (portas e adaptadores, inversão de todas as dependências): dá a mesma portabilidade, mas exige muito mais cerimônia (portas para tudo, mapeamentos entre camadas) do que um projeto deste tamanho precisa. A portabilidade necessária é só a do banco, que a interface de repositório já resolve.
- **Controllers chamando o banco direto:** mais rápido no começo, mas mistura regra com acesso a dados e torna a regra difícil de testar.

## Consequências

- ✅ Estrutura previsível: cada domínio tem as mesmas peças nos mesmos lugares.
- ✅ CRUD novo sai quase de graça; regra nova tem lugar óbvio.
- ⚠️ Use-cases transacionais escrevem direto em `db.collection(...)`, porque o CRUD genérico não expõe a `ClientSession` da transação. É uma quebra consciente do fluxo "puro" ([Mapa de domínio](../api/mapa-de-dominio.md)).
- ⚠️ É preciso resistir a tratar o `CrudUseCase` como "service" que acumula regra: regra nova vira use-case próprio.

Ver: [Arquitetura](../api/arquitetura.md) · [CRUD genérico](../api/crud-generico.md).
