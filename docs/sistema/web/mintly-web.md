# 🖥️ MintlyWeb — documentação técnica do frontend

**Repo:** `Mintly-Autonomos/MintlyWeb` · **Stack:** Angular (standalone) · Angular Material + CDK · Tailwind CSS · RxJS · vitest · ESLint + Prettier

Este documento descreve a estrutura atual e os **padrões que projetos Angular do Mintly devem seguir**.

---

## Estrutura de pastas

```
src/
  app/
    guards/         # CanActivate etc. — proteção de rotas (sessão, papéis)
    interceptors/   # HttpInterceptors — Authorization Bearer, env, tratamento de erro
    layout/         # casca da aplicação (shell, header, navegação)
    pages/          # uma pasta por página/feature, com rotas lazy
      auth/         #   login, cadastro, recuperação de senha
      contas/       #   contas financeiras
      categorias/   #   categorias financeiras
      movimentacoes/#   movimentações
      dev/          #   utilidades de desenvolvimento
    services/       # acesso a dados e estado compartilhado
    shared/         # componentes/pipes/diretivas reutilizáveis
  environments/     # configuração por ambiente (apiUrl etc.)
```

**Regra de dependência:** `pages` → (`services`, `shared`, `layout`); `shared` não conhece `pages`. Cada page é autocontida — componentes usados por uma única página moram dentro dela.

## Padrões Angular

- **Standalone components** (sem NgModules); rotas **lazy** por página com `loadComponent`/`loadChildren`.
- **Injeção via `inject()`** em vez de constructor injection nos novos códigos.
- **Sinais/`OnPush`**: estado local com signals; `ChangeDetectionStrategy.OnPush` como padrão em componentes de apresentação.
- **Formulários reativos** (`ReactiveFormsModule`) — validação espelhando a política da [`mintly-lib`](../libs/mintly-lib.md) (ex.: `passwordSchema`: ≥8, 1 maiúscula, 1 minúscula, 1 número).
- **Nomenclatura**: arquivos `kebab-case` (`login-page.component.ts`); seletores `app-*`; código em inglês (UI em PT-BR).

## Integração com a API

- **Contratos e clients vêm da `mintly-lib`** — tipos (`User`, `LoginResult`…) e clients HTTP (`AuthClient`, `FinancialAccountClient`…) não devem ser redeclarados no front.
- **Sessão**: a API emite **access token (15min) + refresh token (7 dias, rotacionado)**. Guardar o par com cuidado; renovar via `POST /auth/refresh` quando o access expirar (interceptor), e tratar 401 de refresh como logout.
- **Interceptors**: um para anexar `Authorization: Bearer`, um para erros — o envelope de erro da API é `{ code, message }` ([códigos](../api/mintly-api.md)); mapear `AUTH-0004` (lockout) e `VALIDATION_ERROR` (com `details` por campo) para mensagens de UI.
- **Guards**: rotas internas exigem sessão; `/auth/*` é público. A rota do link de recuperação é `/auth/redefinir-senha?token=…` (o e-mail enviado pela API aponta para `FRONTEND_URL` + esse caminho).
- **`environments/`** define `apiUrl` por ambiente — nunca hardcodar URL em service.

## Identidade visual

Seguir o padrão do produto definido no épico de UX: **fintech moderna, minimalista, humanizada, desktop-first, com dark mode**. Material fornece os componentes de base; Tailwind cuida de layout/espaçamento. Tokens de cor centralizados (paleta verde mint do produto) — não espalhar hex soltos por componente.

## Qualidade

| Comando | O quê |
|---|---|
| `npm start` | `ng serve` (dev, porta 4200) |
| `npm run build` / `build:ci` | build (CI usa `--configuration production`) |
| `npm test` / `test:ci` | **vitest** — componentes e services com testes unitários; lógica de template fina, lógica de verdade em service/signal testável |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` / `format:check` | angular-eslint + Prettier (CI deve exigir ambos) |

Convenções de git, branches e TDD são as [gerais do projeto](../guias/convencoes.md).

## Checklist para página nova

1. Pasta em `pages/{feature}/` com rota lazy registrada.
2. Tipos e client da `mintly-lib` (sem contratos duplicados).
3. Formulários reativos com validação alinhada à lib.
4. Estados de carregando/erro/vazio tratados (erro usando o envelope `{ code, message }`).
5. Testes vitest dos comportamentos da página.
6. Dark mode e responsivo verificados.
