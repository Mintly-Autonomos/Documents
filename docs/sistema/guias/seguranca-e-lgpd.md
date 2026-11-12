# 🔒 Segurança e LGPD

Quais dados pessoais o Mintly guarda, onde, por quanto tempo, com quem compartilha, quais controles de segurança existem e o que ainda falta para cumprir o que a [Política de Privacidade](#o-que-a-política-promete-e-o-que-o-sistema-faz) do app promete.

> Este documento descreve o **sistema**, não é parecer jurídico. A política publicada fica em `MintlyWeb/src/app/pages/legal/privacidade.component.ts` (rota `/privacidade`).

---

## Inventário de dados pessoais

| Dado | Onde | De quem | Para quê | Retenção |
|---|---|---|---|---|
| nome, telefone | `people` | dono e funcionários | cadastro, tela "minha conta" | enquanto a conta existir |
| foto de perfil (data URL, até 1 MB) | `people.avatar` | quem enviar | identificação no app | até a pessoa remover |
| e-mail | `users` | dono e funcionários | login e recuperação de senha | enquanto a conta existir |
| hash da senha (scrypt) | `users.passwordHash` | dono e funcionários | autenticação | enquanto a conta existir |
| último acesso, tentativas de login, bloqueio | `users` | dono e funcionários | segurança (lockout) | enquanto a conta existir |
| IP e navegador (user agent) | `audit_logs` (`login`, `login_failed`) | quem tenta entrar | segurança e investigação de acesso | **365 dias** (TTL) |
| eventos de conta (troca de e-mail/senha, foto, funcionários, exclusão + motivo) | `audit_logs` | dono e funcionários | trilha de auditoria | **365 dias** (TTL) |
| sessões (refresh token em hash, claims com nome e e-mail) | `valkyrie_refresh_tokens` | quem está logado | manter a sessão | sem TTL próprio (expiram em 7 dias, mas o documento fica) |
| token de recuperação de senha (sha256) | `password_reset_tokens` | quem pediu | reset de senha | apagado ao expirar (TTL, 1 h) |
| nome de clientes/fornecedores digitados | `financial_movements.counterparty` | terceiros do restaurante | identificar a contraparte do lançamento | enquanto a conta existir |
| dados de pagamento | `payments` (só plano, valor, status e ids do provedor) | dono | cobrança da assinatura | enquanto a conta existir |

**O que o Mintly não guarda:** número de cartão ou dados bancários (ficam no Mercado Pago), senha em texto aberto, token de reset em texto aberto, CPF.

Os dados do negócio (lançamentos, contas, categorias, cardápio) não são dados pessoais em si, mas são do restaurante e seguem as mesmas regras de isolamento.

---

## Com quem os dados são compartilhados

| Serviço | O que recebe | Quando |
|---|---|---|
| **MongoDB Atlas** | todos os dados (armazenamento) | sempre |
| **Vercel / AWS** | dados em trânsito (hospedagem da API e da Web) | sempre |
| **Gmail (SMTP)** | e-mail do usuário e o link de recuperação | pedido de recuperação de senha |
| **Mercado Pago** | valor, plano, referência do pagamento; o pagador informa os próprios dados na página do Mercado Pago | checkout da assinatura |
| **Anthropic ou Google** (IA) | nome do restaurante, números dos relatórios, nomes de categorias e de pratos — **sem** nome, e-mail ou telefone de pessoas | plano Pro, ao pedir textos ou sugestão de preço |

O log da API registra só o tipo de erro da IA, nunca o conteúdo enviado.

---

## Controles de segurança

| Área | Controle |
|---|---|
| **Senha** | scrypt com salt por senha, comparação em tempo constante; política mínima (≥ 8, maiúscula, minúscula, número) — [ADR-007](../decisoes/adr-007-senha-scrypt.md) |
| **Força bruta** | bloqueio temporário após 5 erros (15 min), também na confirmação da senha atual |
| **Enumeração de contas** | login devolve o mesmo 401 (com o mesmo tempo de resposta) para e-mail inexistente; recuperação responde 202 sempre; status da conta só é revelado a quem acertou a senha |
| **Sessão** | access token criptografado de 15 min, refresh de 7 dias com rotação e detecção de reuso; revogação de todas as sessões ao trocar/resetar senha, inativar funcionário ou rebaixar plano — [ADR-008](../decisoes/adr-008-sessao-valkyrie-jwt.md) |
| **Ação sensível** | trocar e-mail, trocar senha e pedir exclusão exigem a senha atual |
| **Isolamento entre restaurantes** | `restaurantId` só do JWT, injetado em toda consulta (`withTenant`); rotas de "minha conta" usam `/me`; ações de dono checam `role = owner` — [ADR-003](../decisoes/adr-003-multi-tenant-hibrido.md) |
| **Entrada** | validação por schema (objetos estritos recusam campo extra — sem *mass assignment*); filtros de listagem sem operadores Mongo (sem NoSQL injection); limite de 2 MiB no corpo |
| **Navegador** | CORS por allowlist (`CORS_ORIGINS`); `Content-Security-Policy` em toda resposta; texto da IA mostrado como texto puro, nunca HTML |
| **Pagamento** | webhook não concede nada sem reconsultar o provedor; assinatura HMAC do aviso — [ADR-011](../decisoes/adr-011-pagamento-reconsultado.md) |
| **Segredos** | variáveis no GitHub Secrets, sincronizadas no deploy; Swagger desligado em produção; e-mail em produção nunca cai no console |
| **Rotas administrativas** | `/admin/*` só existe com `ADMIN_API_KEY` e compara a chave em tempo constante |
| **Auditoria** | eventos de acesso e de conta em `audit_logs`, com expiração em 365 dias |

---

## Direitos do titular × o que o sistema oferece

| Direito (LGPD, art. 18) | Como é atendido hoje |
|---|---|
| Confirmar e acessar os dados | tela **Minha conta** (`GET /users/me`) e as telas do app; não há exportação completa |
| Corrigir | Minha conta: nome, telefone, e-mail, senha, foto |
| Eliminar | **pedido** de exclusão pelo app (`POST /restaurants/me/deletion-request`); a foto pode ser removida na hora |
| Portabilidade | importação de planilha existe; **exportação não** |
| Revogar consentimento | remover a foto; os demais dados são necessários ao contrato |

---

## O que a política promete e o que o sistema faz

| A política diz | Situação no código |
|---|---|
| "Quando você pede a exclusão da conta, os dados são apagados depois do prazo de confirmação" | ⚠️ **Não implementado.** O pedido só grava `restaurants.deletionRequestedAt`; não há prazo definido nem rotina de exclusão. Hoje a exclusão seria manual ([Runbook](../infra/runbook.md#pedido-de-exclusão-de-restaurante)) |
| "Pedir a portabilidade" | ⚠️ **Não há exportação** dos dados; atender exigiria extração manual |
| Equipe convidada: "nome, e-mail e telefone" | ℹ️ Funcionários são criados com nome e e-mail; o telefone fica vazio até a pessoa preencher |
| Registro de IP e aparelho para segurança | ✅ `audit_logs` de login, com expiração em 365 dias |
| Dados de cartão ficam com o provedor | ✅ |
| IA recebe só números e nomes de pratos/categorias | ✅ (inclui o nome do restaurante) |

### Pendências recomendadas

1. **Rotina de exclusão:** definir o prazo de confirmação e implementar a exclusão em cascata (restaurante, usuários, pessoas, lançamentos, cardápio, pagamentos — respeitando o que a lei obriga a manter), com registro do que foi apagado.
2. **Exportação dos dados** do restaurante e do usuário (ex.: planilha ou JSON) para portabilidade.
3. **TTL em `valkyrie_refresh_tokens`** expirados, para não guardar sessões antigas indefinidamente.
4. **Retenção depois do fim da assinatura:** a política diz que os dados ficam para a pessoa voltar; vale definir um limite.
5. **Encarregado (DPO) e canal de contato** formal — a política hoje aponta para o suporte do app.

---

## Ao criar uma funcionalidade nova

- Dado pessoal novo? Atualize o **inventário** acima e a política de privacidade.
- Vai mandar dado para um serviço externo? Mande só o necessário, registre na tabela de compartilhamento e não logue o conteúdo.
- Toda consulta passa pelo `restaurantId` do contexto; ação de dono checa `role`.
- Rota que muda credencial ou apaga dados pede a senha atual e gera evento em `audit_logs`.

Ver também: [Auth & sessão](../api/auth.md) · [Decisões de arquitetura](../decisoes/README.md) · [Convenções → Segurança](./convencoes.md).
