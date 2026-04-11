# UNAFIT — Diagrama de Relacionamento de Tabelas

## Diagrama ER (Mermaid)

```mermaid
erDiagram

    academias {
        uuid id PK
        text nome
        text slug UK
        text asaas_api_key
        bool ativo
    }

    profiles {
        uuid id PK "FK → auth.users"
        uuid academia_id FK
        user_role role
        text nome_completo
        text asaas_cliente_id
        bool ativo
    }

    wods {
        uuid id PK
        uuid academia_id FK
        text nome
        text mobilidade
        text aquecimento
        text treino
        score_type score_type
    }

    aulas_agenda {
        uuid id PK
        uuid academia_id FK
        uuid wod_id FK
        date data_aula
        time horario_inicio
        time horario_fim
        int  capacidade_max
    }

    checkins {
        uuid id PK
        uuid academia_id FK
        uuid aula_id FK
        uuid aluno_id FK
        timestamptz feito_em
    }

    resultados_performance {
        uuid id PK
        uuid academia_id FK
        uuid aula_id FK
        uuid aluno_id FK
        interval tempo
        int  repeticoes
        numeric carga_kg
        int  rounds
        int  reps_extra
        bool passou
        bool rx_scaled
    }

    faturas {
        uuid id PK
        uuid academia_id FK
        uuid aluno_id FK
        text asaas_pagamento_id
        numeric valor
        fatura_status status
        date vencimento
        date mes_referencia
    }

    %% ── Relacionamentos ──────────────────────────────────────────────────────

    academias     ||--o{ profiles             : "possui membros"
    academias     ||--o{ wods                 : "possui WODs"
    academias     ||--o{ aulas_agenda         : "possui aulas"
    academias     ||--o{ checkins             : "isolamento RLS"
    academias     ||--o{ resultados_performance : "isolamento RLS"
    academias     ||--o{ faturas              : "isolamento RLS"

    wods          ||--o{ aulas_agenda         : "1 WOD → N Aulas"

    aulas_agenda  ||--o{ checkins             : "1 Aula → N Checkins"
    aulas_agenda  ||--o{ resultados_performance : "1 Aula → N Resultados"

    profiles      ||--o{ checkins             : "aluno faz check-in"
    profiles      ||--o{ resultados_performance : "aluno registra score"
    profiles      ||--o{ faturas              : "aluno tem faturas"
```

## Leitura dos fluxos principais

### Fluxo: Treino do dia
```
academias
  └── wods           (conteúdo: Fran, Murph, etc.)
        └── aulas_agenda   (evento: 19h de 09/04/2026 faz "Fran")
              ├── checkins          (aluno X compareceu)
              └── resultados_performance  (aluno X fez em 8:32, RX)
```

### Fluxo: Trava financeira
```
profiles (aluno)
  └── faturas
        ├── status='paga'     → CHECK-IN PERMITIDO
        ├── status='pendente' → CHECK-IN BLOQUEADO (trigger + app)
        └── status='vencida'  → CHECK-IN BLOQUEADO (trigger + app)
```

### Fluxo: Ranking de um WOD
```
wods ──→ aulas_agenda ──→ resultados_performance ──→ profiles
              (data/hora)        (score RX/Scaled)      (nome do aluno)
```
> View `ranking_geral` materializa este JOIN automaticamente.

## Regras de isolamento (Multitenancy)

Toda tabela (exceto `academias`) tem `academia_id` como FK + índice.
As políticas RLS garantem que cada query retorna **apenas dados da academia do usuário autenticado**.
O `saas_admin` tem `academia_id = NULL` e acessa tudo via policy exclusiva.
