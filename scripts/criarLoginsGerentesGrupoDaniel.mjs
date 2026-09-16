#!/usr/bin/env node
/**
 * Cria (ou atualiza, se o e-mail já existir) logins de loja com papel
 * restrito, direto no Supabase Auth Admin API — mesmo padrão dos scripts
 * scripts/create-*-user.mjs já existentes, só que genérico: recebe uma
 * LISTA de { email, senha, loja_id, papel } em vez de um usuário fixo.
 *
 * Por que a Auth Admin API direta e não a Edge Function `create-user`: a
 * function hoje só aceita loja_id/consultant_id no app_metadata (não tem
 * campo `papel`) e ainda faria um insert em lf_usuarios que essas contas não
 * precisam (lf_usuarios é para "colaboradoras" com acesso completo — ver
 * CatalogoB2BAdmin.jsx; login de papel restrito é um conceito à parte, só
 * app_metadata.papel, sem linha correspondente em nenhuma tabela). Chamar a
 * Admin API direto evita reescrever a function para um caso que ela não
 * cobre.
 *
 * Como estas são contas NOVAS (e-mail nunca visto), createUser nunca
 * sobrescreve loja_id de outro usuário — cada e-mail é único e o
 * app_metadata nasce só com o que este script manda. Se o e-mail já existir
 * (reexecução do script), o update também manda loja_id E papel juntos
 * explicitamente, então não há ambiguidade sobre merge parcial de
 * app_metadata.
 *
 * Uso:
 *   SUPABASE_SERVICE_KEY=<service_role> node scripts/criarLoginsGerentesGrupoDaniel.mjs
 *
 * Reaproveitável para qualquer loja: importe LOGINS de outro arquivo, ou
 * troque a constante abaixo por outra lista de { email, senha, loja_id, papel }.
 */

import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

function lerEnv(arquivo) {
  const out = {}
  if (!fs.existsSync(arquivo)) return out
  for (const linha of fs.readFileSync(arquivo, 'utf8').split('\n')) {
    const m = linha.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*)$/)
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
  }
  return out
}

const raiz = path.resolve(import.meta.dirname, '..')
const env  = lerEnv(path.join(raiz, '.env'))

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY || env.SUPABASE_SERVICE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Defina VITE_SUPABASE_URL e SUPABASE_SERVICE_KEY (variável de ambiente ou .env).')
  console.error('   Ex.: SUPABASE_SERVICE_KEY=<chave> node scripts/criarLoginsGerentesGrupoDaniel.mjs')
  process.exit(1)
}

// Lista fixa desta chamada — grupo do Daniel (Tropicale, Atacadão dos
// Vestidos, Belinha 1, Belinha 2). loja_id confirmado em lf_config/jt_redes
// na investigação anterior. Para outra loja no futuro, troque esta lista (ou
// importe de outro módulo) e rode de novo — o restante do script não muda.
const LOGINS = [
  { email: 'tropicale.vendas@junttos.com.br', senha: 'tropicale@vendas', loja_id: 'tropicaleatacado',    papel: 'gerente' },
  { email: 'atacadao.vendas@junttos.com.br',  senha: 'atacadao@vendas',  loja_id: 'atacadaodosvestidos', papel: 'gerente' },
  { email: 'belinha1.vendas@junttos.com.br',  senha: 'belinha1@vendas',  loja_id: 'belinha1',            papel: 'gerente' },
  { email: 'belinha2.vendas@junttos.com.br',  senha: 'belinha2@vendas',  loja_id: 'belinha2',            papel: 'gerente' },
]

async function criarOuAtualizar(sb, { email, senha, loja_id, papel }) {
  // Confirma que a loja existe antes de criar o login — mesmo cuidado dos
  // scripts create-*-user.mjs existentes.
  const { data: loja, error: lojaErr } = await sb
    .from('lf_config').select('loja_id, slug, nome').eq('loja_id', loja_id).maybeSingle()
  if (lojaErr) return { email, ok: false, motivo: `erro ao consultar lf_config: ${lojaErr.message}` }
  if (!loja) return { email, ok: false, motivo: `loja_id '${loja_id}' não existe em lf_config` }

  const { data: { users }, error: listErr } = await sb.auth.admin.listUsers()
  if (listErr) return { email, ok: false, motivo: `erro ao listar usuários: ${listErr.message}` }

  const existente = users.find(u => u.email === email)
  if (existente) {
    const { error: updErr } = await sb.auth.admin.updateUserById(existente.id, {
      password: senha,
      app_metadata: { loja_id, papel },
      email_confirm: true,
    })
    if (updErr) return { email, ok: false, motivo: `erro ao atualizar: ${updErr.message}` }
    return { email, ok: true, acao: 'atualizado', loja: loja.nome, slug: loja.slug }
  }

  const { data, error: createErr } = await sb.auth.admin.createUser({
    email, password: senha, email_confirm: true,
    app_metadata: { loja_id, papel },
  })
  if (createErr) return { email, ok: false, motivo: `erro ao criar: ${createErr.message}` }
  return { email, ok: true, acao: 'criado', id: data.user.id, loja: loja.nome, slug: loja.slug }
}

async function main() {
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })

  console.log(`Criando/atualizando ${LOGINS.length} login(s) com papel restrito...\n`)
  for (const login of LOGINS) {
    const r = await criarOuAtualizar(sb, login)
    if (r.ok) {
      console.log(`✅ ${r.email} — ${r.acao} (loja: ${r.loja}, /${r.slug}/, papel: gerente)`)
    } else {
      console.log(`❌ ${r.email} — ${r.motivo}`)
    }
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
