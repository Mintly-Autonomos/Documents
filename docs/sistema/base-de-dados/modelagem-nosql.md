# 🧩 Base de dados — modelagem NoSQL

O Mintly usa MongoDB como **banco de documentos**, não como um banco relacional sem joins. Cada coleção foi desenhada a partir de **como o dado é lido**, e cada relação escolhe entre três formas: **embutir**, **referenciar** ou **Extended Reference** (referência + cópia dos campos lidos junto).

Ver também: [Coleções & índices](./colecoes.md) · [Atributos das coleções](./colecoes-atributos.md) · [Multi-tenant](./multi-tenant.md) · [Migrações e backfills](./migracoes-e-backfills.md).

---

## As três formas e quando usar cada uma

| Forma | Quando usar | Custo |
|---|---|---|
| **Embutir** (subdocumento ou array dentro do documento) | o dado só existe dentro do pai, é lido sempre junto e tem tamanho limitado | o documento cresce; não dá para consultar o filho sozinho com eficiência |
| **Referenciar** (guardar só o id) | o dado tem vida própria, é compartilhado ou cresce sem limite | leitura extra (ou `$lookup`) quando precisa dos dados do outro lado |
| **Extended Reference** (id + cópia de alguns campos) | precisa do id para navegar **e** de alguns campos para mostrar, sem buscar o outro documento | dado duplicado; a cópia não acompanha mudanças na origem |

A API **não usa `$lookup`**: toda tela é atendida por consultas a uma coleção, mais no máximo uma leitura extra pela chave.

---

## Decisão por relação

| Relação | Forma | Por quê |
|---|---|---|
| `users.person` → `people` | **Extended Reference** `{ _id, name }` | o login e o token precisam do nome; o resto da pessoa (telefone, foto) fica em `people` e só é lido em "minha conta" |
| `users.restaurantId`, e o `restaurantId` de todas as coleções do restaurante | **referência** (string) | o restaurante é o dono (tenant); cada coleção cresce sem limite e é consultada sozinha por `restaurantId` |
| `restaurants.subscription` | **embutido** | um por restaurante, lido em toda request (portão de assinatura) — uma leitura só pela chave |
| `restaurants.subscription` × `payments` | **referência** (`lastPaymentId`) + coleção própria | pagamentos crescem sem limite e precisam de índice único em `providerPaymentId`; a assinatura guarda só o resultado |
| `financial_categories.subcategories[]` | **embutido** | poucas por categoria, sempre lidas com ela, sem tela própria; ids próprios para o movimento referenciar |
| `financial_movements.account` / `.category` / `.subcategory` | **Extended Reference** | a lista e os relatórios mostram nome e tipo sem buscar conta/categoria; renomear a conta **não reescreve o histórico** |
| `financial_movements.items[]` → `menu_items` | **Extended Reference** `{ menuItemId, name, qty, unitPrice }` (máx. 30) | o preço do dia da venda precisa ficar congelado; o ranking de mais vendidos sai do próprio movimento |
| `financial_movements.feePercentApplied` / `settlementRuleApplied` | **cópia** da configuração da conta | editar o movimento depois não pode reprecificar pela taxa atual |
| saldo da conta (`availableBalance`, `predictedBalance`) | **valor agregado** no documento da conta | ler o saldo é constante; o custo vai para a escrita (`$inc` na mesma transação do movimento) |
| eventos de auditoria | **coleção própria** (`audit_logs`) | cresce sem limite; arrays ilimitados num documento estouram os 16 MB e pioram toda leitura |
| `history[]` em contas, categorias e movimentos | **embutido** | trilha curta das mudanças de cada registro, mostrada junto dele |
| foto de perfil | **embutida** em `people` como data URL (máx. 1 MB) | dispensa bucket e serviço externo; o limite deixa o documento muito abaixo dos 16 MB |
| contador e cache da IA | **coleções próprias** com `_id` composto | `_id` = `restaurantId:dia` (contador) ou `restaurantId:tipo:dia:hash` (cache) permite `upsert` atômico pela chave, sem índice extra |
| sessão (`valkyrie_*`) | **coleções da biblioteca** | o formato é da valkyrie-jwt; a API só lê e revoga |

---

## Princípios que aparecem em todo o modelo

### O histórico financeiro é imutável por desenho

Movimentos guardam **cópias**, não ponteiros, de tudo que pode mudar depois: nome da conta, da categoria e do prato, preço do prato, taxa e regra de repasse. É isso que permite renomear, reajustar e reconfigurar sem alterar relatórios de meses fechados.

### Coerência entre campos fica no schema

Sem `refine` no Sapphire, as regras "este campo só existe se aquele tiver tal valor" viram **uniões discriminadas** no contrato da [mintly-lib](../libs/mintly-lib.md):

| Discriminador | Regra |
|---|---|
| `financial_accounts.type` | `platform` exige taxa e regra de repasse; os outros tipos proíbem |
| `financial_categories.type` | só `expense` tem `dreGroup` (e nela ele é obrigatório) |
| `financial_movements.direction` | `in` exige categoria `revenue`; `out` exige `expense` |
| `settlementRule.kind` | cada tipo de repasse tem os próprios campos |

Regras que dependem do valor **já gravado** (ex.: taxa num PATCH que não manda `type`) ficam na API (`account-rules.ts`, `category-rules.ts`).

### Unicidade e ordem ficam nos índices

O banco garante o que o código não consegue garantir sob concorrência: e-mail único, uma conta padrão por restaurante (índice único parcial), nome único sem diferenciar acento e maiúscula (`collation pt`, `strength: 2`), um pagamento por id do provedor, uma importação por chave.

### Operações em mais de um documento usam transação

Signup, registro/edição de movimento (movimento + saldo), conta padrão, criação de funcionário e confirmação de pagamento usam `session.withTransaction`. Isso exige **replica set**, inclusive nos testes (`mongodb-memory-server` em modo replica set).

### Dinheiro é `Decimal128`

Valores de saldo e de movimento são `Decimal128` no banco e `number` no contrato; as contas são feitas em centavos inteiros. Ver [Modelo de dinheiro](../api/dinheiro.md).

### Dados temporários expiram sozinhos

Coleções que só servem por um tempo têm **índice TTL**: tokens de reset (`expiresAt`), contador e cache da IA (`expireAt`), chaves de importação (30 dias) e auditoria (365 dias).

---

## Trade-offs assumidos

- **Cópia não acompanha a origem.** Se um nome errado for corrigido na conta, os movimentos antigos continuam com o nome errado. É o preço do histórico imutável. A única cópia que a API atualiza é `users.person.name`, na troca de nome em "minha conta".
- **`history[]` não tem teto.** Contas e categorias editadas muitas vezes acumulam entradas no próprio documento. Hoje o volume é pequeno; se crescer, o caminho é levar o histórico para uma coleção própria, como já foi feito com a auditoria.
- **`restaurantId` é string, não ObjectId.** Simplifica o contrato compartilhado com o front (que não conhece ObjectId), ao custo de converter quando se busca o restaurante pelo `_id`.
- **Sem validação no banco (`$jsonSchema`).** A validação vive no Sapphire, na entrada da API; um script que grave direto no banco pode fugir do contrato. Levar os schemas para validators de coleção é evolução prevista.
