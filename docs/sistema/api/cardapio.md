# 🍽️ Cardápio

O cardápio liga três coisas: o **cadastro dos pratos** (preço e custo), as **vendas** (que pratos saíram em cada lançamento) e a **análise** (quais pratos vendem e lucram). Também lembra o dono de revisar o preço de tempos em tempos.

Código: `src/app/menu-item/` e `src/app/financial-movement/movement-items.ts` (API) · `menu/menu-item-schema.ts` (lib) · `services/cardapio.service.ts`, `services/cardapio.builder.ts` e `pages/cardapio/`, `pages/previsoes/cardapio-interativo.component.ts` (Web).
Dados: [`menu_items`](../base-de-dados/colecoes-atributos.md#menu_items) e `financial_movements.items[]`.

---

## O prato

| Campo | Regra |
|---|---|
| `name` | até 80 caracteres; **único** por restaurante, sem diferenciar acento e maiúscula |
| `category` | grupo livre do cardápio ("Doces", "Bebidas"), até 40 caracteres |
| `price` | ≥ 0; muda só pela rota de preço |
| `cost` | custo unitário (ingredientes + embalagem), ≥ 0; padrão 0 = "ainda não informado" |
| `soldPerMonth` | número digitado pelo dono; só vale enquanto não há vendas com pratos (ver abaixo) |
| `status` | `active` / `inactive` (nunca apaga) |
| `priceUpdatedAt` | última vez que o **valor** mudou |
| `priceReviewedAt` | última **revisão**: mudou o valor **ou** decidiu manter |

O cadastro (`POST /menu-items`) recebe só nome, preço, grupo, custo e vendidos; o servidor preenche restaurante, status e as duas datas (cadastrar conta como revisar). A listagem traz ativos primeiro e depois por nome.

---

## Revisão de preço

O preço deve ser revisado a cada **~6 meses**. Um prato **ativo** entra nos avisos quando a última revisão tem **167 dias ou mais** (~5,5 meses, `PRICE_REVIEW_ALERT_DAYS`).

| Ação | Rota | Efeito |
|---|---|---|
| Mudar o preço | `PATCH /menu-items/:id/price` | atualiza `price` e `priceReviewedAt`; `priceUpdatedAt` só muda se o valor for diferente |
| "Não quero mudar" | `POST /menu-items/:id/price-review` | só `priceReviewedAt` |
| Listar avisos | `GET /menu-items/price-alerts` | pratos ativos com revisão vencida, os mais antigos primeiro |

Na Web, os avisos aparecem no **sino** do layout. Não existe "marcar como lida": o aviso some quando o preço é revisado e volta ~5,5 meses depois. "Rever preço" leva ao prato em **Previsões → Meu cardápio**, onde dá para simular e pedir sugestão à IA.

---

## Pratos nas vendas

Ao registrar uma entrada, o dono pode informar os pratos vendidos (`items: [{ menuItemId, qty }]`, até 30 pratos, 1–99 unidades cada).

- **Nome e preço vêm do cardápio, no servidor** (`resolveMovementItems`). O cliente nunca envia preço: assim ninguém forja o ranking de mais vendidos.
- O mesmo prato repetido na lista vira uma linha só, com as quantidades somadas.
- Prato de outro restaurante, inexistente ou **inativo** é recusado — exceto se já estava na venda que está sendo editada (dá para editar uma venda antiga sem tirar um prato que saiu do cardápio).
- O que fica gravado é uma **cópia** (`{ menuItemId, name, qty, unitPrice }`): reajustar ou renomear o prato não muda vendas passadas.
- A importação de planilha usa a mesma regra, com o cardápio carregado uma vez para o lote inteiro.

---

## "Vendidos no mês"

Calculado **na Web** (`aplicarVendidos`, em `cardapio.builder.ts`): unidades de cada prato nos **últimos 30 dias**, somadas das entradas não canceladas que informaram pratos. Ninguém digita.

Enquanto **nenhuma** venda da janela tiver pratos, vale o `soldPerMonth` digitado pelo dono, para a análise não esvaziar de uma vez quando o restaurante começa a informar pratos.

---

## Análise de cardápio (menu engineering)

A tela **Previsões → Meu cardápio** classifica os pratos pela matriz de Kasavana & Smith (1982), cruzando **popularidade** (vendidos) e **margem** (`(preço − custo) ÷ preço`) contra a **média** do cardápio:

| Grupo | Vendidos | Margem | Recomendação mostrada |
|---|---|---|---|
| **Melhores** (estrela) | ≥ média | ≥ média | proteja: mantenha qualidade e destaque |
| **Populares** (cavalo) | ≥ média | < média | ajuste preço ou baixe o custo |
| **Promissores** (quebra-cabeça) | < média | ≥ média | divulgue e sugira na venda |
| **Fracos** | < média | < média | repense receita, preço ou tire do cardápio |

- Só entra na análise o prato **ativo com custo e vendidos** informados; os outros aparecem como incompletos.
- **Simulador de preço:** mudar o preço de um prato recalcula a margem e as **médias**, então o prato simulado (e os outros) podem mudar de grupo na hora. Nada é gravado — mudar de fato é na tela Cardápio.
- **Sugestão da IA** (plano Pro): `POST /ai/price-suggestion` para o prato selecionado (ou o mais tempo sem mudar de preço); o preço sugerido vai para o simulador. Ver [IA](./ia.md).

> A análise roda no front, com dados que a API já entrega (cardápio + movimentações). Se outras telas precisarem dela, o cálculo deve migrar para uma query da API.

---

## Limites conhecidos

- O custo do prato é **digitado**; não há ficha técnica ligando prato a ingredientes nem a compras. Os [Workers](../workers/workers.md) coletam preço de ingrediente no atacado, mas ainda não estão integrados.
- "Vendidos no mês" depende de o dono informar os pratos nas vendas; vendas sem pratos não entram.
- As telas Receitas e Previsões ainda são montadas no front a partir do DRE (o domínio de vendas detalhado é pendência de negócio).

Ver também: [Movimentações](./movimento.md) · [Relatórios e métricas](./relatorios-e-metricas.md) · [Mapa telas → clients](../web/mapa-telas-clients.md).
