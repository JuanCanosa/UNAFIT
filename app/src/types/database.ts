// Tipos gerados manualmente — rode `supabase gen types typescript` para atualizar
// após aplicar a migration no Supabase.

export type UserRole = 'saas_admin' | 'dono' | 'colaborador' | 'aluno';
export type FaturaStatus = 'pendente' | 'paga' | 'vencida' | 'cancelada';
export type ScoreType = 'tempo' | 'reps' | 'carga' | 'rounds_reps' | 'pass_fail';

export interface Academia {
  id: string;
  nome: string;
  slug: string;
  asaas_api_key: string | null;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
}

export interface Profile {
  id: string;
  academia_id: string | null;  // null para saas_admin
  role: UserRole;
  nome_completo: string;
  telefone: string | null;
  asaas_cliente_id: string | null;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
}

export interface Wod {
  id: string;
  academia_id: string;
  nome: string;
  homenagem: string | null;
  mobilidade: string | null;
  aquecimento: string | null;
  treino: string;
  score_type: ScoreType;
  criado_por: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface AulaAgenda {
  id: string;
  academia_id: string;
  wod_id: string | null;
  data_aula: string;        // formato: 'YYYY-MM-DD'
  horario_inicio: string;   // formato: 'HH:MM:SS'
  horario_fim: string;      // formato: 'HH:MM:SS'
  capacidade_max: number | null;
  criado_por: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface Checkin {
  id: string;
  academia_id: string;
  aula_id: string;
  aluno_id: string;
  feito_em: string;
}

export interface ResultadoPerformance {
  id: string;
  academia_id: string;
  /** Vinculado à AULA (data/hora específica) — acessa WOD via aula.wod_id */
  aula_id: string;
  aluno_id: string;
  // Score (preenchido conforme score_type do WOD)
  tempo: string | null;          // INTERVAL → string no JS, ex: "00:12:34"
  repeticoes: number | null;
  carga_kg: number | null;
  rounds: number | null;
  reps_extra: number | null;
  passou: boolean | null;
  // Metadados
  rx_scaled: boolean;            // true = RX | false = Scaled
  observacao: string | null;
  registrado_em: string;
}

/** Linha retornada pela view ranking_geral */
export interface RankingGeral {
  resultado_id: string;
  academia_id: string;
  aluno_id: string;
  aluno_nome: string;
  wod_id: string;
  wod_nome: string;
  score_type: ScoreType;
  aula_id: string;
  data_aula: string;
  horario_inicio: string;
  horario_fim: string;
  tempo: string | null;
  repeticoes: number | null;
  carga_kg: number | null;
  rounds: number | null;
  reps_extra: number | null;
  passou: boolean | null;
  rx_scaled: boolean;
  observacao: string | null;
  registrado_em: string;
}

export interface Fatura {
  id: string;
  academia_id: string;
  aluno_id: string;
  asaas_pagamento_id: string | null;
  asaas_link_boleto: string | null;
  valor: number;
  status: FaturaStatus;
  vencimento: string;      // formato: 'YYYY-MM-DD'
  pago_em: string | null;
  /** Sempre dia 1 do mês de referência — ex: '2026-04-01' */
  mes_referencia: string;
  descricao: string | null;
  criado_em: string;
  atualizado_em: string;
}
