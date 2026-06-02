/**
 * Lógica de validação do check-in — executada APENAS no servidor (Astro SSR).
 *
 * Regras vigentes:
 *  1. A aula deve ser do dia de hoje (fuso de Brasília).
 *  2. Sem check-in duplicado na mesma aula.
 *  3. Modalidade: se o aluno tiver modalidades configuradas, a aula deve ser de uma delas.
 *  4. Capacidade máxima não pode ser excedida.
 *
 * Removido: janela de horário (10min antes/depois) — aluno pode fazer check-in
 * em qualquer horário do dia da aula.
 *
 * Nota: a trava financeira foi removida por decisão de produto — o aluno
 * com pendências vê apenas um banner informativo, mas pode treinar normalmente.
 */

import { createSupabaseAdminClient } from './supabase';
import type { AulaAgenda } from '@/types/database';

export type MotivoCheckin =
  | 'AULA_NAO_DISPONIVEL'
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

  // 2. A aula deve ser de hoje E não pode ter encerrado há mais de 10 min
  const hojeISO = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(agora);
  if (aula.data_aula !== hojeISO) {
    return { permitido: false, motivo: 'AULA_NAO_DISPONIVEL' };
  }
  const hFim = aula.horario_fim.length === 5 ? aula.horario_fim + ':00' : aula.horario_fim;
  const fechamento = new Date(new Date(`${aula.data_aula}T${hFim}-03:00`).getTime() + 20 * 60_000);
  if (agora > fechamento) {
    return { permitido: false, motivo: 'AULA_NAO_DISPONIVEL' };
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
