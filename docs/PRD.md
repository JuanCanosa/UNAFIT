# PRD — UNAFIT Sistema de Gestão

**Versão:** 1.0  
**Data:** Abril 2026  
**Status:** Em desenvolvimento ativo  
**Repositório:** github.com/JuanCanosa/UNAFIT  
**Produção:** https://unafit.com.br

---

## 1. Visão Geral

O **UNAFIT** é uma plataforma SaaS B2B2C de gestão para academias de CrossFit e modalidades funcionais. O produto é operado pela UNAFIT e comercializado para academias (clientes B2B), que por sua vez oferecem acesso ao sistema para seus alunos (usuários finais B2C).

### Proposta de Valor

| Para quem | Proposta |
|---|---|
| **UNAFIT (operador)** | Receita recorrente por assinatura de cada academia. Painel de controle total sobre o ecossistema. |
| **Academia (dono)** | Sistema completo de gestão — alunos, planos, financeiro, WODs, agenda e relatórios — com sua própria marca. |
| **Colaborador (staff)** | Ferramenta operacional para registro de WODs, check-ins e acompanhamento de alunos sem acesso ao financeiro. |
| **Aluno** | Portal individual com histórico de treinos, scores, faturas e check-in digital. |

---

## 2. Objetivos de Negócio

1. **Monetização SaaS** — Cobrar assinatura mensal de cada academia via Asaas (planos Starter, Pro, Business).
2. **White Label** — Cada academia personaliza a plataforma com sua própria logo e identidade visual.
3. **Retenção de alunos** — Engajamento via histórico de performance, rankings e notificações.
4. **Escalabilidade multi-tenant** — Uma única infraestrutura atende N academias com isolamento total de dados via RLS.

---

## 3. Stack Tecnológica

| Camada | Tecnologia |
|---|---|
| **Frontend / SSR** | Astro 6 (`output: server`) + Tailwind CSS |
| **Banco de dados** | Supabase (PostgreSQL) com Row Level Security |
| **Autenticação** | Supabase Auth (email/senha + magic link) |
| **Storage** | Supabase Storage (bucket `academy-assets` — logos) |
| **Pagamentos alunos** | Asaas (`ASAAS_API_KEY` por academia) |
| **Pagamentos SaaS** | Asaas (`ASAAS_SAAS_API_KEY` — conta UNAFIT) |
| **Email transacional** | Resend (`RESEND_API_KEY`) |
| **Infraestrutura** | Docker + VPS Hostinger (187.127.2.24) |
| **Reverse proxy** | Traefik + Let's Encrypt (SSL automático) |
| **CI/CD** | GitHub Actions → GHCR → deploy SSH automático |

---

## 4. Arquitetura Multi-tenant

```
┌─────────────────────────────────────────────────────┐
│                     UNAFIT SaaS                     │
│  saas_admin: visão global de todas as academias     │
└─────────────────┬───────────────────────────────────┘
                  │  1:N
     ┌────────────┴────────────┐
     │       Academia A        │        Academia B ...
     │  dono + colaboradores   │
     │  + alunos               │
     │  academia_id isolado     │
     └─────────────────────────┘
```

**Isolamento de dados:** Toda tabela multi-tenant tem `academia_id`. As políticas RLS do Supabase garantem que cada usuário veja apenas os dados da sua academia. O `saas_admin` acessa todos os dados via cliente admin (service_role).

---

## 5. Perfis de Usuário e Permissões

### 5.1 Roles

| Role | Descrição | academia_id |
|---|---|---|
| `saas_admin` | Operador UNAFIT. Acesso total ao sistema. | NULL |
| `dono` | Gestor da academia. Acesso financeiro completo. | obrigatório |
| `colaborador` | Professor / recepcionista. Sem acesso financeiro. | obrigatório |
| `aluno` | Cliente da academia. Acesso apenas aos próprios dados. | obrigatório |

### 5.2 Matriz de Permissões por Funcionalidade

