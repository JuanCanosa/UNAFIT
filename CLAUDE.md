# UNAFIT — Sistema de Gestão de Academias

## Visão Geral

Plataforma **SaaS multi-tenant** para gestão de academias de CrossFit. Cada academia tem seu próprio subdomínio de login (`unafit.com.br/[slug]`), painel de controle e integração de pagamentos.

**Stack:**
- **Frontend/Backend:** Astro 6 (SSR, Node.js standalone)
- **Banco de dados:** Supabase (PostgreSQL + RLS)
- **Autenticação:** Supabase Auth (cookie-based SSR via `@supabase/ssr`)
- **Pagamentos:** Asaas (PIX, Boleto, Cartão)
- **E-mail:** Resend
- **Storage:** Supabase Storage (bucket `academia-logos`)
- **Deploy:** Docker + GitHub Actions → VPS (187.127.2.24) via ghcr.io/juancanosa/unafit:latest
- **Proxy:** Cloudflare + Nginx

---

## Roles do Sistema

| Role | Descrição |
|------|-----------|
| `saas_admin` | Administrador UNAFIT — gerencia todas as academias, planos SaaS, faturamento |
| `dono` | Dono da academia — gerencia alunos, colaboradores, planos, financeiro |
| `colaborador` | Professor/colaborador — acessa agenda, WODs, alunos |
| `aluno` | Aluno da academia — check-in, resultados, faturas pessoais |

---

## Estrutura do Projeto

```
sistema-app/
├── app/                          # Aplicação Astro
│   ├── src/
│   │   ├── pages/
│   │   │   ├── [slug].astro      # Login white-label por academia
│   │   │   ├── login.astro       # Login padrão UNAFIT
│   │   │   ├── logout.astro
│   │   │   ├── onboarding.astro  # Wizard cadastro dono (3 steps)
│   │   │   ├── assinatura-pendente.astro
│   │   │   ├── conta-desativada.astro
│   │   │   ├── portal/
│   │   │   │   └── reset-password.astro
│   │   │   ├── auth/
│   │   │   │   └── callback.ts
│   │   │   ├── api/
│   │   │   │   ├── upload-logo.ts          # Upload logo academia
│   │   │   │   ├── checkin.ts              # Registrar check-in
│   │   │   │   ├── membros/criar.ts        # Criar membro
│   │   │   │   ├── exercicios/             # CRUD exercícios
│   │   │   │   ├── aula-exercicios/        # Exercícios por aula
│   │   │   │   ├── saas/gerar-cobranca.ts  # Cobrança SaaS
│   │   │   │   └── webhooks/
│   │   │   │       ├── asaas.ts            # Webhook conta UNAFIT
│   │   │   │       └── asaas-academia.ts   # Webhook por academia
│   │   │   └── dashboard/
│   │   │       ├── index.astro             # Dashboard (por role)
│   │   │       ├── perfil.astro
│   │   │       ├── configuracoes.astro     # Config Asaas (dono)
│   │   │       ├── wods/                   # WODs (dono/colaborador)
│   │   │       ├── agenda/                 # Agenda aulas
│   │   │       ├── alunos/                 # CRUD alunos
│   │   │       ├── colaboradores/          # CRUD colaboradores
│   │   │       ├── planos/                 # Planos academia
│   │   │       ├── financeiro/             # Faturas + relatórios
│   │   │       ├── academias/              # Gestão academias (saas_admin)
│   │   │       ├── checkin.astro           # Check-in aluno
│   │   │       ├── agenda-aluno.astro
│   │   │       ├── resultados.astro
│   │   │       ├── faturas.astro           # Faturas do aluno
│   │   │       ├── rankings.astro
│   │   │       ├── aniversariantes.astro
│   │   │       ├── planos-saas.astro       # Planos SaaS (saas_admin)
│   │   │       └── selecionar-academia.astro
│   │   ├── layouts/
│   │   │   └── DashboardLayout.astro       # Layout base autenticado
│   │   ├── components/
│   │   │   ├── Sidebar.astro               # Navegação lateral (role-based)
│   │   │   ├── InstallBanner.astro         # PWA install banner
│   │   │   └── ui/
│   │   │       ├── Badge.astro
│   │   │       ├── Button.astro
│   │   │       └── Card.astro
│   │   ├── lib/
│   │   │   ├── supabase.ts                 # Clientes Supabase (server + admin)
│   │   │   ├── asaas.ts                    # SDK Asaas por academia
│   │   │   ├── asaas-saas.ts               # SDK Asaas conta UNAFIT
│   │   │   ├── email.ts                    # Templates de e-mail (Resend)
│   │   │   ├── checkin-validator.ts        # Regras de validação check-in
│   │   │   └── utils.ts                    # cn() helper (clsx + tailwind-merge)
│   │   ├── middleware.ts                   # Auth + onboarding + bloqueio assinatura
│   │   ├── styles/
│   │   │   └── globals.css
│   │   └── types/
│   │       └── database.ts
│   ├── astro.config.mjs                    # output:server, Node adapter, checkOrigin:false
│   ├── Dockerfile                          # Multi-stage: builder + runner (node:22-alpine)
│   └── package.json
├── supabase/
│   └── migrations/                         # 22 migrações aplicadas
└── .github/
    └── workflows/
        └── docker.yml                       # Build + push GHCR + deploy SSH
```

---

## Banco de Dados — Tabelas Principais

