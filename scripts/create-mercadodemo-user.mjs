import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL  = 'https://dbfxigylileupucnuhmb.supabase.co'
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_KEY

if (!SERVICE_KEY) {
  console.error('❌ Defina SUPABASE_SERVICE_KEY antes de rodar.')
  console.error('   Exemplo: SUPABASE_SERVICE_KEY=<chave> node scripts/create-mercadodemo-user.mjs')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const EMAIL    = 'mercadodemo@junttos.com.br'
const PASSWORD = 'mercado@2026'
const LOJA_ID  = 'mercadodemo'

async function main() {
  console.log(`Criando usuário Auth para loja '${LOJA_ID}'...\n`)

  // Verifica se já existe
  const { data: { users }, error: listErr } = await supabase.auth.admin.listUsers()
  if (listErr) { console.error('❌ Erro ao listar usuários:', listErr.message); process.exit(1) }

  const existing = users.find(u => u.email === EMAIL)
  if (existing) {
    console.log(`⚠️  Usuário ${EMAIL} já existe (id: ${existing.id}).`)
    console.log('   Atualizando app_metadata e senha...\n')

    const { error: updErr } = await supabase.auth.admin.updateUserById(existing.id, {
      password: PASSWORD,
      app_metadata: { loja_id: LOJA_ID },
      email_confirm: true,
    })
    if (updErr) { console.error('❌ Erro ao atualizar:', updErr.message); process.exit(1) }
    console.log('✅ Usuário atualizado com sucesso.')
  } else {
    const { data, error: createErr } = await supabase.auth.admin.createUser({
      email:          EMAIL,
      password:       PASSWORD,
      email_confirm:  true,
      app_metadata:   { loja_id: LOJA_ID },
    })
    if (createErr) { console.error('❌ Erro ao criar usuário:', createErr.message); process.exit(1) }
    console.log(`✅ Usuário criado! id: ${data.user.id}`)
  }

  // Confirma app_metadata salvo
  const { data: { users: check } } = await supabase.auth.admin.listUsers()
  const u = check.find(u => u.email === EMAIL)
  console.log('\n── Estado final ──────────────────────────')
  console.log(`   email:        ${u?.email}`)
  console.log(`   confirmed:    ${u?.email_confirmed_at ? '✅ sim' : '❌ não'}`)
  console.log(`   app_metadata: ${JSON.stringify(u?.app_metadata)}`)
  console.log(`   loja_id ok:   ${u?.app_metadata?.loja_id === LOJA_ID ? '✅ sim' : '❌ não'}`)
  console.log('\n── Credenciais de acesso ─────────────────')
  console.log(`   URL:   /mercadodemo/`)
  console.log(`   Email: ${EMAIL}`)
  console.log(`   Senha: ${PASSWORD}`)
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
