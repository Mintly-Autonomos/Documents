# 🧭 Decisões de arquitetura (ADRs)

Cada arquivo registra **uma decisão técnica**: o contexto, o que foi decidido, as alternativas e as consequências. O objetivo é que qualquer pessoa (ou a banca) entenda **por que** o Mintly é como é, sem precisar reconstruir a discussão.

| # | Decisão | Tema |
|---|---|---|
| [001](./adr-001-layered-simplified.md) | Arquitetura "Layered Simplified" | API |
| [002](./adr-002-request-context-explicito.md) | `RequestContext` passado explicitamente, sem AsyncLocalStorage | API |
| [003](./adr-003-multi-tenant-hibrido.md) | Multi-tenant: banco por `env` + `restaurantId` do JWT | dados |
| [004](./adr-004-mongodb-idiomatico.md) | MongoDB idiomático: saldo embutido e Extended Reference | dados |
| [005](./adr-005-dinheiro-decimal128.md) | Dinheiro em `Decimal128`, contas em centavos | dados |
| [006](./adr-006-contratos-na-mintly-lib.md) | Contratos compartilhados na mintly-lib, com Sapphire | lib |
| [007](./adr-007-senha-scrypt.md) | Hash de senha com scrypt | segurança |
| [008](./adr-008-sessao-valkyrie-jwt.md) | Sessão com valkyrie-jwt: token criptografado e refresh rotacionado | segurança |
| [009](./adr-009-liquidacao-por-script.md) | Liquidação automática por script agendado, não por rota | API |
| [010](./adr-010-relatorios-na-leitura.md) | Relatórios calculados na leitura, com a regra separada da consulta | API |
| [011](./adr-011-pagamento-reconsultado.md) | Pagamento só vale depois de reconsultado no provedor | assinatura |
| [012](./adr-012-ia-so-escreve.md) | A IA só escreve: números e limites vêm do servidor | IA |
| [013](./adr-013-ambiente-decide-a-nuvem.md) | O ambiente decide a nuvem (staging na Vercel, production na AWS) | infra |

> As ADRs foram escritas em novembro/2026, depois das decisões, a partir dos specs da API e do histórico do projeto. Quando o motivo de uma escolha não ficou registrado, a ADR diz isso explicitamente; as alternativas descrevem as opções comparáveis da época.

## Como escrever uma ADR nova

1. Copie o formato de uma existente: **Status · Contexto · Decisão · Alternativas consideradas · Consequências**.
2. Numere em sequência (`adr-014-…`) e adicione a linha na tabela acima.
3. ADR não se edita para mudar a decisão: escreva uma nova e marque a antiga como **substituída por ADR-0XX**.
4. Registre só decisões que alguém poderia questionar depois — não convenções óbvias.