| Tabela | Descrição |
|--------|-----------|
| `profiles` | Todos os usuários (extends auth.users). Campos: `role`, `academia_id`, `ativo` |
| `academias` | Dados da academia: endereço, responsável, Asaas keys, onboarding, logo |
| `alunos` | Dados específicos do aluno: CPF, plano, Asaas customer |
| `aluno_academias` | Vínculo aluno ↔ academia (multi-academia) |
| `wods` | Treinos do dia com grupos e seções |
| `exercicios` | Biblioteca de exercícios |
| `aulas_agenda` | Aulas agendadas por data/horário |
| `checkins` | Registro de presenças |
| `resultados_performance` | Marcadores de desempenho dos alunos |
| `planos` | Planos da academia (ex: Mensalidade, Trimestral) |
| `aluno_planos` | Vínculo aluno ↔ plano (histórico) |
| `faturas` | Cobranças por aluno (integra Asaas) |
| `saas_planos` | Planos do SaaS UNAFIT (Starter, Pro, etc.) |
| `saas_assinaturas` | Assinatura SaaS por academia |
| `saas_faturas` | Faturas SaaS por academia |

**RLS:** Habilitado em todas as tabelas. Helpers: `minha_academia_id()` e `meu_role()`.

---

## Fluxos Principais

### 1. Onboarding de Nova Academia
```
saas_admin → /dashboard/academias (+ Nova Academia)
  → Pré-cadastro: nome, email, telefone
  → Sistema gera academia + user Auth + profile (role=dono)
  → E-mail com senha temporária enviado via Resend
  → Dono acessa unafit.com.br/[slug]
  → Login → middleware redireciona para /onboarding
  → Wizard 3 steps: dados pessoais + dados academia + endereço
  → onboarding_completo = true → acesso liberado
```

### 2. Login White-label
```
unafit.com.br/[slug] → verifica academia.ativo
  → Formulário com e-mail ou CPF
  → POST: signInWithPassword (Supabase Auth)
  → Atualiza profiles.academia_id se multi-academia
  → Redirect /dashboard → middleware valida onboarding/assinatura
```

### 3. Cobrança de Aluno
```
dono → /dashboard/alunos/[id] → Atribuir Plano
  → Cria aluno_planos (status=ativo)
  → Cria cliente no Asaas da academia (asaas_customer_id)
  → Cria assinatura recorrente no Asaas
  → Webhook /api/webhooks/asaas-academia notifica pagamentos
  → faturas atualizada automaticamente
```

### 4. Controle de Assinatura SaaS
```
middleware.ts (executa em toda rota /dashboard/*):
  1. Dono sem onboarding → /onboarding
  2. Assinatura suspensa/cancelada → /assinatura-pendente
  3. Fatura pendente > 10 dias → suspende + /assinatura-pendente
  4. Plano cortesia (valor=0) → nunca bloqueia
```

---

## Variáveis de Ambiente

```env
SUPABASE_URL=https://[ref].supabase.co
SUPABASE_ANON_KEY=eyJ...           # Chave pública (RLS aplicado)
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # Chave admin (bypassa RLS) — NUNCA expor ao cliente
PUBLIC_APP_URL=https://unafit.com.br
RESEND_API_KEY=re_...               # Opcional — e-mails transacionais
FROM_EMAIL=noreply@unafit.com.br   # Opcional
```

---

## Deploy

```yaml
# .github/workflows/docker.yml
on: push to main (app/** changes)
1. docker build (node:22-alpine, multi-stage)
2. push para ghcr.io/juancanosa/unafit:latest
3. SSH no VPS: docker compose pull unafit && docker compose up -d unafit
```

**VPS:** `187.127.2.24` — root — `/root/docker-compose.yml`

---

## Autenticação e Segurança

- **Sessão:** Cookie `sb-[ref]-auth-token` gerenciado pelo `@supabase/ssr`
- **Middleware:** `src/middleware.ts` roda antes de toda rota `/dashboard/*`
- **CSRF:** `checkOrigin: false` no astro.config (login white-label requer)
- **Webhooks Asaas:** Validados via token `asaas_webhook_token` da academia
- **Service Role:** Usado apenas em contextos SSR, nunca exposto ao browser

---

## Convenções de Código

- **Páginas Astro:** Frontmatter TypeScript no topo (`---`), HTML Tailwind abaixo
- **Queries:** `supabase` (client com RLS) para reads do usuário; `adminClient` para operações privilegiadas
- **Modals:** HTML puro com `classList.toggle('hidden')` — sem biblioteca de UI
- **Formulários:** `method="POST"` com campo `action` para distinguir ações
- **Uploads de arquivo:** Via `/api/upload-logo` (fetch client-side) — não usar form multipart direto
- **Formatação BRL:** `v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })`
- **Senhas temporárias:** `gerarSenha()` — centralizar em `lib/` (pendente)

---

## Módulos por Role

### `saas_admin`
- Dashboard com KPIs globais (MRR, academias ativas, inadimplentes)
- Gestão completa de academias (criar, editar, logo, senha, assinatura)
- Planos SaaS (criar, editar valores e limites)
- Relatórios financeiros SaaS

### `dono`
- Dashboard com aulas do dia, check-ins, aniversariantes
- Alunos: CRUD completo, atribuição de planos, histórico de pagamentos
- Colaboradores: CRUD com envio de acesso por e-mail
- WODs e Agenda de Aulas
- Rankings de presença
- Relatórios financeiros da academia
- Configurações: integração Asaas (API Key + Webhook)

### `colaborador`
- Dashboard, WODs, Agenda (sem acesso financeiro)
- Visualização de alunos e check-ins

### `aluno`
- Dashboard simples
- Check-in em aulas
- Meus resultados
- Minhas faturas (com PIX QR Code, boleto)
- Agenda pessoal
