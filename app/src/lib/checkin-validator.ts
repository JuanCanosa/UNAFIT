/**
 * checkin-validator.ts
 *
 * Lógica de validação do check-in — executada APENAS no servidor (Astro SSR).
 * Usa o cliente ADMIN (service_role) para consultar faturas internamente,
 * garantindo que nenhum dado financeiro vaze para o cliente ou para roles
 * sem permissão (ex: colaborador).
 *
 * Regras (conforme docs/RULES.md — UNAFIT):
 *  1. Janela de Tempo: liberado 10min antes do início até 1h após o FIM da aula.
 *  2. Sem check-in duplicado na mesma aula.
 *  3. Trava Financeira A: bloqueia se houver faturas 'pendente' ou 'vencida'.
 *  4. Trava Financeira B: bloqueia se não houver fatura 'paga' no mês vigente.
 *
 * Nota: as travas financeiras também existem como trigger no banco (fn_validar_checkin_financeiro),
 * garantindo dupla proteção. Esta camada app evita round-trips desnecessários.
 */

import { createSupabaseAdminClient } from './supabase';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AulaAgenda, FaturaStatus } from '@/types/database';

// Status que bloqueiam o check-in (RULES.md §4)
const STATUS_BLOQUEANTE: FaturaStatus[] = ['pendente', 'vencida'];

// Janela de tempo (RULES.md §4)
const MINUTOS_ANTES_INICIO = 10;
const MINUTOS_APOS_FIM     = 60;

export type MotivoCheckin =
  | 'FATURA_PENDENTE'
  | 'SEM_PAGAMENTO_MES'
  | 'FORA_DA_JANELA'
  | 'JA_REALIZADO'
  | 'AULA_NAO_ENCONTRADA'
  | 'ALUNO_INATIVO';

export type CheckinResultado =
  | { permitido: true }
  | { permitido: false; motivo: MotivoCheckin };

interface ValidarCheckinParams {
  aulaId: string;
  alunoId: string;
  academiaId: string;
  agora?: Date; // injetável para testes
}

/**
 * Valida se um aluno pode realizar o check-in numa aula.
 * Deve ser chamada apenas de endpoints Astro (server-side).
 * Nunca expõe valores de faturas — retorna apenas o resultado booleano.
 */
export async function validarCheckin({
  aulaId,
  alunoId,
  academiaId,
  agora = new Date(),
}: ValidarCheckinParams): Promise<CheckinResultado> {
  const admin = createSupabaseAdminClient();

  // ─── 1. Busca a aula ────────────────────────────────────────────────────────
  const { data: aula, error: aulaError } = await admin
    .from('aulas_agenda')
    .select('id, data_aula, horario_inicio, horario_fim, academia_id')
    .eq('id', aulaId)
    .eq('academia_id', academiaId)
    .single<AulaAgenda>();

  if (aulaError || !aula) {
    return { permitido: false, motivo: 'AULA_NAO_ENCONTRADA' };
  }

  // ─── 2. Valida janela de tempo ──────────────────────────────────────────────
  if (!verificarJanelaTempo(aula, agora)) {
    return { permitido: false, motivo: 'FORA_DA_JANELA' };
  }

  // ─── 3. Verifica check-in duplicado ────────────────────────────────────────
  const { data: checkinExistente } = await admin
    .from('checkins')
    .select('id')
    .eq('aula_id', aulaId)
    .eq('aluno_id', alunoId)
    .maybeSingle();

  if (checkinExistente) {
    return { permitido: false, motivo: 'JA_REALIZADO' };
  }

  // ─── 4. Trava financeira A: faturas em aberto ───────────────────────────────
  const temBloqueante = await contarFaturas(admin, alunoId, academiaId, {
    status: STATUS_BLOQUEANTE,
  });
  if (temBloqueante > 0) {
    return { permitido: false, motivo: 'FATURA_PENDENTE' };
  }

  // ─── 5. Trava financeira B: exige pagamento do mês vigente ─────────────────
  const mesAtual = primeiroDiaMes(agora);
  const temPagoMes = await contarFaturas(admin, alunoId, academiaId, {
    status: ['paga'],
    mesReferencia: mesAtual,
  });
  if (temPagoMes === 0) {
    return { permitido: false, motivo: 'SEM_PAGAMENTO_MES' };
  }

  return { permitido: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers privados
// ─────────────────────────────────────────────────────────────────────────────

/** Verifica janela [inicio - 10min, fim + 60min] */
function verificarJanelaTempo(aula: AulaAgenda, agora: Date): boolean {
  const inicioAula      = parseDatetime(aula.data_aula, aula.horario_inicio);
  const fimAula         = parseDatetime(aula.data_aula, aula.horario_fim);
  const aberturaCheckin = new Date(inicioAula.getTime() - MINUTOS_ANTES_INICIO * 60_000);
  const fechamento      = new Date(fimAula.getTime()    + MINUTOS_APOS_FIM     * 60_000);
  return agora >= aberturaCheckin && agora <= fechamento;
}

/** Consulta faturas com filtros opcionais — retorna apenas a contagem. */
async function contarFaturas(
  admin: SupabaseClient,
  alunoId: string,
  academiaId: string,
  filtros: { status: FaturaStatus[]; mesReferencia?: string },
): Promise<number> {
  let query = admin
    .from('faturas')
    .select('id', { count: 'exact', head: true })
    .eq('aluno_id', alunoId)
    .eq('academia_id', academiaId)
    .in('status', filtros.status);

  if (filtros.mesReferencia) {
    query = query.eq('mes_referencia', filtros.mesReferencia);
  }

  const { count, error } = await query;

  if (error)
    return -1; // falha na consulta → bloqueia por segurança

  return count ?? 0;
}

/** Retorna 'YYYY-MM-DD' com dia 1 do mês de uma data. */
function primeiroDiaMes(data: Date): string {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-01`;
}

/** Combina 'YYYY-MM-DD' + 'HH:MM:SS' em um Date local. */
function parseDatetime(data: string, horario: string): Date {
  return new Date(`${data}T${horario}`);
}
