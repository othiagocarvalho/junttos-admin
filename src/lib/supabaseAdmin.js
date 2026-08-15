import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabaseAnonKey = rawKey ? rawKey.trim().replace(/[^\x20-\x7E]/g, '') : ''

/**
 * Client próprio para a sessão do painel Junttos.
 *
 * storageKey separada, como o supabaseConsultor já faz: sem isso, o painel e o
 * app das lojas dividiriam a mesma chave no localStorage, e entrar num
 * derrubaria a sessão do outro no mesmo navegador. Também garante que a
 * migração do login admin não encoste em nenhuma sessão de lojista existente.
 *
 * Continua usando a anon key — quem autoriza é o RLS mais o claim de role no
 * app_metadata. Chave de service_role nunca chega ao browser.
 */
export const supabaseAdmin = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { storageKey: 'sb-admin-auth' },
})
