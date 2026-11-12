# 🗺️ MintlyWeb — mapa telas → clients → rotas

Qual tela chama qual service, qual método da [mintly-lib](../libs/mintly-lib.md) e qual rota da API. Serve para medir o impacto de uma mudança ("se eu mudar `PATCH /financial-accounts/:id`, quais telas quebram?") e completa o [Mapa de domínio](../api/mapa-de-dominio.md) da API.

**Caminho de toda chamada:** página → service de domínio (`src/app/services/`) → `MintlyClientService.client` (um `MasterClient`) → client da lib → rota. Os services montam os headers (`env` + `Authorization`) e tratam o envelope; as páginas nunca chamam a lib direto.

---

## Telas

| Tela (rota) | Services | Client · método → rota |
|---|---|---|
| **Login** (`/auth/login`) | `auth` | `authClient.login` → `POST /auth/login` |
| **Cadastro** (`/auth/cadastro`) | `auth` | `authClient.signup` → `POST /auth/signup` (com foto opcional) |
| **Esqueci a senha** · **Redefinir senha** | `auth` | `authClient.forgotPassword` → `POST /auth/forgot-password` · `authClient.resetPassword` → `POST /auth/reset-password` |
| **Onboarding** (`/auth/onboarding`) | `contas`, `categorias`, `restaurante` | lê contas e categorias criadas no cadastro (`GET /financial-accounts`, `GET /financial-categories`); ao concluir, `restaurantClient.completeFirstAccess` → `POST /restaurants/me/first-access` |
| **Assinatura** (`/assinatura`, `/retorno`, `/simulador`) | `subscription`, `auth` | `subscriptionClient.overview` → `GET /subscription` · `checkout` → `POST /subscription/checkout` · `cancelRenewal` → `POST /subscription/cancel-renewal` · `mockDecide` / `mockChargeNext` → `POST /subscription/mock/*` |
| **Visão Geral** (`/visao-geral`) | `dashboard`, `ai`, `notifications` | `dashboardClient.overview` → `GET /dashboard/overview` · `aiClient.insights` / `usage` → `POST /ai/insights`, `GET /ai/usage` |
| **Movimentações** (`/movimentacoes`) | `movimentacoes`, `contas`, `categorias`, `cardapio` | `financialMovementClient.list` → `GET /financial-movements` · `register` → `POST /` · `updateMovement` → `PATCH /:id` · `changeStatus` → `PATCH /:id/status` · `importMovements` → `POST /import` (planilha lida no front com exceljs) |
| **Contas** (`/contas`) | `contas` | `financialAccountClient.findAll` · `insert` · `update` · `defaultUpdate` → `PATCH /:id/default` · `inactivateUpdate` → `PATCH /:id/inactivate` |
| **Categorias** (`/categorias`) | `categorias` | `financialCategoryClient.findAll` · `insert` · `update` · `inactivateUpdate` / `reactivateUpdate` · `addSubcategory` / `updateSubcategory` / `inactivateSubcategory` / `reactivateSubcategory` → `/financial-categories/:id/subcategories…` |
| **Cardápio** (`/cardapio`) | `cardapio`, `movimentacoes` | `menuItemClient.findAll` · `insert` · `update` · `updatePrice` → `PATCH /:id/price` · `keepPrice` → `POST /:id/price-review` · `inactivateUpdate` / `reactivateUpdate`; "vendidos no mês" vem das movimentações |
| **Receitas** (`/receitas`) | `receitas` | `reportClient.result` → `GET /reports/result` + montagem no front (`receitas.builder.ts`) |
| **Custos & Despesas** (`/custos`) | `custos` | `reportClient.expenses` → `GET /reports/expenses` (nova chamada a cada filtro de canal) |
| **Fluxo de Caixa** (`/fluxo-de-caixa`) | `fluxo-caixa` | `reportClient.cashFlow` → `GET /reports/cash-flow` |
| **Resultado** (`/resultado`) | `resultado`, `restaurante` | `reportClient.result` → `GET /reports/result` · `restaurantClient.me` / `updateMe` (regime tributário) |
| **Previsões** (`/previsoes`, inclui "Meu cardápio") | `previsoes`, `cardapio`, `ai` | `reportClient.result` + `previsoes.builder.ts` · cardápio para a análise · `aiClient.priceSuggestion` → `POST /ai/price-suggestion` |
| **Minha conta** (`/conta`) | `conta`, `auth` | `userClient.getMe` / `updateMe` / `changeEmail` / `changePassword` → `/users/me…` · `restaurantClient.me` / `updateMe` · `listMembers` / `createMember` / `updateMember` → `/restaurants/me/members…` · `requestDeletion` / `cancelDeletion` → `/restaurants/me/deletion-request` · `personClient.updateMyAvatar` / `removeMyAvatar` → `/people/me/avatar` |

## Peças fora das páginas

| Peça | Services | Chamadas |
|---|---|---|
| **Layout** (casca do app) | `auth`, `conta`, `notifications`, `theme` | foto do usuário (`personClient.getAvatarByUsername` → `GET /people/avatar/:username`), sino de avisos |
| **Sino de avisos** (`notifications`) | `cardapio`, `auth` | `menuItemClient.priceAlerts` → `GET /menu-items/price-alerts` (preço parado), assinatura perto de vencer (do estado do login) e itens de "O que fazer primeiro" |
| **Guards** | `auth`, `subscription`, `restaurante` | `subscriptionGuard` confere `GET /subscription` quando o estado guardado diz "inativa"; `onboardingGuard` lê `GET /restaurants/me` (`firstAccessAt`) |
| **Interceptor + `auth`** | `auth` | `authClient.refresh` → `POST /auth/refresh` num 401; `authClient.logout` → `POST /auth/logout` |
| **Inatividade** (`idle-session`) | — | encerra a sessão local; não chama a API |

---

## Por rota (impacto de mudança)

| Rota da API | Usada por |
|---|---|
| `GET /reports/result` | Resultado, Receitas, Previsões |
| `GET /restaurants/me` | Resultado, Minha conta, `onboardingGuard` |
| `GET /financial-movements` | Movimentações, Cardápio (vendidos no mês) |
| `GET /financial-accounts` · `GET /financial-categories` | Contas/Categorias, Movimentações (formulário), Onboarding |
| `GET /menu-items` | Cardápio, Movimentações (pratos na venda), Previsões |
| `GET /menu-items/price-alerts` | sino de avisos |
| `GET /subscription` | Assinatura, `subscriptionGuard` |
| `POST /auth/refresh` | interceptor (toda tela) |

> Ao mudar o **contrato** de uma dessas rotas, mude primeiro o tipo na mintly-lib, publique, suba a versão na API e na Web e rode os testes dos services listados.
