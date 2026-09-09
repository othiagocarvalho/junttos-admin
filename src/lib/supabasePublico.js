// Client Supabase para as páginas PÚBLICAS (catálogo do cliente final).
//
// ─── POR QUE NÃO REUSAR O `supabase` DO PAINEL ──────────────────────────────
// O client de src/lib/supabase.js é criado sem opções, então vem com
// persistSession ligado: ele lê a sessão do localStorage e manda
// `Authorization: Bearer <JWT do usuário>` em toda requisição.
//
// No catálogo isso produziu um bug real (23/08/2026, Tropicale):
//
//   Failed to load resource: 403  →  .../lf_pedidos?select=id
//   [catalogo] não foi possível registrar o pedido
//
// Cliente comum, deslogada, pedia normalmente. Quem NÃO conseguia era a
// lojista conferindo o próprio catálogo — porque, com sessão no navegador, o
// pedido saía como `authenticated`, e lf_pedidos só concede INSERT a `anon`
// (ver supabase/migration_rls_pedidos.sql). Página pública falando como
// usuário logado é o tipo de coisa que só aparece em produção, e no navegador
// de quem trabalha na loja.
//
// Aqui a sessão fica de fora de propósito:
//   persistSession     não grava nem LÊ sessão — é o que garante o papel anon
//   autoRefreshToken   sem sessão não há o que renovar; evita timer à toa
//   detectSessionInUrl não processa #access_token da URL, que numa página
//                      pública seria só ruído
//   storageKey         chave própria, para nunca encostar na do painel caso
//                      alguma versão futura do supabase-js volte a escrever
//
// O catálogo não usa sessão para nada: lê lf_config e lf_produtos, insere em
// lf_pedidos e invoca a Edge Function mp-criar-pix — os quatro caminhos já
// funcionam com a anon key hoje, que é como a cliente final deslogada usa.

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
// Mesma higienização do client do painel: a chave já chegou com caractere
// invisível colado em variável de ambiente de deploy.
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabaseAnonKey = rawKey ? rawKey.trim().replace(/[^\x20-\x7E]/g, '') : ''

export const supabasePublico = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
    storageKey: 'sb-junttos-publico',
  },
})
