# 🛰️ Workers — coleta de dados externos

**Repo:** `Mintly-Autonomos/Workers` · **Stack:** Node + TypeScript · vitest · ts-node · **Branch:** `main` (última alteração em maio/2026)

Os Workers coletam **dados de mercado de fontes públicas** — preço de hortifruti no atacado e inflação de alimentos — e os entregam num formato único (`MarketPrice`). São a base da visão de produto de um agente que entende o restaurante combinando **dados externos** com os **dados internos** (movimentações, cardápio).

> **Estado atual:** os dois workers coletam e normalizam, mas **ainda não estão ligados ao resto do sistema**. Não gravam no MongoDB, não rodam agendados e a API não os consome. A [IA](../api/ia.md) que existe hoje usa só dados internos.

---

## Os workers

Cada worker é um pacote independente (pasta própria, `package.json` próprio), com o mesmo desenho: **client** (busca) → **parser** (lê o formato da fonte) → **normalizer** (filtra e converte para `MarketPrice`) → **worker** (orquestra e devolve `WorkerResult`).

| Worker | Fonte | O que traz | Frequência da fonte |
|---|---|---|---|
| `sidra/` | **IBGE — SIDRA**, tabela 7060 (IPCA) | variação mensal (%) dos preços de grupos de alimentos, Brasil | mensal (IBGE publica por volta do dia 10) |
| `conab/` | **CONAB — PROHORT** (`ProhortMensal.txt`) | preço médio de hortifruti no atacado nas CEASAs de SP | mensal (arquivo cumulativo desde 2021) |

### SIDRA (IPCA alimentar)

- Consulta a API REST `apisidra.ibge.gov.br` — tabela **7060**, variável **63** (variação mensal), nível Brasil, **últimos 12 meses**.
- Categorias (classificação 315): grupo alimentação, alimentação no domicílio, carnes, carne de boi, carne de suíno, aves e ovos, óleos e gorduras, cereais e leguminosas, farinhas e massas, alimentação fora do domicílio.
- Cada registro vira um `MarketPrice` com `preco` = **variação percentual**, `unidade: '%'`, `regiao: 'BR'`.

### CONAB / PROHORT (hortifruti no atacado)

- Baixa o arquivo TXT (`;`, **Latin-1**) e o lê **em streaming**, linha a linha (o arquivo é grande e cumulativo). O cabeçalho é conferido contra os campos esperados, validados em maio/2026.
- **Filtros:**
  - CEASAs: CEAGESP (São Paulo) e CEASA Campinas;
  - produtos: alface, alho, alho-poró, batata, batata-doce, cebola, cebolinha, gengibre, limão, ovos (granja e codorna), pimenta, pimentão e tomate. O PROHORT só cobre hortifruti: frango, óleo e arroz **não** estão lá;
  - só os **12 meses mais recentes** do arquivo.
- Agrega por ano × mês × CEASA × ingrediente e calcula o **preço médio ponderado por volume** (`valor comercializado ÷ kg comercializados`). Agregações com menos de 100 kg são descartadas.
- Saída: `unidade: 'R$/kg'`, `regiao: 'SP'` ou `'SP-Campinas'`, com volume e valor total em `metadados`.

---

## Formato de saída

```ts
interface MarketPrice {
  ingrediente: string        // "tomate", "aves_ovos"…
  preco: number              // R$/kg (CONAB) ou variação % (SIDRA)
  unidade: string            // "R$/kg" | "%"
  fonte: 'CEAGESP' | 'CONAB' | 'SIDRA'
  data: Date                 // mês de referência
  regiao: string             // "SP", "SP-Campinas", "BR"
  metadados?: { ceasa?, produtoOriginal?, volumeKg?, valorTotal?, … }
}

interface WorkerResult {
  fonte: string
  coletadoEm: Date
  registros: MarketPrice[]
  erros: string[]            // problemas por registro; erro fatal vira um item aqui e registros = []
  arquivoBruto?: string      // caminho do arquivo original salvo
}
```

> Os nomes dos campos estão em português, diferente da convenção do resto do Mintly (código em inglês). Alinhar quando o dado for gravado no banco.

### Arquivo bruto

Cada execução guarda a resposta original em `RAW_DATA_DIR` (padrão `./data/raw`), em `market/<fonte>/<AAAA-MM>/<fonte>-<timestamp>.<ext>`. Serve para auditar e reprocessar sem baixar de novo. O worker da CONAB aceita `arquivoLocal` (processar um arquivo já baixado) e `manterBruto`.

---

## Como rodar

```bash
cd sidra && npm install && npm start     # imprime o WorkerResult em JSON
cd conab && npm install && npm start
npm test                                  # vitest (parser, normalizer e worker, com mocks das fontes)
```

`conab/scripts/run-and-dump.ts` roda o worker e resume o resultado (registros por ingrediente, período e CEASA, preço mais recente de cada ingrediente e tempo de execução), para inspeção.

---

## Próximos passos para integrar

1. **Persistência:** gravar os `MarketPrice` numa coleção (ex.: `market_prices`, global ou no banco `app`, já que não é dado de restaurante), com índice por fonte × ingrediente × data.
2. **Agendamento:** rodar mensalmente (GitHub Actions, como o `settle.yml` da API).
3. **Consumo:** expor na API e cruzar com o cardápio e o CMV — por exemplo, avisar quando um ingrediente usado nos pratos subiu no atacado, ou alimentar a sugestão de preço da IA.
4. **CEAGESP:** a fonte já está prevista no tipo (`fonte: 'CEAGESP'`), mas ainda não tem worker.

Especificações originais: `specs/spec-worker-sidra-ibge.md` e `specs/spec-worker-conab-prohort.md` no repositório.
