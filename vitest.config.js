import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'src/**/*.test.js',
      'src/**/*.test.jsx',
      // Edge Functions rodam em Deno e não são importáveis daqui em geral —
      // mas os módulos de regra pura delas são. Testar o arquivo real evita
      // manter uma cópia da regra só para o teste ver.
      'supabase/functions/**/*.test.ts',
    ],
    // src/lib/supabase.js chama createClient no topo do módulo, e o
    // createClient recusa URL vazia com "supabaseUrl is required". Sem estas
    // duas variáveis, QUALQUER teste que importe (mesmo indiretamente) o
    // cliente falha na importação, antes de rodar um único caso — era o que
    // derrubava useCreateLoja.test.js e EstoqueMobile.test.js.
    //
    // São credenciais de fachada: nenhum teste faz rede. Quem precisa simular
    // o banco injeta um fake (ver criarLojaFluxo.test.js).
    env: {
      VITE_SUPABASE_URL:      'http://localhost:54321',
      VITE_SUPABASE_ANON_KEY: 'chave-de-teste-sem-valor',
    },
  },
})
