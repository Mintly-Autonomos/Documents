# 🖥️ MintlyWeb — documentação técnica do frontend

**Repo:** `Mintly-Autonomos/MintlyWeb` · **Stack:** Angular 21 (standalone) · Tailwind CSS 4 · RxJS · signals · [`mintly-lib`](../libs/mintly-lib.md) `2.27.0-preview` · exceljs (importação de planilha) · vitest · ESLint + Prettier · Node 24

Este documento descreve a estrutura atual e os **padrões que projetos Angular do Mintly devem seguir**.

---

## Estrutura de pastas

```
src/
  main.ts           # define process.env.BACK_END_URL antes do bootstrap (a lib lê daí)
  app/
    app.routes.ts   # rotas lazy + guards
    guards/         # auth, subscription, onboarding (+ guest e sessão expirada)
    interceptors/   # jwt.interceptor — Bearer + renovação do token no 401
    layout/         # app-layout (casca do app) e auth-shell (telas de login/cadastro)
    pages/          # uma pasta por tela, com rota lazy
      auth/         #   login, cadastro, onboarding, esqueci/redefinir senha, bloqueado, sessão expirada…
      assinatura/   #   planos, retorno do checkout e simulador de pagamento
      visao-geral/  #   painel do mês
      movimentacoes/#   lançamentos + importação de planilha
      contas/       #   contas financeiras
      categorias/   #   categorias e subcategorias
      cardapio/     #   pratos, preço e revisão de preço
      receitas/ · custos/ · fluxo-caixa/ · resultado/ · previsoes/   # relatórios
      conta/        #   minha conta, funcionários, exclusão
      legal/        #   termos e privacidade
      dev/          #   utilidades de desenvolvimento
    services/       # um service por domínio sobre o MintlyClientService (+ *.builder.ts para montar telas)
    shared/         # componentes, gráficos e utilitários reutilizáveis
    tutorial/       # tour guiado (overlay + passos)
    mocks/          # JSON usados quando environment.useMocks = true
  environments/     # apiUrl, mintlyEnv, useMocks por ambiente
```

**Regra de dependência:** `pages` → (`services`, `shared`, `layout`); `shared` não conhece `pages`. Cada page é autocontida — componentes usados por uma única página moram dentro dela.

## Rotas e guards

| Grupo | Guards | Telas |
|---|---|---|
| `/auth/*` | `guestGuard` (login, cadastro), `sessionExpiredGuard` | login, cadastro, esqueci-senha, redefinir-senha, token-invalido, bloqueado, sessao-expirada, logout |
| `/auth/onboarding` | `authGuard` + `subscriptionGuard` | primeiro acesso |
| `/assinatura` | `authGuard` | planos, retorno do pagamento, simulador |
| app (`''`) | `authGuard` + `subscriptionGuard` + `onboardingGuard` | visao-geral, movimentacoes, contas, categorias, cardapio, receitas, custos, fluxo-de-caixa, resultado, previsoes, conta |
| `/termos`, `/privacidade` | — | páginas legais |

- **`subscriptionGuard`:** sem assinatura válida leva à tela de assinatura. Se o estado guardado diz "inativa", confere com a API antes de barrar (uma assinatura paga em outro aparelho vale sem sair e entrar).
- **`onboardingGuard`:** enquanto `restaurants.firstAccessAt` for `null`, leva ao onboarding.

## Padrões Angular

- **Standalone components** (sem NgModules); rotas **lazy** por página com `loadComponent`/`loadChildren`.
- **Injeção via `inject()`** — é o padrão em todo o código (só um constructor injection restante).
- **Estado com signals** (`signal`, `computed`) nos services e componentes.
- **Formulários** com signals e `ngModel`; a validação espelha a política da [`mintly-lib`](../libs/mintly-lib.md) (ex.: `passwordSchema`: ≥8, 1 maiúscula, 1 minúscula, 1 número). Não há `ReactiveFormsModule` no código atual.
- **Nomenclatura**: arquivos `kebab-case`; seletores `app-*`; código em inglês, UI e nomes de pasta de página em PT-BR.

