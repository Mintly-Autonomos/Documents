# ADR-013 — O ambiente decide a nuvem

**Status:** aceita — production ainda não foi ativado

## Contexto

O projeto precisa de um ambiente de testes barato e fácil de publicar, e de um ambiente de produção com processo de longa duração, sem limite de tempo por request e com conexão estável ao banco.

## Decisão

- **staging → Vercel** (serverless), a partir da branch `staging`; **production → AWS** (EC2 para a API, S3 + CloudFront para a Web), a partir da `main`.
- O workflow de deploy é **manual** e recebe só o **ambiente**; não existe input de nuvem. Não há como subir production na Vercel por engano.
- A API tem dois pontos de entrada: `api/index.ts` (serverless, conexão cacheada por cold start) e `src/server.ts` (processo com `listen()`).
- Variáveis vivem no GitHub e são sincronizadas a cada deploy; as obrigatórias fazem o deploy falhar se faltarem.

## Alternativas consideradas

- **Tudo na Vercel:** um só caminho, mas serverless impõe limite de tempo, cold start e um pool de conexões por instância contra o Atlas.
- **Tudo na AWS:** ambientes idênticos, mas staging fica mais caro e mais lento de publicar.

## Consequências

- ✅ Staging barato e publicado em minutos.
- ✅ Production com processo contínuo (cache de conexão estável, sem cold start).
- ⚠️ Dois caminhos de execução: o código serverless tem particularidades (corpo já parseado pela Vercel, reconexão do Mongo, `NODE_ENV=production` mesmo em staging) que não aparecem no outro.
- ⚠️ O que funciona em staging não prova que funciona em production; o primeiro deploy real de production ainda está pendente.

Ver: [Infraestrutura](../infra/infraestrutura.md).
