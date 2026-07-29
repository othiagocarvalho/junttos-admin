import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabaseAnonKey = rawKey ? rawKey.trim().replace(/[^\x20-\x7E]/g, '') : ''

export const supabaseConsultor = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { storageKey: 'sb-consultor-auth' },
})