## Integração com a API

- **Contratos e clients vêm da `mintly-lib`** — tipos e clients HTTP não são redeclarados no front. O `MintlyClientService` guarda **uma** instância do `MasterClient` (criada sob demanda, depois que o `main.ts` define o `BACK_END_URL`), e cada service de domínio usa o client correspondente.
- **`env`**: todo request manda o header `env` = `environment.mintlyEnv` (hoje `staging` em todos os builds).
- **Sessão**: access token (15 min) + refresh token (7 dias, rotacionado). "Manter conectado" grava os tokens no `localStorage`; sem a opção, no `sessionStorage` (só a aba). As abas sincronizam pelo evento `storage`.
- **`jwt.interceptor`**: anexa `Authorization: Bearer` e, num 401 fora de `/auth/`, tenta um `refresh` (uma renovação por vez) e repete o request; se não renovar, leva a `/auth/sessao-expirada`.
- **402 `SUBSCRIPTION-0001`**: o `AuthService` trata como assinatura vencida com o app aberto e leva à tela de assinatura.
- **Erros**: `shared/api-error.ts` extrai `{ code, message, status }` do erro ([códigos](../api/erros.md)) e `api-error-message.ts` escolhe o texto da tela: a `message` que a API mandou; sem resposta, um aviso de conexão; 429 sem mensagem, "muitas tentativas"; senão, o texto padrão da tela. Atenção: os textos padrão do glossário da API estão em inglês; os erros de regra de negócio mandam mensagem própria em português.
- **Inatividade** (`idle-session.service.ts`): quem deixa o app aberto sem uso é deslogado e cai em `/auth/sessao-expirada?motivo=inatividade`.
- **Recuperação de senha:** o e-mail da API aponta para `FRONTEND_URL` + `/auth/redefinir-senha?token=…`.
- **Mocks:** com `useMocks: true` (só local, nunca commitado) os services leem `src/app/mocks/*.json` em vez da API.

## Identidade visual

Seguir o padrão do produto definido no épico de UX: **fintech moderna, minimalista, humanizada, desktop-first, com dark mode**. A UI é feita com **componentes próprios** em `shared/` (botão, chip, alerta, estado vazio, barra de filtros, gráficos de área/barra/donut…) estilizados com **Tailwind 4**. O tema claro/escuro é controlado pelo `theme.service.ts` (classe `.dark` no documento, preferência salva no `localStorage`). Tokens de cor centralizados (paleta verde mint do produto) — não espalhar hex soltos por componente.

> O `@angular/material` ainda está nas dependências, mas nenhum arquivo o importa.

## Qualidade

| Comando | O quê |
|---|---|
| `npm start` | `ng serve` (dev, porta 4200) |
| `npm run build` / `build:ci` / `build:staging` | build (CI usa `--configuration production`) |
| `npm test` / `test:ci` | **vitest** via `ng test` — 65 specs de componentes, services e utilitários |
| `npm run typecheck` | `tsc -p tsconfig.app.json --noEmit` |
| `npm run lint` / `format:check` | angular-eslint + Prettier (o CI exige os dois) |

CI (`ci.yml`): lint → format:check → typecheck → test:ci → build:ci.

Deploy manual (`deploy.yml`): `staging` → **Vercel**; `production` → **AWS (S3 + CloudFront)**. A `apiUrl` do build vem de `vars.API_URL` quando definida. Ver [Infraestrutura](../infra/infraestrutura.md).

Convenções de git, branches e TDD são as [gerais do projeto](../guias/convencoes.md).

## Checklist para página nova

1. Pasta em `pages/{feature}/` com rota lazy registrada (e os guards certos).
2. Tipos e client da `mintly-lib` via um service de domínio (sem contratos duplicados).
3. Formulário com validação alinhada à lib.
4. Estados de carregando/erro/vazio tratados (erro usando o envelope `{ code, message }` e o `api-error-message`).
5. Mock em `mocks/` se a tela precisar funcionar sem a API.
6. Testes vitest dos comportamentos da página.
7. Dark mode e responsivo verificados.