| Funcionalidade | saas_admin | dono | colaborador | aluno |
|---|:---:|:---:|:---:|:---:|
| Dashboard | ✅ | ✅ | ✅ | ✅ (simplificado) |
| WODs | ✅ | ✅ | ✅ | ❌ |
| Agenda de Aulas | ✅ | ✅ | ✅ | ❌ |
| Rankings | ✅ | ✅ | ✅ | ❌ |
| Gestão de Alunos | ✅ | ✅ | ✅ | ❌ |
| Planos | ✅ | ✅ | ❌ | ❌ |
| Financeiro (faturas alunos) | ✅ | ✅ | ❌ | ❌ |
| Relatórios | ✅ | ✅ | ❌ | ❌ |
| Check-in | ❌ | ❌ | ❌ | ✅ |
| Meus Resultados | ❌ | ❌ | ❌ | ✅ |
| Minhas Faturas | ❌ | ❌ | ❌ | ✅ |
| Meu Perfil | ✅ | ✅ | ✅ | ✅ |
| Logo da Academia | ❌ | ✅ | ❌ | ❌ |
| Assinatura UNAFIT | ❌ | ✅ | ❌ | ❌ |
| Gestão de Academias | ✅ | ❌ | ❌ | ❌ |

---

## 6. Módulos do Sistema

### 6.1 Autenticação e Perfil

- Login por email/senha via Supabase Auth
- Sessão gerenciada por cookies SSR (sem localStorage)
- Perfil editável: nome, telefone, cargo (read-only), e-mail (read-only)
- **Dono**: campo adicional de nome da academia
- **Dono**: upload de logo da academia (PNG/JPG/SVG, máx 2MB) → armazenado no Supabase Storage → exibido na sidebar e topbar mobile
- Logout com limpeza de sessão

### 6.2 White Label

- Cada academia tem um campo `logo_url` na tabela `academias`
- A logo é exibida:
  - Sidebar desktop (topo, substituindo o logo UNAFIT padrão)
  - Topbar mobile
  - Card de identidade na página de perfil
  - Emails transacionais enviados para alunos
- Fallback: logo padrão UNAFIT quando nenhuma logo está configurada
- Storage bucket `academy-assets` (público) com path `academias/{academia_id}/logo.{ext}`

### 6.3 Gestão de Alunos

**Cadastro (campos obrigatórios):**
- Nome completo, e-mail, telefone, CPF (com máscara e validação de duplicidade)
- Data de nascimento, endereço completo (com auto-preenchimento via ViaCEP)
- Senha de acesso inicial (definida pelo gestor)
- Categoria, plano inicial

**Acesso do aluno:**
- Conta criada via `supabase.auth.admin.createUser` com `email_confirm: true`
- Perfil criado na tabela `profiles` com `role = 'aluno'`
- Login imediato em `unafit.com.br/login` com e-mail e senha cadastrados

**Gestão pelo dono/colaborador:**
- Listagem com busca (nome/e-mail/CPF) e filtro por status
- Visualização de perfil completo
- Edição de dados cadastrais
- Troca de plano (cancelamento do plano anterior)
- Histórico de check-ins e pagamentos
- **Gestão de acesso:** definir senha diretamente OU enviar e-mail de redefinição personalizado

**Alerta de aniversário:** Dashboard exibe banner quando algum aluno faz aniversário no dia atual.

### 6.4 Planos e Categorias

**Planos:**
- Nome, descrição, valor mensal, dia de vencimento
- Ativar / desativar / excluir (com bloqueio se há alunos ativos)
- Edição inline via modal

**Categorias de alunos:**
- Cor e nome customizáveis por academia
- Permite segmentar alunos (ex: Iniciante, Avançado, Kids)

### 6.5 WODs (Workout of the Day)

- Criação e edição por colaboradores e donos
- Campos: nome, descrição, tipo (AMRAP, For Time, EMOM, etc.)
- Agrupamento por grupo/data de aplicação
- Associação com exercícios e seções
- Visualização pública para membros da academia via listagem

### 6.6 Agenda de Aulas

- Calendário de aulas com data, horário, modalidade
- Cada aula associada a um WOD
- Check-ins registrados por aula
- Observações e aquecimento por aula

### 6.7 Rankings

