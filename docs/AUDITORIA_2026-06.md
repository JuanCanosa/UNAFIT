# Auditoria do Sistema UNAFIT — Junho/2026

**Escopo:** Segurança (RLS, auth, webhooks, multi-tenant) · Consistência de código ·
Cobertura dos fluxos do PRD · Escalabilidade e débito técnico.
**Referências usadas:** `CLAUDE.md`, `docs/PRD.md`, `docs/RULES.md`, migrações 0001–0028.

---

## 1. Achados críticos (corrigidos nesta auditoria)

### 1.1 RLS: políticas `FOR ALL` sem checagem de role expunham dados de todos os alunos
**Severidade: crítica — corrigida e aplicada em produção.**

A migração `0012_modulo_alunos.sql` criou políticas de RLS sem cláusula `FOR <comando>`
e sem checar `meu_role()`:

```sql
CREATE POLICY "academia_alunos" ON alunos
  USING (academia_id IN (SELECT academia_id FROM profiles WHERE id = auth.uid()));
```

Sem `FOR`, a policy vale para `SELECT/INSERT/UPDATE/DELETE` ao mesmo tempo, e
políticas permissivas no Postgres são combinadas com `OR`. Resultado: **qualquer
usuário autenticado da academia — inclusive um `aluno` — podia ler, criar, alterar
e apagar registros de qualquer outro membro**, em sete tabelas:

| Tabela | Exposição |
|---|---|
| `alunos` | CPF, endereço, telefone, e-mail, `asaas_customer_id` de todos os alunos |
| `pagamentos` | valores, status, links de boleto/PIX de todas as cobranças da academia |
| `planos` | qualquer aluno podia alterar/apagar os planos comerciais da academia |
| `aluno_planos` | assinaturas e `asaas_subscription_id` de todos os alunos |
| `checkins` | qualquer aluno podia forjar/apagar check-ins de outros |
| `categorias_alunos`, `checkin_resultados` | leitura/escrita irrestrita |

Confirmado ao vivo via `pg_policies` no projeto (`skcvbaiqeubbyhdcqjkc`) antes da
correção — não era um problema teórico, estava em produção.

**Correção aplicada:** migração [`0029_fix_overprivileged_rls_policies.sql`](../supabase/migrations/0029_fix_overprivileged_rls_policies.sql),
já executada no banco de produção. Substitui as políticas amplas por políticas
específicas por comando e por papel:
- `alunos`: staff (dono/colaborador/saas_admin) vê todos da academia; aluno vê
  apenas o próprio registro (casado por `email = auth.email()`, já que não há
  FK direta `profiles.id ↔ alunos.id` — replica o padrão usado em `faturas.astro`).
- `pagamentos`: leitura restrita a `dono`/`saas_admin` (consistente com
  `canVerFinanceiro` em `alunos/[id].astro` — colaborador não vê financeiro) +
  o próprio aluno; escrita restrita a `dono`/`saas_admin` (webhooks usam
  `service_role`, que ignora RLS).
- `planos`, `aluno_planos`, `categorias_alunos`: leitura para staff da academia,
  escrita restrita a `dono`/`saas_admin`.
- `checkins`: removida a policy ampla; as políticas corretas de 0001/0017
  continuam valendo (nenhuma substituição necessária).
- `checkin_resultados`: tabela legada não referenciada em lugar nenhum do
  código (o módulo de performance usa `prs`, ver 0026) — ficou sem políticas,
  ou seja, sem acesso por roles públicos. Considerar `DROP TABLE` em uma
  migração futura de limpeza.

### 1.2 Webhook `asaas-academia` podia ser forjado sem token
**Severidade: crítica — corrigida no código (`app/src/pages/api/webhooks/asaas-academia.ts`).**

A validação do token (`asaas-access-token`) só rodava quando **o atacante decidia
enviar o header** e quando o payload trazia `payment.subscription`:

```ts
const receivedToken = request.headers.get('asaas-access-token') ?? '';
if (receivedToken && payment.subscription) { /* valida */ }
```

Bastava omitir o header (ou enviar um evento sem `subscription`, como a maioria
dos eventos pós-`PAYMENT_CREATED`) para o endpoint processar o payload **sem
nenhuma autenticação** — permitindo forjar `PAYMENT_RECEIVED` (marcar uma
cobrança como paga), `PAYMENT_OVERDUE` ou criar registros falsos em `pagamentos`
com `aluno_plano_id`/`asaas_subscription_id` conhecidos/adivinhados, corrompendo
os registros financeiros da academia e dos relatórios do dono.

**Correção aplicada:** o endpoint agora resolve a academia responsável pelo
evento por dois caminhos (via `aluno_planos.asaas_subscription_id` **e**, na
ausência desse, via `pagamentos.asaas_payment_id` já existente — cobrindo todos
os tipos de evento, não só `PAYMENT_CREATED`) e **sempre** exige
correspondência do token quando a academia tiver um configurado, independente
do header ter sido enviado ou não.

