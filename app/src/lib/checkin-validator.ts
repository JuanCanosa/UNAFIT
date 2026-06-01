/**
 * Lógica de validação do check-in — executada APENAS no servidor (Astro SSR).
 *
 * Regras vigentes:
 *  1. Janela de Tempo: 10min antes do início até 10min após o FIM da aula.
 *  2. Sem check-in duplicado na mesma aula.
 *
 * Nota: a trava financeira foi removida por decisão de produto — o aluno
 * com pendências vê apenas um banner informativo, mas pode treinar normalmente.
 */

import { createSupabaseAdminClient } from './supabase';
import type { AulaAgenda } from '@/types/database';

const MINUTOS_ANTES_INICIO = 10;
const MINUTOS_APOS_FIM     = 10;

export type MotivoCheckin =
  | 'FORA_DA_JANELA'
  | 'JA_REALIZADO'
  | 'AULA_NAO_ENCONTRADA'
  | 'ALUNO_INATIVO'
  | 'SEM_VAGAS'
  | 'MODALIDADE_BLOQUEADA';

export type CheckinResultado =
  | { permitido: true }
  | { permitido: false; motivo: MotivoCheckin };

interface ValidarCheckinParams {
  aulaId: string;
  alunoId: string;
  academiaId: string;
  agora?: Date;
}

export async function validarCheckin({
  aulaId,
  alunoId,
  academiaId,
  agora = new Date(),
}: ValidarCheckinParams): Promise<CheckinResultado> {
  const admin = createSupabaseAdminClient();

  // 1. Busca a aula (inclui modalidade para validação)
  const { data: aula, error: aulaError } = await admin
    .from('aulas_agenda')
    .select('id, data_aula, horario_inicio, horario_fim, capacidade_max, academia_id, modalidade')
    .eq('id', aulaId)
    .eq('academia_id', academiaId)
    .single<AulaAgenda & { capacidade_max: number | null; modalidade: string }>();

  if (aulaError || !aula) {
    return { permitido: false, motivo: 'AULA_NAO_ENCONTRADA' };
  }

  // 2. Janela de tempo
  if (!verificarJanelaTempo(aula, agora)) {
    return { permitido: false, motivo: 'FORA_DA_JANELA' };
  }

  // 3. Check-in duplicado + vínculo do aluno em paralelo
  const [{ data: existente }, { data: vinculo }] = await Promise.all([
    admin.from('checkins').select('id').eq('aula_id', aulaId).eq('aluno_id', alunoId).maybeSingle(),
    admin.from('aluno_academias').select('aluno_id').eq('profile_id', alunoId).eq('academia_id', academiaId).maybeSingle(),
  ]);

  if (existente) {
    return { permitido: false, motivo: 'JA_REALIZADO' };
  }

  // 4. Validação de modalidade
  // Se o aluno tiver modalidades configuradas, a aula deve ser de uma delas
  if (vinculo?.aluno_id) {
    const { data: mods } = await admin
      .from('aluno_modalidades')
      .select('modalidade')
      .eq('aluno_id', vinculo.aluno_id)
      .eq('academia_id', academiaId);

    const modalidadesAluno = (mods ?? []).map((m: any) => m.modalidade as string);
    if (modalidadesAluno.length > 0 && !modalidadesAluno.includes((aula as any).modalidade)) {
      return { permitido: false, motivo: 'MODALIDADE_BLOQUEADA' };
    }
  }

  // 5. Capacidade (NULL ou 0 = ilimitado)
  const cap = (aula as any).capacidade_max;
  if (cap && cap > 0) {
    const { count } = await admin
      .from('checkins')
      .select('id', { count: 'exact', head: true })
      .eq('aula_id', aulaId);

    if ((count ?? 0) >= cap) {
      return { permitido: false, motivo: 'SEM_VAGAS' };
    }
  }

  return { permitido: true };
}

function verificarJanelaTempo(aula: AulaAgenda, agora: Date): boolean {
  // Horários armazenados no fuso de Brasília (UTC-3) — offset explícito para comparação correta
  const inicio     = parseBrazilDatetime(aula.data_aula, aula.horario_inicio);
  const fim        = parseBrazilDatetime(aula.data_aula, aula.horario_fim);
  const abertura   = new Date(inicio.getTime() - MINUTOS_ANTES_INICIO * 60_000);
  const fechamento = new Date(fim.getTime()    + MINUTOS_APOS_FIM     * 60_000);
  return agora >= abertura && agora <= fechamento;
}

function parseBrazilDatetime(data: string, horario: string): Date {
  // Garante segundos para o formato ISO e usa offset -03:00 de Brasília
  const hh = horario.length === 5 ? horario + ':00' : horario;
  return new Date(`${data}T${hh}-03:00`);
}
