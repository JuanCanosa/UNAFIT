# DOCUMENTAÇÃO TÉCNICA UNAFIT (v1.1)

## 1. ARQUITETURA SAAS MULTI-TENANT

- Todas as tabelas (exceto a global `academias`) DEVEM ter a coluna `academia_id`.
- Isolamento total via RLS (Row Level Security): Uma academia nunca vê dados de outra.
- O `saas_admin` tem `academia_id = NULL` e acessa tudo via policy exclusiva `meu_role() = 'saas_admin'`.

## 2. HIERARQUIA DE ACESSO (ROLES)

- **SaaS Admin (Juan):** Gestor global de todas as academias.
- **Dono da Academia:** Acesso total à sua unidade (Financeiro + Técnico + Rankings).
- **Colaborador:** Acesso apenas técnico (Cria WODs, gerencia aulas e vê rankings). **BLOQUEADO no financeiro.**
- **Aluno:** Realiza check-in, paga mensalidade e registra performance.

## 3. REGRAS DE TREINO (WOD & AULAS)

- **WOD:** É o conteúdo (Nome, Treino, Score Type, Data de Aplicação).
- **Aula:** É o evento (Data + Horário de Início + Horário de Fim + Modalidade).
- Um WOD pode ser vinculado a várias aulas (ex: 19h e 20h fazem o mesmo WOD).
- Exercícios podem ser agrupados em rounds dentro do WOD (via `wod_grupos`).

## 4. REGRAS DE CHECK-IN

- **Trava Financeira A:** Bloquear check-in se houver faturas PENDENTES ou VENCIDAS.
- **Trava Financeira B:** Bloquear check-in se não houver fatura PAGA no mês vigente.
- **Janela de Tempo:** Liberado 10 min antes do início e até 1h após o FIM da aula.
- **Dupla Proteção:** Regras validadas na camada app (`checkin-validator.ts`) E via trigger no banco (`fn_validar_checkin_financeiro`).

## 5. PERFORMANCE E PAGAMENTO

- O resultado (Tempo/Reps/Carga) é amarrado à Aula (Data/Hora específica).
- O pagamento da mensalidade é feito pelo aluno dentro da plataforma.
- **Dois contextos Asaas:** `ASAAS_API_KEY` (academia→aluno) e `ASAAS_SAAS_API_KEY` (UNAFIT→academia).

## 6. WHITE LABEL

- Cada academia possui `logo_url` na tabela `academias`.
- Logo exibida na sidebar, topbar mobile, perfil e emails transacionais.
- Fallback: logo padrão UNAFIT quando nenhuma logo está configurada.
- Storage: bucket `academy-assets`, path `academias/{academia_id}/logo.{ext}`.

## 7. SEGURANÇA

- `SUPABASE_SERVICE_ROLE_KEY` NUNCA deve ser exposta no cliente.
- Dados financeiros SEMPRE processados no server-side.
- `checkin-validator.ts` NUNCA importado no cliente.
- CSRF nativo do Astro habilitado (não desativar `checkOrigin`).
- Senha mínima: 8 caracteres em todos os formulários.