> ⚠️ **Ação recomendada (fora do código):** hoje `asaas_webhook_token` é opcional
> — uma academia que não o configura fica sem proteção nenhuma nesse endpoint.
> Vale considerar gerar esse token automaticamente no onboarding (como já se
> faz com a senha temporária via `gerarSenha()`), tornando-o obrigatório.

### 1.3 Webhook `asaas` (conta UNAFIT) — verificar `ASAAS_WEBHOOK_TOKEN` em produção
**Severidade: a confirmar — requer checagem de configuração no VPS.**

`app/src/pages/api/webhooks/asaas.ts` só valida o token se a env var
`ASAAS_WEBHOOK_TOKEN` estiver definida:
```ts
const WEBHOOK_TOKEN = process.env.ASAAS_WEBHOOK_TOKEN ?? '';
if (WEBHOOK_TOKEN) { /* valida */ }
```
Essa variável **não aparece em nenhum outro lugar do repositório** (não está em
`CLAUDE.md`, `docker-compose`, workflows do GitHub Actions). Se ela não estiver
configurada no `docker-compose.yml` do VPS, este webhook — que controla o status
de pagamento da própria assinatura SaaS da UNAFIT (ativar/suspender academias) —
está **aberto, sem autenticação**, em produção. Recomendo confirmar e, se
necessário, configurar o secret no VPS e documentá-lo no `CLAUDE.md` junto das
demais variáveis de ambiente.

---

## 2. Achados moderados

### 2.1 Checagem de `profiles.ativo` ocorre tarde demais no ciclo da requisição
`middleware.ts` roda antes de toda página `/dashboard/*`, mas **não verifica**
`profiles.ativo` nem `academias.ativo`. Essa checagem só acontece dentro de
`DashboardLayout.astro:28` — ou seja, **depois** que o frontmatter da página já
processou eventuais `POST` (inserts/updates). Um usuário desativado (`ativo =
false`) ainda consegue executar a escrita da requisição corrente antes de ser
redirecionado para `/conta-desativada` na renderização seguinte — porque as
RLS helpers `meu_role()`/`minha_academia_id()` não levam `ativo` em conta.

**Recomendação:** mover a checagem de `profiles.ativo` (e, se fizer sentido,
`academias.ativo` para todos os roles, não só `dono`/`colaborador`) para dentro
de `middleware.ts`, antes de `next()`, fechando a janela de escrita residual e
eliminando a query duplicada de perfil que hoje roda tanto no middleware quanto
no `DashboardLayout`.

### 2.2 `try/catch` do middleware falha aberto silenciosamente
```ts
} catch {
  // Não bloqueia em caso de erro
}
```
Em caso de erro transitório na consulta de assinatura/perfil, o middleware
deixa passar a requisição sem checar onboarding/bloqueio — comportamento
"fail-open" plausível para não derrubar o sistema inteiro em uma instabilidade
pontual do banco, mas hoje **não há log nenhum** do erro. Recomenda-se ao menos
registrar (`console.error`) para detectar problemas recorrentes — hoje uma
falha sistemática nessa query passaria despercebida indefinidamente.

### 2.3 Mensagens de erro do Postgres expostas cruas ao usuário
Cerca de 15 pontos repassam `error.message` diretamente para a tela
(ex.: `wods/index.astro:49`, `agenda/[id].astro:106`, `alunos/[id].astro:72,248`,
`planos/index.astro:37,50,112,124,129,137`, `colaboradores/[id].astro:50,83`,
`planos-saas.astro:41,55,71`, `grade-horaria/index.astro:53,63`,
`exercicios/index.astro:30,44,56`). Mensagens cruas do Postgres (nomes de
coluna/constraint) vazam para o usuário final — não é uma falha de segurança
grave (são páginas autenticadas, staff), mas é inconsistente com o tratamento
amigável já feito em `alunos/[id].astro:164` e `alunos/novo.astro:97`.
Considerar um helper central (`lib/`) que mapeie erros comuns de constraint
(`unique_violation`, `foreign_key_violation`, etc.) para mensagens em PT-BR —
`exercicios/index.astro:30,44` já faz algo parecido localmente, vale generalizar.

### 2.4 Formatação BRL inconsistente
A convenção do `CLAUDE.md` (`toLocaleString('pt-BR', {style:'currency',
currency:'BRL'})`) é seguida em ~8 arquivos, mas `alunos/novo.astro`,
`alunos/[id].astro`, `planos/index.astro` e `planos-saas.astro` usam
`toFixed(2)` com template `R$ ${...}` ou `Intl.NumberFormat` direto.
Recomenda-se extrair um helper `formatBRL()` para `lib/utils.ts`.

---

