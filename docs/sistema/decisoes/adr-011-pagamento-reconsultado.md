# ADR-011 — Pagamento só vale depois de reconsultado no provedor

**Status:** aceita (outubro/2026, assinatura)

## Contexto

O acesso ao Mintly depende de assinatura paga. A confirmação chega por **webhook** — uma rota pública que qualquer um pode chamar — e o provedor pode reenviar o mesmo aviso várias vezes ou fora de ordem.

## Decisão

- **O aviso nunca vale por si:** ele só diz "olhe o pagamento X". A API **reconsulta o pagamento no provedor** com o próprio token e **confere o valor** com o cobrado antes de liberar qualquer dia.
- **Uma vez só por pagamento:** marca `appliedAt` e índice único em `providerPaymentId`; o tempo concedido (`grantedMs`) fica gravado para o estorno descontar exatamente ele.
- **Preço sempre recalculado no servidor** a partir da tabela da lib.
- **Dias fixos** por plano (30/90/180/360), não meses de calendário.
- **Provedor atrás de uma interface** (`PaymentProvider`), com um simulador que segue o mesmo caminho do provedor real a partir do aviso; sem configuração em produção, **falha fechada** (não cai no simulador).

## Alternativas consideradas

- **Confiar no conteúdo do webhook validado só pela assinatura (HMAC):** funciona enquanto o segredo estiver certo e configurado; um segredo vazado ou ausente liberaria acesso. A assinatura é validada quando existe, mas a reconsulta é a defesa principal.
- **Confiar na volta do navegador** (página de retorno do checkout): trivial de forjar.
- **Meses de calendário:** o mesmo plano daria acessos de tamanhos diferentes conforme o mês da compra.

## Consequências

- ✅ Webhook forjado, repetido ou fora de ordem não concede nada.
- ✅ Estorno desconta exatamente o que o pagamento deu, mesmo depois de trocas de plano.
- ✅ Dá para testar o fluxo inteiro sem cobrar ninguém (simulador).
- ⚠️ Cada aviso custa uma chamada ao provedor; se ele estiver fora, a API responde 500 e o provedor reenvia depois.

Ver: [Assinatura e pagamentos](../api/assinatura-e-pagamentos.md).
