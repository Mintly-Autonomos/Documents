# ADR-006 — Contratos compartilhados na mintly-lib, com Sapphire

**Status:** aceita (junho/2026; a lib trocou a biblioteca de validação anterior, Aurora, pelo Sapphire na v1.1.0)

## Contexto

API e front precisam concordar sobre o formato de cada dado, as regras de validação e as respostas. Declarar os tipos duas vezes faz os lados divergirem sem ninguém perceber.

## Decisão

- Um pacote npm próprio, **`mintly-lib`**, é a fonte única dos contratos: schemas, tipos, enums, regras puras compartilhadas (preço de plano, vencimento de repasse) e **clients HTTP** prontos para o front.
- Os schemas são escritos com **Sapphire** (`@ascendance-hub/sapphire-core`), e os tipos TypeScript são **inferidos** dos schemas (`Infer<typeof schema>`): validação e tipagem não divergem.
- A lib depende **só do `sapphire-core`**: nada de adaptador de banco, para não pesar no bundle do front.
- Regras entre campos viram **uniões discriminadas** (o Sapphire não tem `refine`).

## Alternativas consideradas

- **Tipos duplicados em cada repositório:** zero acoplamento, mas divergência garantida.
- **Gerar o client a partir do OpenAPI da API:** resolve os tipos de resposta, mas não compartilha validação nem regras puras.
- **Zod:** a opção mais popular para o mesmo papel. O Sapphire, mantido por membros do grupo, cobre o que o projeto precisa e pode ser corrigido e evoluído junto com ele (bugs encontrados no Mintly viram correção na própria biblioteca).

## Consequências

- ✅ Mudança de contrato aparece como erro de compilação nos dois lados.
- ✅ O front valida formulários com as mesmas regras da API.
- ⚠️ Toda mudança de contrato exige **publicar a lib e subir a versão** na API e na Web.
- ⚠️ **Dual package hazard:** a lib é CJS, e um `SapphireValidationError` lançado por ela pode ser de outra classe que a do consumidor — o handler da API checa também `error.name`.
- ⚠️ Os testes da lib não rodam no CI hoje.

Ver: [mintly-lib](../libs/mintly-lib.md) · [Bibliotecas externas](../libs/bibliotecas-externas.md).
