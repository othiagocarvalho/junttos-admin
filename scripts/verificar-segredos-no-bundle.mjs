#!/usr/bin/env node
/**
 * Trava anti-vazamento de segredo no front-end.
 *
 * Roda DEPOIS do `vite build` (está encadeado no script `build` do
 * package.json) e derruba o build — código de saída 1 — se encontrar:
 *
 *   1. no bundle publicado (dist/): uma chave `sb_secret_…` ou um JWT do
 *      Supabase cujo payload declara `role: service_role`;
 *   2. no código-fonte (src/): a mesma coisa colada em texto puro, ou um
 *      acesso ao objeto de ambiente do Vite sem propriedade nomeada atrás
 *      (espalhar, guardar em constante, serializar, logar, indexar com
 *      colchete) — que faz o Vite injetar TODAS as variáveis `VITE_` no
 *      bundle, inclusive as que ninguém pediu.
 *
 * POR QUE: auditoria de segurança achou VITE_SUPABASE_SERVICE_KEY,
 * VITE_ADMIN_PASSWORD e VITE_GESTOR_PASSWORD configuradas na Vercel. Com o
 * prefixo `VITE_`, o Vite embute o valor no JavaScript que qualquer visitante
 * baixa. Nada em src/ lia essas variáveis, então nada vazou — mas a distância
 * entre "não vazou" e "vazou" era uma linha de código. Esta trava é essa
 * distância, agora permanente. Ver docs/SEGREDOS_E_VARIAVEIS.md.
 *
 * Uso:
 *   node scripts/verificar-segredos-no-bundle.mjs
 *   node scripts/verificar-segredos-no-bundle.mjs --sem-bundle    # só src/
 *   node scripts/verificar-segredos-no-bundle.mjs --bundle=<dir>  # outra pasta
 *   node scripts/verificar-segredos-no-bundle.mjs --fonte=<dir>   # outra fonte
 *
 * Os dois últimos existem para o teste de mutação (src/utils/
 * segredosBundle.test.js) apontar a trava para uma pasta-isca e provar que
 * ela realmente reprova — uma trava que nunca falhou não é uma trava.
 */

import fs from 'node:fs'
import path from 'node:path'
import {
  acharSegredosNoTexto,
  acharAcessoEnvInseguro,
} from '../src/utils/segredosBundle.js'

const raiz = path.resolve(import.meta.dirname, '..')

const argBundle = process.argv.find(a => a.startsWith('--bundle='))
const DIR_BUNDLE = argBundle
  ? path.resolve(raiz, argBundle.slice('--bundle='.length))
  : path.join(raiz, 'dist')
const argFonte = process.argv.find(a => a.startsWith('--fonte='))
const DIR_FONTE = argFonte
  ? path.resolve(raiz, argFonte.slice('--fonte='.length))
  : path.join(raiz, 'src')
const SEM_BUNDLE = process.argv.includes('--sem-bundle')

/** Extensões do bundle que carregam texto — é onde um segredo apareceria. */
const EXT_BUNDLE = new Set(['.js', '.mjs', '.cjs', '.css', '.html', '.json', '.map', '.txt', '.svg', '.webmanifest'])
const EXT_FONTE  = new Set(['.js', '.jsx'])

/**
 * Arquivos que a varredura de fonte pula, e por quê:
 *   · o próprio detector guarda os padrões procurados como texto — ele
 *     acusaria a si mesmo a cada rodada;
 *   · testes (*.test.js) carregam fixtures propositalmente "sujas" e nunca
 *     entram no bundle, porque nada partindo de main.jsx os importa.
 */
const IGNORAR_FONTE = [
  path.join('utils', 'segredosBundle.js'),
]
const ehTeste = arq => /\.test\.jsx?$/.test(arq)

function listar(dir, extensoes) {
  if (!fs.existsSync(dir)) return []
  const saida = []
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const completo = path.join(dir, item.name)
    if (item.isDirectory()) { saida.push(...listar(completo, extensoes)); continue }
    if (extensoes.has(path.extname(item.name).toLowerCase())) saida.push(completo)
  }
  return saida
}

const rel = p => path.relative(raiz, p)

// ── Varredura ─────────────────────────────────────────────────
const problemas = []

if (!SEM_BUNDLE) {
  if (!fs.existsSync(DIR_BUNDLE)) {
    console.error(`❌ Bundle não encontrado em ${rel(DIR_BUNDLE)}.`)
    console.error('   Rode `npm run build` (que já chama esta verificação),')
    console.error('   ou use --sem-bundle para checar só o código-fonte.')
    process.exit(1)
  }

  const arquivos = listar(DIR_BUNDLE, EXT_BUNDLE)
  for (const arq of arquivos) {
    for (const achado of acharSegredosNoTexto(fs.readFileSync(arq, 'utf8'))) {
      problemas.push({
        arquivo: rel(arq),
        linha: achado.linha,
        titulo: achado.tipo === 'jwt-service-role'
          ? 'JWT com role: service_role dentro do bundle publicado'
          : 'Chave secreta do Supabase (sb_secret_) dentro do bundle publicado',
        detalhe: achado.trecho,
      })
    }
  }
  console.log(`🔎 Bundle: ${arquivos.length} arquivo(s) verificado(s) em ${rel(DIR_BUNDLE)}`)
}

{
  const arquivos = listar(DIR_FONTE, EXT_FONTE).filter(arq => {
    const r = path.relative(DIR_FONTE, arq)
    return !ehTeste(r) && !IGNORAR_FONTE.includes(r)
  })

  for (const arq of arquivos) {
    const codigo = fs.readFileSync(arq, 'utf8')

    for (const achado of acharSegredosNoTexto(codigo)) {
      problemas.push({
        arquivo: rel(arq),
        linha: achado.linha,
        titulo: achado.tipo === 'jwt-service-role'
          ? 'JWT com role: service_role colado no código-fonte'
          : 'Chave secreta do Supabase (sb_secret_) colada no código-fonte',
        detalhe: achado.trecho,
      })
    }

    for (const achado of acharAcessoEnvInseguro(codigo)) {
      problemas.push({
        arquivo: rel(arq),
        linha: achado.linha,
        titulo: 'Acesso ao ambiente do Vite sem propriedade nomeada — injeta TODAS as variáveis VITE_ no bundle',
        detalhe: achado.contexto,
      })
    }
  }
  console.log(`🔎 Fonte:  ${arquivos.length} arquivo(s) verificado(s) em ${rel(DIR_FONTE)}`)
}

// ── Resultado ─────────────────────────────────────────────────
if (problemas.length === 0) {
  console.log('✅ Nenhum segredo exposto e nenhum acesso perigoso ao ambiente.')
  process.exit(0)
}

console.error(`\n❌ ${problemas.length} problema(s) de segredo — build barrado.\n`)
for (const p of problemas) {
  console.error(`   ${p.arquivo}:${p.linha}`)
  console.error(`   ↳ ${p.titulo}`)
  console.error(`     ${p.detalhe}\n`)
}
console.error('   Como resolver: docs/SEGREDOS_E_VARIAVEIS.md')
console.error('   Regra curta: prefixo VITE_ só para valor que pode ser público.')
console.error('   Se um segredo real chegou a ser publicado, ROTACIONE a chave —')
console.error('   apagar do código não desfaz o que já foi baixado por visitantes.\n')
process.exit(1)
