# Jornada do usuário (exemplo Mermaid)

Este documento é um teste do render de **Mermaid**. Abaixo, um diagrama de
sequência de um login simplificado e um fluxograma de ingestão de dados.

## Login (diagrama de sequência)

```mermaid
sequenceDiagram
  participant U as Usuário
  participant W as MintlyWeb
  participant A as MintlyApi
  participant DB as MongoDB
  U->>W: abre o app
  W->>A: POST /login
  A->>DB: busca usuário
  DB-->>A: dados do usuário
  A-->>W: token de sessão
  W-->>U: mostra o dashboard
```

## Ingestão de dados (fluxograma)

```mermaid
flowchart TD
  A[Workers: ingestão] --> B{Validação Sapphire}
  B -->|válido| C[(MongoDB)]
  B -->|inválido| D[Descarta e loga]
```

Se os diagramas acima aparecem desenhados (e não como bloco de código), o
Mermaid está funcionando. 🎉
