/**
 * Recria os usuários de seed usando a Admin API do Supabase.
 * Garante que o GoTrue cria os campos internos corretamente.
 *
 * Execução: node scripts/recreate-users.mjs
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL     = 'https://skcvbaiqeubbyhdcqjkc.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNrY3ZiYWlxZXViYnloZGNxamtjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTc3MjU0NCwiZXhwIjoyMDkxMzQ4NTQ0fQ.cw8vrqjFpaPHNSmk_Ql74RWn8t3bM1tb1RHsAxnzxvs';

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const SEED_USERS = [
  { id: 'd011a000-0000-0000-0000-000000000001', email: 'dono@crossfit-exemplo.com',      role: 'dono',      nome: 'Carlos Dono'    },
  { id: 'b022b000-0000-0000-0000-000000000001', email: 'professor@crossfit-exemplo.com', role: 'professor', nome: 'Ana Professora'  },
  { id: 'a033c000-0000-0000-0000-000000000001', email: 'joao.rx@email.com',             role: 'aluno',     nome: 'João RX'        },
  { id: 'a044d000-0000-0000-0000-000000000002', email: 'maria.scaled@email.com',        role: 'aluno',     nome: 'Maria Scaled'   },
];

const ACADEMIA_ID = 'ace00000-0000-0000-0000-000000000001';
const PASSWORD    = 'Senha@123';

// ── 1. Remove usuários antigos via Admin API ───────────────────────────────────
console.log('\n── Removendo usuários antigos...');
for (const u of SEED_USERS) {
  const { error } = await admin.auth.admin.deleteUser(u.id);
  if (error && !error.message.includes('not found')) {
    console.error(`  ❌ Delete ${u.email}: ${error.message}`);
  } else {
    console.log(`  🗑  ${u.email} removido`);
  }
}

// ── 2. Recria via Admin API (GoTrue cria todos os campos corretamente) ─────────
console.log('\n── Criando usuários via Admin API...');
const createdIds = {};

for (const u of SEED_USERS) {
  const { data, error } = await admin.auth.admin.createUser({
    email:          u.email,
    password:       PASSWORD,
    email_confirm:  true,
    user_metadata:  { nome_completo: u.nome },
  });

  if (error) {
    console.error(`  ❌ Create ${u.email}: ${error.message}`);
    continue;
  }

  createdIds[u.id] = data.user.id;
  const sameId = data.user.id === u.id ? '(mesmo UUID ✅)' : `(novo UUID: ${data.user.id})`;
  console.log(`  ✅ ${u.email} criado ${sameId}`);
}

// ── 3. Se os UUIDs mudaram, atualiza as tabelas dependentes ───────────────────
console.log('\n── Verificando perfis no banco...');
for (const u of SEED_USERS) {
  const newId = createdIds[u.id];
  if (!newId) continue;

  if (newId !== u.id) {
    // Remove profile com UUID antigo (se sobrou) e insere com o novo
    console.log(`  🔄 UUID mudou para ${u.email}: ${u.id} → ${newId}`);
  }

  // Upsert do profile (cria se não existe, atualiza se existe)
  const { error } = await admin
    .from('profiles')
    .upsert({
      id:           newId,
      academia_id:  ACADEMIA_ID,
      role:         u.role,
      nome_completo: u.nome,
      ativo:        true,
    }, { onConflict: 'id' });

  if (error) {
    console.error(`  ❌ Profile ${u.email}: ${error.message}`);
  } else {
    console.log(`  ✅ Profile ${u.email} ok`);
  }
}

console.log('\n── Concluído. Tente logar com Senha@123\n');
