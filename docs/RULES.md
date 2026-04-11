# DOCUMENTAÇÃO TÉCNICA UNAFIT (v1.0)

## 1. ARQUITETURA SAAS MULTI-TENANT

- Todas as tabelas (exceto a global 'academias') DEVEM ter a coluna `academia_id`.
- Isolamento total via RLS (Row Level Security): Uma academia nunca vê dados de outra.

## 2. HIERARQUIA DE ACESSO (ROLES)

- **SaaS Admin (Juan):** Gestor global de todas as academias.
- **Dono da Academia:** Acesso total à sua unidade (Financeiro + Técnico + Rankings).
- **Professor:** Acesso apenas técnico (Cria WODs, gerencia aulas e vê rankings). BLOQUEADO no financeiro.
- **Aluno:** Realiza check-in, paga mensalidade e registra performance.

## 3. REGRAS DE TREINO (WOD & AULAS)

- **WOD:** É o conteúdo (Nome/Homenagem, Mobilidade, Aquecimento, Treino, Score Type).
- **Aula:** É o evento (Data + Horário de Início + Horário de Fim).
- Um WOD pode ser vinculado a várias aulas (ex: 19h e 20h fazem o mesmo WOD).

## 4. REGRAS DE CHECK-IN

- **Trava Financeira:** Bloquear check-in se houver faturas PENDENTES ou VENCIDAS no Asaas.
- **Janela de Tempo:** Liberado 10 min antes do início e até 1h após o FIM da aula.

## 5. PERFORMANCE E PAGAMENTO

- O resultado (Tempo/Reps/Carga) é amarrado à Aula (Data/Hora específica).
- O pagamento da mensalidade é feito pelo aluno dentro da plataforma via Asaas da própria academia.
