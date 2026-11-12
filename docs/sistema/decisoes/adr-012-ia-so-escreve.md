# ADR-012 — A IA só escreve: números e limites vêm do servidor

**Status:** aceita (novembro/2026)

## Contexto

O plano Pro inclui IA para personalizar os textos dos insights e sugerir reajuste de preço. Modelos de linguagem erram contas, podem inventar números e são vulneráveis a instruções escondidas nos dados. Cada chamada também custa dinheiro.

## Decisão

- **Os números nunca vêm da IA:** relatórios e cardápio calculam tudo; a IA só reescreve o texto a partir desses fatos. Na sugestão de preço, o valor proposto é **ajustado pelo servidor** para ficar entre o preço atual e +20%.
- **Os fatos são montados no servidor**, a partir do token; o cliente só diz a tela, o mês ou o prato.
- **Dados de pessoas higienizados** e enviados num bloco `<dados>` que o prompt manda tratar como texto, nunca como instrução.
- **Saída conferida:** só texto simples, dentro do limite de palavras; o que não serve é descartado e o front mostra o texto padrão.
- **Custo controlado:** só no Pro, 20 chamadas por restaurante por dia, cache do mesmo texto no mesmo dia, falha da IA não gasta chamada.
- **Provedor trocável** por variável (`claude` ou `gemini`).

## Alternativas consideradas

- **Deixar a IA calcular e explicar:** mais flexível, mas números errados num app financeiro destroem a confiança.
- **Textos só por template:** sem custo e sem risco, mas genéricos — a IA é o diferencial do plano Pro.

## Consequências

- ✅ Um texto ruim da IA no máximo some; nunca mostra um número errado.
- ✅ Falha ou ausência do provedor não quebra o app.
- ⚠️ Os textos dependem da qualidade do prompt; mudar o prompt exige subir a versão (`AI_PROMPT_VERSION`) para invalidar o cache.
- ℹ️ A visão maior (um agente que cruza dados internos com preços externos dos Workers) ainda não existe; esta é a primeira camada.

Ver: [IA do Mintly](../api/ia.md).