## 3. Achados de baixo risco / débito técnico

- **Paginação ausente em listagens que crescem com o tempo:** apenas
  `alunos/index.astro:60` usa `.range()`/`count: 'exact'`. `rankings.astro:49-57`
  carrega todos os check-ins e PRs do mês inteiro de uma vez (hoje delimitado
  por mês — aceitável agora, mas vai pesar conforme a base de alunos cresce);
  `colaboradores/index.astro` não tem limite algum; `financeiro/faturas.astro`,
  `faturas.astro`, `perfil.astro` usam `.limit()` fixo sem paginação real.
  Vale revisar conforme o volume de dados aumentar — não é urgente hoje.
- **`select('*')` em tabelas largas sem necessidade aparente:**
  `alunos/[id].astro:353`, `planos/index.astro:145-146`,
  `colaboradores/[id].astro:148`, `planos-saas.astro:89`,
  `grade-horaria/index.astro:80`. Trocar por listas explícitas de colunas.
- **Duplicação de lógica que poderia virar helper em `lib/`:**
  resolução CPF→e-mail/criação de usuário Auth (repetida entre `[slug].astro`
  e `alunos/[id].astro`/`alunos/novo.astro`), e agrupamento de exercícios por
  grupo de WOD (repetido em `wods/[id].astro:135-143`, `agenda/[id].astro`,
  `agenda-aluno.astro:80-86`).
- Nenhum padrão de N+1 (`await supabase` dentro de loop por item de lista) foi
  encontrado — os `for` localizados são apenas agrupamentos in-memory
  pós-fetch, o que é o padrão correto.
- A nota `Senhas temporárias: gerarSenha() — centralizar em lib/ (pendente)`
  do `CLAUDE.md` está **desatualizada**: já está centralizada em
  `lib/password.ts`. Vale remover o "(pendente)" do documento.

---

## 4. Cobertura dos fluxos principais (CLAUDE.md / PRD)

| Fluxo | Status | Observação |
|---|---|---|
| Onboarding de academia | ✅ Conforme | O wizard tem **4 steps** no código (`Dados Pessoais`, `Criar Senha`, `Academia`, `Endereço`) — o `CLAUDE.md` descreve "3 steps". Ajustar a documentação. |
| Login white-label | ✅ Conforme | Verifica `academia.ativo`, aceita CPF ou e-mail, atualiza `profiles.academia_id`. Há também um fluxo de "esqueci minha senha" via CPF/e-mail não documentado — incremento positivo, vale registrar no `CLAUDE.md`. |
| Cobrança de aluno | ✅ Conforme | `alunos/[id].astro` cria `aluno_planos`, cancela assinatura anterior no Asaas e trata erros com mensagens amigáveis. |
| Controle de assinatura SaaS | ✅ Conforme | Onboarding, status suspenso/cancelado, carência de 10 dias e cortesia (valor=0) implementados fielmente — ver §2.1/2.2 para os dois ajustes recomendados no mesmo trecho. |

A matriz de permissões do `docs/PRD.md` §5.2 também bate com o código — incluindo
o detalhe sutil de que "Planos: colaborador ❌" se refere à **página de gestão**
(`/dashboard/planos`, restrita a dono/saas_admin), não à leitura: o colaborador
*precisa* enxergar o nome do plano ao abrir o perfil de um aluno
(`alunos/[id].astro:539`), o que a nova policy `planos_select` permite
corretamente sem violar a intenção do PRD.

---

## 5. Resumo das correções já aplicadas

| # | Item | Onde | Status |
|---|---|---|---|
| 1 | RLS sem checagem de role em 7 tabelas | `supabase/migrations/0029_fix_overprivileged_rls_policies.sql` | ✅ Aplicado em produção (Supabase) |
| 2 | Webhook `asaas-academia` sem autenticação efetiva | `app/src/pages/api/webhooks/asaas-academia.ts` | ✅ Corrigido no código |
| 3 | Verificar `ASAAS_WEBHOOK_TOKEN` em produção | VPS / `docker-compose.yml` | ⚠️ Requer ação manual (fora do escopo de código) |

## 6. Recomendações para próximos passos (não bloqueantes)

1. Mover checagem de `profiles.ativo`/`academias.ativo` para `middleware.ts` (§2.1).
2. Logar erros no `catch` silencioso do middleware (§2.2).
3. Centralizar tratamento de erros de banco e formatação BRL em `lib/` (§2.3, §2.4).
4. Gerar `asaas_webhook_token` automaticamente no onboarding, tornando-o obrigatório.
5. `DROP TABLE checkin_resultados` (legada, não usada) em uma migração de limpeza.
6. Atualizar `CLAUDE.md`: onboarding tem 4 steps (não 3); remover nota
   "(pendente)" sobre `gerarSenha()`; documentar `ASAAS_WEBHOOK_TOKEN`.
