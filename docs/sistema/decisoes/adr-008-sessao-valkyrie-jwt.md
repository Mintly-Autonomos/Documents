# ADR-008 — Sessão com valkyrie-jwt: token criptografado e refresh rotacionado

**Status:** aceita (junho/2026)

## Contexto

A API é stateless (roda em serverless na staging), mas precisa encerrar sessões (logout, troca de senha, funcionário inativado) e limitar o estrago de um token vazado.

## Decisão

Sessão pela **valkyrie-jwt**, biblioteca de um membro do grupo:

- **Access token curto (15 min)**, **criptografado** (`ValkyrieTokenProtection.Encrypted`): o conteúdo não é legível sem a chave.
- **Refresh token de 7 dias com rotação:** cada renovação emite um par novo e invalida o anterior; reutilizar um refresh já trocado é detectado e a família inteira é negada.
- Refresh tokens, chaves e eventos guardados no **banco do ambiente** (`valkyrie_*`), o que permite revogar.
- O `refresh` **reconsulta o usuário**: quem foi desativado depois do login não renova.

## Alternativas consideradas

- **JWT assinado comum (aberto) e sem refresh:** simples, mas o conteúdo fica legível e não há como encerrar a sessão antes de expirar.
- **Sessão no servidor (cookie + tabela de sessões):** revogação imediata, mas exige consulta a cada request e não combina com o front em domínio separado consumindo uma API por header.
- **Provedor de identidade externo:** tira a responsabilidade do projeto, mas adiciona custo e dependência para um requisito simples (e-mail e senha).

## Consequências

- ✅ Revogação de todas as sessões de um usuário com um `updateMany` (`revokeAllSessions`).
- ✅ Token vazado vale no máximo 15 minutos.
- ⚠️ Revogar não derruba o access token já emitido: ele vale até expirar.
- ⚠️ A sessão depende de uma biblioteca do grupo (versão `0.1.1`): bug nela é bug do Mintly.

Ver: [Auth & sessão](../api/auth.md) · [Bibliotecas externas](../libs/bibliotecas-externas.md).