- Ranking por WOD: ordena alunos pelo melhor resultado
- View `ranking_geral` com SECURITY INVOKER (respeita RLS)
- Exibição de posição, nome, resultado e data

### 6.8 Check-in (Aluno)

- Aluno visualiza aulas disponíveis do dia
- Faz check-in em uma aula específica
- Registra score/resultado para o WOD da aula
- Histórico exibido em "Meus Resultados"

### 6.9 Financeiro (Dono)

**Faturas dos alunos (`/dashboard/financeiro/faturas`):**
- Listagem com filtro por mês
- Status: Paga, Pendente, Vencida, Cancelada
- Ação "Marcar como pago" manual
- Integração Asaas: link de pagamento por boleto/PIX
- Resumo: total pago, pendente, vencido, valor recebido no período

**Relatórios (`/dashboard/financeiro/relatorios`):**
- Visão financeira consolidada da academia

### 6.10 Assinatura UNAFIT (SaaS Billing)

**Planos disponíveis:**
| Plano | Valor | Limite de Alunos |
|---|---|---|
| Starter | R$ 99,90/mês | até 50 |
| Pro | R$ 199,90/mês | até 200 |
| Business | R$ 349,90/mês | ilimitado |

**Visão do dono (`/dashboard/perfil`):**
- Plano contratado, status (Ativa/Trial/Suspensa/Cancelada) e data de início
- Tabela de faturas com status, vencimento, valor e link de pagamento Asaas
- Botão "Pagar →" para faturas em aberto

**Infraestrutura:**
- Tabelas: `saas_planos`, `saas_assinaturas`, `saas_faturas`
- Integração Asaas separada via `ASAAS_SAAS_API_KEY` (conta UNAFIT)
- RLS: cada academia vê apenas sua própria assinatura e faturas

### 6.11 Email Transacional

- Biblioteca: Resend (`RESEND_API_KEY`)
- Template HTML dark mode com logo da academia, nome e rodapé
- **E-mail de redefinição de senha:**
  - Header com logo da academia (ou nome se não houver logo)
  - Botão CTA "Criar minha senha →"
  - Link gerado via `supabase.auth.admin.generateLink({ type: 'recovery' })` (válido 24h)
  - Fallback para e-mail padrão Supabase se Resend não configurado

### 6.12 Gestão de Academias (SaaS Admin)

- Listagem de todas as academias com: logo, nome, slug, status, plano SaaS, contagem de usuários
- Criação de nova academia: define nome, slug, e-mail e senha do dono — conta criada automaticamente
- Ativar / desativar academia
- Visão de métricas por academia

---

## 7. Banco de Dados — Tabelas Principais

```
academias           id, nome, slug, logo_url, ativo, asaas_customer_id
profiles            id (= auth.uid), role, nome_completo, telefone, academia_id, ativo
alunos              id, academia_id, nome, email, cpf, telefone, data_nascimento,
                    endereco_*, categoria_id, status, asaas_customer_id
categorias_alunos   id, academia_id, nome, cor
planos              id, academia_id, nome, descricao, valor, vencimento_dia, ativo
aluno_planos        id, academia_id, aluno_id, plano_id, status, data_inicio, data_fim
pagamentos          id, academia_id, aluno_id, valor, status, data_vencimento,
                    data_pagamento, descricao, link_pagamento, asaas_payment_id
wods                id, academia_id, nome, descricao, tipo, grupo, data_aplicacao
aulas_agenda        id, academia_id, data_aula, horario_inicio, modalidade, wod_id, obs
checkins            id, academia_id, aluno_id, aula_id, created_at
resultados_perf.    id, academia_id, aluno_id, aula_id, resultado, observacao
saas_planos         id, nome, descricao, valor, limite_alunos, ativo
saas_assinaturas    id, academia_id, saas_plano_id, status, data_inicio, data_fim
saas_faturas        id, academia_id, saas_assinatura_id, descricao, valor,
                    data_vencimento, data_pagamento, status, link_pagamento
```

**Segurança RLS:** Todas as tabelas têm `ENABLE ROW LEVEL SECURITY`. As políticas usam funções auxiliares `meu_role()` e `minha_academia_id()` para isolamento por academia.

