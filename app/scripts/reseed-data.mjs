/**
 * Reinsere dados de seed após recreate-users.mjs.
 * Os UUIDs dos usuários mudaram — busca os novos UUIDs por e-mail
 * e reinsere faturas, checkins, resultados e corrige wods/aulas.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL     = 'https://skcvbaiqeubbyhdcqjkc.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNrY3ZiYWlxZXViYnloZGNxamtjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTc3MjU0NCwiZXhwIjoyMDkxMzQ4NTQ0fQ.cw8vrqjFpaPHNSmk_Ql74RWn8t3bM1tb1RHsAxnzxvs';

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── 1. Busca UUIDs reais por e-mail ──────────────────────────────────────────
console.log('\n── Buscando UUIDs dos usuários criados...');
const { data: { users }, error: listErr } = await admin.auth.admin.listUsers();
if (listErr) { console.error('❌', listErr.message); process.exit(1); }

const byEmail = Object.fromEntries(users.map(u => [u.email, u.id]));

const ID = {
  professor : byEmail['professor@crossfit-exemplo.com'],
  alunoRx   : byEmail['joao.rx@email.com'],
  alunoSc   : byEmail['maria.scaled@email.com'],
};

const ACADEMIA_ID = 'ace00000-0000-0000-0000-000000000001';
const WOD_FRAN    = 'e055e000-0000-0000-0000-000000000001';
const AULA_19H    = 'f066f000-0000-0000-0000-000000000001';

console.log('  professor :', ID.professor);
console.log('  joao.rx   :', ID.alunoRx);
console.log('  maria     :', ID.alunoSc);

// ── 2. Garante que o WOD Fran existe ──────────────────────────────────────────
console.log('\n── Inserindo WOD Fran...');

const { error: w1 } = await admin.from('wods').upsert({
  id: WOD_FRAN,
  academia_id: ACADEMIA_ID,
  nome: 'Fran',
  homenagem: 'Um dos WODs benchmark mais icônicos do CrossFit, criado por Greg Glassman.',
  mobilidade: '2 rounds: 10 dislocates + 10 pass-throughs com PVC',
  aquecimento: '3 rounds: 10 air squats + 10 kipping swings + 5 thrusters leves',
  treino: '21-15-9 reps de:\n- Thruster (43kg / 29kg)\n- Pull-up\nPara Tempo.',
  score_type: 'tempo',
  criado_por: ID.professor,
}, { onConflict: 'id' });
console.log(w1 ? `  ❌ wod: ${w1.message}` : '  ✅ WOD Fran ok');

// ── 3. Garante que as aulas existem ────────────────────────────────────────────
console.log('\n── Inserindo aulas...');

const aulas = [
  {
    id: 'f066f000-0000-0000-0000-000000000001',
    academia_id: ACADEMIA_ID, wod_id: WOD_FRAN,
    data_aula: '2026-04-10', horario_inicio: '19:00', horario_fim: '20:00',
    capacidade_max: 15, criado_por: ID.professor,
  },
  {
    id: 'f0770000-0000-0000-0000-000000000002',
    academia_id: ACADEMIA_ID, wod_id: WOD_FRAN,
    data_aula: '2026-04-10', horario_inicio: '20:00', horario_fim: '21:00',
    capacidade_max: 15, criado_por: ID.professor,
  },
];

for (const aula of aulas) {
  const { error } = await admin.from('aulas_agenda').upsert(aula, { onConflict: 'id' });
  console.log(error ? `  ❌ aula ${aula.horario_inicio}: ${error.message}` : `  ✅ Aula ${aula.horario_inicio} ok`);
}

// ── 3. Reinsere faturas ────────────────────────────────────────────────────────
console.log('\n── Reinserindo faturas...');

const faturas = [
  {
    academia_id: ACADEMIA_ID,
    aluno_id: ID.alunoRx,
    asaas_pagamento_id: 'pay_joao_rx_abr2026',
    valor: 150.00, status: 'paga',
    vencimento: '2026-04-05',
    pago_em: '2026-04-03T10:22:00+00:00',
    mes_referencia: '2026-04-01',
    descricao: 'Mensalidade Abril/2026 — João RX',
  },
  {
    academia_id: ACADEMIA_ID,
    aluno_id: ID.alunoSc,
    asaas_pagamento_id: 'pay_maria_sc_abr2026',
    valor: 150.00, status: 'pendente',
    vencimento: '2026-04-05',
    pago_em: null,
    mes_referencia: '2026-04-01',
    descricao: 'Mensalidade Abril/2026 — Maria Scaled',
  },
];

for (const f of faturas) {
  const { error } = await admin.from('faturas').insert(f);
  console.log(error ? `  ❌ ${f.descricao}: ${error.message}` : `  ✅ ${f.descricao}`);
}

// ── 4. Reinsere check-in (João RX — aula 19h) ────────────────────────────────
console.log('\n── Reinserindo check-in de João RX...');

// Usa service role para bypass do trigger de validação financeira no seed
const { error: ci } = await admin
  .from('checkins')
  .insert({ academia_id: ACADEMIA_ID, aula_id: AULA_19H, aluno_id: ID.alunoRx });

console.log(ci ? `  ❌ checkin: ${ci.message}` : '  ✅ Check-in inserido');

// ── 5. Reinsere resultado de performance ──────────────────────────────────────
console.log('\n── Reinserindo resultado de performance...');

const { error: rp } = await admin.from('resultados_performance').insert({
  academia_id: ACADEMIA_ID,
  aula_id: AULA_19H,
  aluno_id: ID.alunoRx,
  tempo: '00:08:32',
  rx_scaled: true,
  observacao: 'Unbroken nos thrusters, 2 breaks nos pull-ups.',
});
console.log(rp ? `  ❌ resultado: ${rp.message}` : '  ✅ Resultado inserido');

console.log('\n── Concluído! ✅\n');
console.log('Credenciais de teste:');
console.log('  dono@crossfit-exemplo.com      / Senha@123');
console.log('  professor@crossfit-exemplo.com / Senha@123');
console.log('  joao.rx@email.com              / Senha@123  ← fatura PAGA');
console.log('  maria.scaled@email.com         / Senha@123  ← fatura PENDENTE');
