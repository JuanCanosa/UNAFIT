# UNAFIT — Diagrama de Relacionamento de Tabelas

> Atualizado em 28/04/2026 — reflete migrations 0001 a 0022.

## Diagrama ER (Mermaid)

```mermaid
erDiagram

    academias {
        uuid id PK
        text nome
        text slug UK
        text logo_url
        text email
        text telefone
        text responsavel_nome
        text responsavel_cpf_cnpj
        text asaas_api_key
        text asaas_customer_id
        bool onboarding_completo
        bool ativo
    }

    profiles {
        uuid id PK "FK → auth.users"
        uuid academia_id FK
        user_role role "saas_admin | dono | colaborador | aluno"
        text nome_completo
        text telefone
        text avatar_url
        text asaas_cliente_id
        bool ativo
    }

    alunos {
        uuid id PK
        uuid academia_id FK
        uuid user_id FK "→ auth.users"
        uuid categoria_id FK
        text nome
        text email UK
        text cpf UK
        text telefone
        text status "ativo | inativo | pendente"
        text asaas_customer_id
    }

    aluno_academias {
        uuid id PK
        uuid profile_id FK
        uuid academia_id FK
        uuid aluno_id FK
        bool ativo
    }

    categorias_alunos {
        uuid id PK
        uuid academia_id FK
        text nome UK
        text cor
    }

    planos {
        uuid id PK
        uuid academia_id FK
        text nome UK
        numeric valor
        int vencimento_dia
        bool ativo
    }

    aluno_planos {
        uuid id PK
        uuid academia_id FK
        uuid aluno_id FK
        uuid plano_id FK
        text status "ativo | cancelado | suspenso"
        date data_inicio
        date data_fim
    }

    wods {
        uuid id PK
        uuid academia_id FK
        text nome
        text treino
        score_type score_type "tempo | reps | carga | rounds_reps | pass_fail"
        date data_aplicacao
        uuid criado_por FK
    }

    aulas_agenda {
        uuid id PK
        uuid academia_id FK
        uuid wod_id FK
        date data_aula
        time horario_inicio
        time horario_fim
        text modalidade
        text obs_aquecimento
        int capacidade_max
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
        int repeticoes
        numeric carga_kg
        int rounds
        int reps_extra
        bool passou
        bool rx_scaled
    }

    pagamentos {
        uuid id PK
        uuid academia_id FK
        uuid aluno_id FK
        uuid aluno_plano_id FK
        numeric valor
        text status "pendente | pago | vencido | cancelado"
        date data_vencimento
        date data_pagamento
        text link_pagamento
    }

    faturas {
        uuid id PK
        uuid academia_id FK
        uuid aluno_id FK
        numeric valor
        fatura_status status "pendente | paga | vencida | cancelada"
        date vencimento
        date mes_referencia
        text asaas_pagamento_id
    }

    saas_planos {
        uuid id PK
        text nome UK
        numeric valor
        int limite_alunos
        bool ativo
    }

    saas_assinaturas {
        uuid id PK
        uuid academia_id FK UK
        uuid saas_plano_id FK
        text status "ativa | cancelada | suspensa | trial"
        date data_inicio
        date data_fim
    }

    saas_faturas {
        uuid id PK
        uuid academia_id FK
        uuid saas_assinatura_id FK
        numeric valor
        text status "pendente | pago | vencido | cancelado"
        date data_vencimento
        date data_pagamento
        text link_pagamento
    }

    %% ── Relacionamentos ────────────────────────────────────────────────

    academias     ||--o{ profiles             : "possui membros"
    academias     ||--o{ alunos               : "possui alunos"
    academias     ||--o{ categorias_alunos    : "possui categorias"
    academias     ||--o{ planos               : "possui planos"
    academias     ||--o{ wods                 : "possui WODs"
    academias     ||--o{ aulas_agenda         : "possui aulas"
    academias     ||--o{ checkins             : "isolamento RLS"
    academias     ||--o{ resultados_performance : "isolamento RLS"
    academias     ||--o{ faturas              : "isolamento RLS"
    academias     ||--o{ pagamentos           : "isolamento RLS"
    academias     ||--o| saas_assinaturas     : "1 assinatura"
    academias     ||--o{ saas_faturas         : "faturas SaaS"
    academias     ||--o{ aluno_academias      : "vínculos multi-academia"

    profiles      ||--o{ aluno_academias      : "multi-academia"
    profiles      ||--o{ checkins             : "aluno faz check-in"
    profiles      ||--o{ resultados_performance : "aluno registra score"
    profiles      ||--o{ faturas              : "aluno tem faturas"

    alunos        ||--o{ aluno_planos         : "matrículas"
    alunos        ||--o{ pagamentos           : "pagamentos"

    categorias_alunos ||--o{ alunos           : "categoriza"
    planos        ||--o{ aluno_planos         : "alunos matriculados"

    wods          ||--o{ aulas_agenda         : "1 WOD → N Aulas"

    aulas_agenda  ||--o{ checkins             : "1 Aula → N Checkins"
    aulas_agenda  ||--o{ resultados_performance : "1 Aula → N Resultados"

    saas_planos   ||--o{ saas_assinaturas     : "planos SaaS"
    saas_assinaturas ||--o{ saas_faturas      : "faturas da assinatura"
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

  + Verifica se existe fatura 'paga' no mês vigente (trava B)
```

### Fluxo: Gestão de alunos
```
academias
  └── alunos         (dados cadastrais: CPF, endereço, etc.)
        ├── aluno_planos    (matrícula ativa/cancelada)
        │     └── planos    (valor, vencimento_dia)
        ├── pagamentos      (histórico de pagamentos)
        └── categorias_alunos (segmentação: Iniciante, Avançado)
```

### Fluxo: Ranking de um WOD
```
wods ──→ aulas_agenda ──→ resultados_performance ──→ profiles
              (data/hora)        (score RX/Scaled)      (nome do aluno)
```
> View `ranking_geral` materializa este JOIN automaticamente (SECURITY INVOKER).

### Fluxo: SaaS Billing
```
UNAFIT (saas_admin)
  └── saas_planos            (Starter, Pro, Business)
        └── saas_assinaturas (1 por academia)
              └── saas_faturas (cobranças mensais)
```

## Regras de isolamento (Multitenancy)

- Toda tabela (exceto `academias` e `saas_planos`) tem `academia_id` como FK + índice.
- As políticas RLS garantem que cada query retorna **apenas dados da academia do usuário autenticado**.
- O `saas_admin` tem `academia_id = NULL` e acessa tudo via policy exclusiva `meu_role() = 'saas_admin'`.
- Funções auxiliares: `minha_academia_id()` e `meu_role()` são usadas em todas as policies.