---

## 8. Infraestrutura e Deploy

### Fluxo CI/CD

```
git push main
    → GitHub Actions
        → docker build (node:22-alpine)
        → docker push ghcr.io/juancanosa/unafit:latest
        → SSH no VPS
            → docker compose pull unafit
            → docker compose up -d unafit
```

### Ambiente de Produção

| Serviço | Descrição |
|---|---|
| **Traefik** | Reverse proxy + SSL automático via Let's Encrypt |
| **unafit** | Container Astro SSR na porta 4321 |
| **Watchtower** | Monitoramento de atualizações de imagem |
| **Portainer** | Gestão visual dos containers |

### Variáveis de Ambiente (VPS)

```env
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ASAAS_API_KEY=              # Asaas da academia (por academia, quando integrado)
ASAAS_SAAS_API_KEY=         # Asaas da UNAFIT (SaaS billing)
ASAAS_SAAS_ENV=sandbox      # ou production
RESEND_API_KEY=             # Email transacional
FROM_EMAIL=noreply@unafit.com.br
SITE=https://unafit.com.br
```

---

## 9. Rotas do Sistema

| Rota | Acesso | Descrição |
|---|---|---|
| `/login` | público | Tela de login |
| `/logout` | autenticado | Encerra sessão |
| `/dashboard` | todos | Dashboard inicial |
| `/dashboard/wods` | saas_admin, dono, colaborador | Listagem de WODs |
| `/dashboard/wods/[id]` | saas_admin, dono, colaborador | Detalhes do WOD |
| `/dashboard/agenda` | saas_admin, dono, colaborador | Agenda de aulas |
| `/dashboard/agenda/[id]` | saas_admin, dono, colaborador | Detalhes da aula |
| `/dashboard/rankings` | saas_admin, dono, colaborador | Rankings |
| `/dashboard/alunos` | saas_admin, dono, colaborador | Lista de alunos |
| `/dashboard/alunos/novo` | saas_admin, dono, colaborador | Cadastrar aluno |
| `/dashboard/alunos/[id]` | saas_admin, dono, colaborador | Perfil do aluno |
| `/dashboard/planos` | saas_admin, dono | Planos e categorias |
| `/dashboard/financeiro/faturas` | saas_admin, dono | Faturas dos alunos |
| `/dashboard/financeiro/relatorios` | saas_admin, dono | Relatórios financeiros |
| `/dashboard/checkin` | aluno | Check-in na aula |
| `/dashboard/resultados` | aluno | Histórico de treinos e scores |
| `/dashboard/faturas` | aluno | Faturas do aluno |
| `/dashboard/perfil` | todos | Perfil pessoal + logo + assinatura |
| `/dashboard/academias` | saas_admin | Gestão de academias |

---

## 10. Integrações Externas

### 10.1 Asaas (Pagamentos)

**Dois contextos de integração:**

| Contexto | Env Var | Propósito |
|---|---|---|
| Academia → Aluno | `ASAAS_API_KEY` | Cobranças mensalidades dos alunos |
| UNAFIT → Academia | `ASAAS_SAAS_API_KEY` | Cobranças da assinatura SaaS |

**Funcionalidades:**
- Criar cliente no Asaas ao cadastrar aluno/academia
- Criar cobrança avulsa (boleto/PIX)
- Criar assinatura recorrente mensal
- Cancelar assinatura
- Stub implementado: funciona com `null` se chave não configurada (sem quebrar o sistema)

### 10.2 Resend (Email)

- Emails de redefinição de senha com branding da academia
- Template HTML dark mode responsivo
- Fallback para Supabase Auth email se `RESEND_API_KEY` não configurado
- Requer domínio verificado `unafit.com.br`

### 10.3 ViaCEP

- Auto-preenchimento de endereço pelo CEP no cadastro de alunos
- Chamada client-side ao `viacep.com.br` via `blur` no campo CEP

### 10.4 Supabase Storage

- Bucket `academy-assets` (público)
- Logos das academias: `academias/{academia_id}/logo.{ext}`
- Upload via admin client (bypassa RLS)
- Validação: tipo `image/*`, máx 2MB
- URL pública imediata via `getPublicUrl`

