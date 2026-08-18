// Slides do tour de boas-vindas.
//
// Função pura: recebe o plano e o que a loja já tem cadastrado, devolve a
// lista de slides. Sem React e sem Supabase — a régua de quem vê o quê é
// dinheiro de assinatura e precisa ser testável sozinha.
//
// Duas filtragens acontecem aqui:
//   1. por PLANO, com o mesmo temAcesso do resto do sistema
//   2. por USO REAL: o texto muda se a loja já tem produto/cliente/meta.
//      Mostrar "cadastre o primeiro produto" para quem tem 141 é ruído.

import { temAcesso } from './planos'

/** 'YYYY-MM' do mês corrente, no fuso local (toISOString devolveria UTC). */
export function competenciaAtual(hoje = new Date()) {
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`
}

/** A loja tem meta cadastrada para o mês corrente? */
export function temMetaDoMes(metas = {}, hoje = new Date()) {
  const v = metas?.[competenciaAtual(hoje)]
  return Number(v) > 0
}

// Nome do ícone (resolvido para o componente lá na tela) + textos.
// `texto` é o padrão; `textoVazio` entra quando a loja ainda não usa aquilo.
const FEATURES = [
  {
    id: 'venda', icone: 'venda', planoMinimo: 'starter', titulo: 'Nova Venda',
    texto: 'Registre vendas em 3 passos simples: cliente, produtos e pagamento.',
  },
  {
    id: 'estoque', icone: 'estoque', planoMinimo: 'starter', titulo: 'Estoque',
    texto: 'Acompanhe a quantidade de cada produto e receba aviso quando estiver acabando.',
    textoVazio: 'Cadastre seus produtos aqui — depois o sistema avisa sozinho quando algum estiver acabando.',
    condicao: 'produtos',
  },
  {
    id: 'fechamento', icone: 'fechamento', planoMinimo: 'starter', titulo: 'Fechamento',
    texto: 'Feche o caixa do dia e confira se bateu certinho com o que foi vendido.',
  },
  {
    id: 'clientes', icone: 'clientes', planoMinimo: 'starter', titulo: 'Clientes',
    texto: 'Cadastre quem compra com você e veja o histórico de compras de cada um.',
    textoVazio: 'Comece cadastrando quem compra com você — o histórico de cada cliente se monta sozinho depois.',
    condicao: 'clientes',
  },
  {
    id: 'meta', icone: 'meta', planoMinimo: 'starter', titulo: 'Metas',
    texto: 'Acompanhe o progresso da sua meta do mês direto na tela inicial.',
    textoVazio: 'Defina uma meta de faturamento no mês e acompanhe o progresso na tela inicial.',
    condicao: 'meta',
  },
  {
    id: 'crediario', icone: 'crediario', planoMinimo: 'pro', titulo: 'Crediário',
    texto: 'Venda fiado com parcelas e controle quem está devendo, sem caderneta.',
  },
  {
    id: 'relatorios_avancados', icone: 'relatorios', planoMinimo: 'pro', titulo: 'Relatórios avançados',
    texto: 'Curva ABC de produtos e comissão automática por vendedora.',
  },
  {
    id: 'catalogo', icone: 'catalogo', planoMinimo: 'business', titulo: 'Catálogo online',
    texto: 'Uma vitrine própria pra sua loja, com Pix, pra vender também fora do balcão.',
  },
  {
    id: 'financeiro', icone: 'financeiro', planoMinimo: 'business', titulo: 'Financeiro',
    texto: 'Contas a pagar, a receber, fluxo de caixa e DRE num só lugar.',
  },
  {
    id: 'catalogo_b2b', icone: 'b2b', planoMinimo: 'business', titulo: 'Catálogo B2B',
    texto: 'Venda no atacado com pedido mínimo e grade de tamanho pra outras lojas.',
  },
]

/** Rótulo do plano para o slide de boas-vindas. */
export function labelPlano(plano) {
  return { starter: 'Starter', pro: 'Pro', business: 'Business' }[plano] || 'Starter'
}

/**
 * Monta os slides do tour.
 *
 * @param nomeLoja     nome fantasia, usado na saudação
 * @param plano        'starter' | 'pro' | 'business'
 * @param temProdutos  a loja já cadastrou produto?
 * @param temClientes  a loja já cadastrou cliente?
 * @param temMeta      a loja já definiu a meta do mês?
 */
export function construirSlides({
  nomeLoja = 'sua loja',
  plano = 'starter',
  temProdutos = false,
  temClientes = false,
  temMeta = false,
} = {}) {
  const usa = { produtos: temProdutos, clientes: temClientes, meta: temMeta }

  const features = FEATURES
    .filter(f => temAcesso(plano, f.planoMinimo))
    .map(f => ({
      id: f.id,
      tipo: 'feature',
      icone: f.icone,
      titulo: f.titulo,
      // Sem textoVazio, o slide é igual para todo mundo.
      texto: f.condicao && f.textoVazio && !usa[f.condicao] ? f.textoVazio : f.texto,
    }))

  return [
    {
      id: 'boasvindas',
      tipo: 'boasvindas',
      titulo: `Seja muito bem vindo a Junttos, ${nomeLoja}.`,
      texto: `Você contratou o plano ${labelPlano(plano)}. Vamos fazer uma tour para você conhecer?`,
      plano: labelPlano(plano),
    },
    ...features,
  ]
}
