# ADR-007 — Hash de senha com scrypt

**Status:** aceita (junho/2026) — **substitui** a decisão anterior pelo argon2id, registrada no refinamento da MIN-58

## Contexto

Senhas precisam ser guardadas com uma função de derivação lenta e resistente a força bruta. No refinamento das histórias de cadastro (MIN-58) o argon2id chegou a ser decidido; na implementação, a decisão mudou.

## Decisão

**scrypt** do módulo nativo `node:crypto` (`scryptSync` com os parâmetros de custo padrão do Node: N = 16384, r = 8, p = 1), com **salt aleatório de 16 bytes por senha**, chave de 64 bytes, guardado como `salt:hash` (hex). Comparação em **tempo constante** (`timingSafeEqual`). Fonte única em `app/auth/password-hash.ts`.

## Alternativas consideradas

- **argon2id:** vencedor da Password Hashing Competition e a recomendação mais citada hoje. Foi descartado em favor do scrypt; o motivo não ficou registrado. Uma diferença prática é que o argon2 em Node depende de um pacote com binário nativo, enquanto o scrypt vem no próprio `node:crypto`.
- **bcrypt:** amplamente usado, mas limita a senha a 72 bytes e também depende de pacote externo.

## Consequências

- ✅ Sem dependência externa nem compilação nativa (importa em deploy serverless).
- ✅ Também resistente a ataque com hardware dedicado (scrypt é *memory-hard*).
- ⚠️ Os parâmetros não ficam gravados junto do hash: aumentar o custo no futuro exige mudar o formato (ex.: `N:salt:hash`) para continuar reconhecendo as senhas antigas.
- ⚠️ O comentário de refinamento da MIN-59 ainda cita argon2id — está desatualizado.

Ver: [Auth & sessão](../api/auth.md#senha--hashing).