---

## 11. Funcionalidades Pendentes / Roadmap

### Prioridade Alta

| # | Funcionalidade | Descrição |
|---|---|---|
| P1 | Relatórios financeiros | Página `/dashboard/financeiro/relatorios` com gráficos de receita, inadimplência, projeção |
| P2 | Membros / Colaboradores | Página `/dashboard/membros` para o dono convidar/gerenciar colaboradores |
| P3 | Portal do aluno (reset senha) | Página `/portal/reset-password` para o aluno definir nova senha via link do email |
| P4 | Migração DB produção | Aplicar migrations pendentes (0015, 0016) no Supabase de produção |
| P5 | Deploy automático de migrations | Integrar `supabase db push` no pipeline CI/CD |

### Prioridade Média

| # | Funcionalidade | Descrição |
|---|---|---|
| M1 | Notificações in-app | Alertas de fatura vencida, aniversário, novo aluno |
| M2 | Configuração SMTP / Resend | Interface para o dono configurar email próprio |
| M3 | Relatório de frequência | Heatmap de check-ins por aluno, por período |
| M4 | App mobile (PWA) | Manifesto PWA para instalação no celular do aluno |
| M5 | Webhook Asaas | Receber eventos de pagamento automaticamente (confirmar pago) |
| M6 | Múltiplas unidades | Uma academia com várias unidades (filiais) |

### Prioridade Baixa

| # | Funcionalidade | Descrição |
|---|---|---|
| B1 | 2FA | Autenticação de dois fatores para donos |
| B2 | Importar alunos | Upload de CSV para importação em massa |
| B3 | Programa de indicação | Aluno indica amigo → desconto |
| B4 | API pública | Webhooks e API REST para integrações externas |

---

## 12. Critérios de Aceitação por Módulo

### Alunos
- [ ] Cadastro com CPF único por academia
- [ ] Senha definida no momento do cadastro → login imediato
- [ ] E-mail de redefinição com logo da academia e link válido por 24h
- [ ] Dono pode redefinir senha de qualquer aluno da sua academia
- [ ] Status do aluno reflete plano ativo/cancelado

### Planos
- [ ] Não é possível excluir plano com alunos ativos
- [ ] Alteração de plano cancela o anterior automaticamente
- [ ] Valor e vencimento refletidos nas faturas geradas

### Check-in
- [ ] Aluno só faz check-in em aulas do mesmo dia
- [ ] Check-in duplicado na mesma aula bloqueado
- [ ] Score/resultado opcionais no momento do check-in

### Financeiro
- [ ] Colaborador não acessa nenhuma rota financeira (RLS + redirect)
- [ ] Aluno vê apenas suas próprias faturas
- [ ] Dono vê todas as faturas da academia, filtradas por mês

### White Label
- [ ] Logo aparece na sidebar, topbar mobile e email transacional
- [ ] Fallback para logo UNAFIT quando academia não configurou logo
- [ ] Upload restrito a arquivos de imagem ≤ 2MB

---

## 13. Glossário

| Termo | Definição |
|---|---|
| **Academia** | Cliente do SaaS UNAFIT. Uma instância isolada com seus usuários e dados. |
| **Dono** | Usuário gestor da academia. Acesso financeiro e administrativo total. |
| **Colaborador** | Staff da academia (professor, recepcionista). Sem acesso financeiro. |
| **Aluno** | Usuário final. Cliente da academia. |
| **WOD** | Workout of the Day. Treino programado para uma aula. |
| **Check-in** | Registro de presença do aluno em uma aula específica. |
| **Plano** | Produto de assinatura da academia (ex: Mensal R$ 150). |
| **Asaas** | Gateway de pagamento brasileiro (PIX, boleto, cartão). |
| **Resend** | Serviço de envio de emails transacionais. |
| **RLS** | Row Level Security — política de segurança do PostgreSQL que limita acesso por linha. |
| **Tenant** | Cada academia é um tenant isolado no banco de dados multi-tenant. |
| **White Label** | Personalização da plataforma com a identidade visual da academia. |
