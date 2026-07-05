export const VERTICAIS = [
  {
    id: 'moda',
    nome: 'Moda',
    icone: 'Shirt',
    precos: {
      starter:  'R$ 99,90',
      pro:      'R$ 149,90',
      business: 'R$ 259,90',
    },
    perguntas: [
      {
        id: 'lojas',
        texto: 'Quantas lojas você tem hoje?',
        opcoes: [
          {
            texto: '1 loja',
            score: { starter: 3, pro: 0, business: 0 },
            sinal: { starter: 'você opera uma única loja' },
          },
          {
            texto: '2 a 3 lojas',
            score: { starter: 0, pro: 3, business: 0 },
            sinal: { pro: 'você já gerencia múltiplas lojas' },
          },
          {
            texto: '4 lojas ou mais',
            score: { starter: 0, pro: 0, business: 3 },
            sinal: { business: 'sua rede de lojas exige controle centralizado' },
          },
        ],
      },
      {
        id: 'atacado',
        texto: 'Você vende no atacado (grade de tamanhos, pedido mínimo por revendedor)?',
        opcoes: [
          {
            texto: 'Não, só varejo direto',
            score: { starter: 2, pro: 0, business: 0 },
            sinal: { starter: 'seu foco é varejo direto ao consumidor' },
          },
          {
            texto: 'Sim, quero organizar o atacado',
            score: { starter: 0, pro: 2, business: 0 },
            sinal: { pro: 'você precisa organizar grade de tamanhos e pedido mínimo por revendedor' },
          },
          {
            texto: 'Sim, trabalho com volume alto',
            score: { starter: 0, pro: 1, business: 3 },
            sinal: { business: 'seu volume de atacado exige automação de pedidos e catálogo B2B' },
          },
        ],
      },
      {
        id: 'relatorios',
        texto: 'Você precisa de curva ABC de produtos ou só relatório básico de vendas?',
        opcoes: [
          {
            texto: 'Só relatório básico',
            score: { starter: 2, pro: 1, business: 0 },
            sinal: { starter: 'um relatório básico atende o seu momento atual' },
          },
          {
            texto: 'Curva ABC e análise avançada',
            score: { starter: 0, pro: 2, business: 2 },
            sinal: {
              pro: 'você precisa de análise avançada de desempenho de produtos',
              business: 'você precisa de análise avançada de desempenho de produtos',
            },
          },
        ],
      },
      {
        id: 'comissao',
        texto: 'Você paga comissão de vendedores hoje? Como calcula?',
        opcoes: [
          {
            texto: 'Não tenho vendedores comissionados',
            score: { starter: 2, pro: 0, business: 0 },
            sinal: { starter: 'você não tem equipe de vendedores comissionados' },
          },
          {
            texto: 'Sim, calculo na mão ou planilha',
            score: { starter: 0, pro: 2, business: 0 },
            sinal: { pro: 'você paga comissão e quer organizar e automatizar esse cálculo' },
          },
          {
            texto: 'Sim, quero cálculo automático',
            score: { starter: 0, pro: 1, business: 2 },
            sinal: { business: 'sua equipe de vendedores precisa de cálculo automático de comissão' },
          },
        ],
      },
      {
        id: 'crediario',
        texto: 'Você oferece crediário ou fiado para clientes?',
        opcoes: [
          {
            texto: 'Não, só à vista ou cartão',
            score: { starter: 2, pro: 0, business: 0 },
            sinal: { starter: 'você trabalha com pagamento imediato' },
          },
          {
            texto: 'Sim, para alguns clientes',
            score: { starter: 0, pro: 2, business: 0 },
            sinal: { pro: 'você já oferece crediário e quer controlar as parcelas' },
          },
          {
            texto: 'Sim, é muito comum na minha loja',
            score: { starter: 0, pro: 0, business: 3 },
            sinal: { business: 'o crediário é parte central do seu negócio e precisa de gestão robusta' },
          },
        ],
      },
      {
        id: 'catalogo',
        texto: 'Você quer catálogo online para clientes comprarem sem precisar te chamar?',
        opcoes: [
          {
            texto: 'Não preciso disso agora',
            score: { starter: 2, pro: 0, business: 0 },
            sinal: { starter: 'você vende diretamente na loja física por enquanto' },
          },
          {
            texto: 'Talvez no futuro',
            score: { starter: 0, pro: 2, business: 0 },
            sinal: { pro: 'você pensa em ter catálogo online em breve' },
          },
          {
            texto: 'Sim, quero catálogo online já',
            score: { starter: 0, pro: 0, business: 3 },
            sinal: { business: 'você precisa que clientes comprem pelo catálogo online sem depender de você' },
          },
        ],
      },
      {
        id: 'financeiro',
        texto: 'Como você controla o financeiro hoje (contas a pagar, fluxo de caixa)?',
        opcoes: [
          {
            texto: 'Caderno ou na cabeça',
            score: { starter: 3, pro: 0, business: 0 },
            sinal: { starter: 'você está dando os primeiros passos no controle financeiro' },
          },
          {
            texto: 'Planilha do Excel',
            score: { starter: 0, pro: 2, business: 0 },
            sinal: { pro: 'você já usa planilha e quer migrar para algo mais confiável' },
          },
          {
            texto: 'Quero controle completo com DRE e fluxo de caixa',
            score: { starter: 0, pro: 0, business: 3 },
            sinal: { business: 'você precisa de controle financeiro completo com DRE e fluxo de caixa' },
          },
        ],
      },
      {
        id: 'nfce',
        texto: 'Você emite nota fiscal? Precisa de NFC-e integrada ao sistema?',
        opcoes: [
          {
            texto: 'Não emito nota fiscal',
            score: { starter: 2, pro: 1, business: 0 },
            sinal: { starter: 'você ainda não emite nota fiscal' },
          },
          {
            texto: 'Emito fora do sistema',
            score: { starter: 0, pro: 2, business: 0 },
            sinal: { pro: 'você emite NF externamente e quer centralizar no sistema' },
          },
          {
            texto: 'Quero NFC-e integrada ao sistema',
            score: { starter: 0, pro: 0, business: 3 },
            sinal: { business: 'você precisa de NFC-e integrada diretamente no sistema de vendas' },
          },
        ],
      },
      {
        id: 'whatsapp',
        texto: 'Você usa WhatsApp para avisar clientes sobre produtos ou promoções?',
        opcoes: [
          {
            texto: 'Não costumo fazer isso',
            score: { starter: 2, pro: 0, business: 0 },
            sinal: { starter: 'você ainda não usa canais digitais para comunicação com clientes' },
          },
          {
            texto: 'Sim, mando manualmente quando lembro',
            score: { starter: 0, pro: 2, business: 0 },
            sinal: { pro: 'você já usa WhatsApp como canal e quer mais organização' },
          },
          {
            texto: 'Quero disparar mensagens automáticas por segmento',
            score: { starter: 0, pro: 0, business: 2 },
            sinal: { business: 'você quer disparos automáticos segmentados por perfil de cliente' },
          },
        ],
      },
      {
        id: 'objetivo',
        texto: 'Qual é o seu maior objetivo agora?',
        opcoes: [
          {
            texto: 'Organizar o básico da loja',
            score: { starter: 3, pro: 0, business: 0 },
            sinal: { starter: 'seu objetivo agora é organizar o básico antes de crescer' },
          },
          {
            texto: 'Crescer com mais controle e dados',
            score: { starter: 0, pro: 3, business: 0 },
            sinal: { pro: 'seu objetivo é crescer com controle e usar dados para decidir' },
          },
          {
            texto: 'Escalar a operação completa',
            score: { starter: 0, pro: 0, business: 3 },
            sinal: { business: 'você está pronto para escalar a operação completa' },
          },
        ],
      },
    ],
  },

  {
    id: 'barbearia',
    nome: 'Barbearia',
    icone: 'Scissors',
    precos: {
      starter:  'R$ 59,90',
      pro:      'R$ 99,90',
      business: 'R$ 179,90',
    },
    perguntas: [
      {
        id: 'profissionais',
        texto: 'Quantos profissionais atendem na barbearia hoje?',
        opcoes: [
          {
            texto: 'Só eu (1 profissional)',
            score: { starter: 3, pro: 0, business: 0 },
            sinal: { starter: 'você é o único profissional e não precisa de controle por equipe' },
          },
          {
            texto: '2 a 3 profissionais',
            score: { starter: 0, pro: 3, business: 0 },
            sinal: { pro: 'você tem uma equipe de 2 a 3 profissionais para gerenciar' },
          },
          {
            texto: '4 profissionais ou mais',
            score: { starter: 0, pro: 0, business: 3 },
            sinal: { business: 'sua equipe numerosa exige controle individualizado por profissional' },
          },
        ],
      },
      {
        id: 'lembretes',
        texto: 'Você já perdeu cliente por falta de confirmação ou lembrete de horário?',
        opcoes: [
          {
            texto: 'Não, raramente acontece',
            score: { starter: 2, pro: 1, business: 0 },
            sinal: { starter: 'seu volume de agendamentos está sob controle' },
          },
          {
            texto: 'Às vezes, poderia melhorar',
            score: { starter: 0, pro: 2, business: 1 },
            sinal: { pro: 'confirmações automáticas reduziriam suas faltas e no-shows' },
          },
          {
            texto: 'Sim, acontece com frequência',
            score: { starter: 0, pro: 1, business: 2 },
            sinal: { business: 'lembretes automáticos são essenciais para o seu volume de agendamentos' },
          },
        ],
      },
      {
        id: 'comissao',
        texto: 'Como você calcula a comissão dos profissionais hoje?',
        opcoes: [
          {
            texto: 'Não pago comissão por serviço',
            score: { starter: 2, pro: 1, business: 0 },
            sinal: { starter: 'você não precisa de controle de comissão por serviço por enquanto' },
          },
          {
            texto: 'Calculo na cabeça ou em planilha',
            score: { starter: 0, pro: 2, business: 0 },
            sinal: { pro: 'você calcula comissão manualmente e quer automatizar esse processo' },
          },
          {
            texto: 'Quero cálculo automático por serviço',
            score: { starter: 0, pro: 1, business: 2 },
            sinal: { business: 'sua equipe precisa de cálculo automático de comissão por serviço' },
          },
        ],
      },
      {
        id: 'agendamento',
        texto: 'Você quer que clientes agendem online sem precisar te chamar no WhatsApp?',
        opcoes: [
          {
            texto: 'Não, prefiro receber pelo WhatsApp',
            score: { starter: 2, pro: 0, business: 0 },
            sinal: { starter: 'o agendamento pelo WhatsApp ainda funciona para você' },
          },
          {
            texto: 'Sim, seria muito útil',
            score: { starter: 0, pro: 2, business: 1 },
            sinal: { pro: 'você quer oferecer agendamento online para seus clientes' },
          },
          {
            texto: 'Sim, é urgente para mim',
            score: { starter: 0, pro: 0, business: 3 },
            sinal: { business: 'agendamento online 24h é uma prioridade para o crescimento da barbearia' },
          },
        ],
      },
      {
        id: 'pacotes',
        texto: 'Você vende ou pensa em vender pacotes ou assinatura mensal?',
        opcoes: [
          {
            texto: 'Não, só serviços avulsos',
            score: { starter: 2, pro: 0, business: 0 },
            sinal: { starter: 'você trabalha com serviços avulsos e isso atende o seu momento' },
          },
          {
            texto: 'Penso em implementar em breve',
            score: { starter: 0, pro: 2, business: 1 },
            sinal: { pro: 'você quer lançar pacotes ou assinatura em breve' },
          },
          {
            texto: 'Já vendo ou quero começar logo',
            score: { starter: 0, pro: 0, business: 3 },
            sinal: { business: 'pacotes e assinaturas mensais já fazem parte do seu modelo de negócio' },
          },
        ],
      },
      {
        id: 'unidades',
        texto: 'Você tem ou pretende ter mais de uma unidade?',
        opcoes: [
          {
            texto: 'Não, uma unidade por enquanto',
            score: { starter: 3, pro: 1, business: 0 },
            sinal: { starter: 'você opera em uma única unidade' },
          },
          {
            texto: 'Talvez abrir outra no futuro',
            score: { starter: 0, pro: 2, business: 1 },
            sinal: { pro: 'você pensa em expandir para novas unidades em breve' },
          },
          {
            texto: 'Sim, já estou planejando',
            score: { starter: 0, pro: 0, business: 3 },
            sinal: { business: 'a expansão para múltiplas unidades está no seu plano imediato' },
          },
        ],
      },
      {
        id: 'financeiro',
        texto: 'Como você controla o financeiro hoje?',
        opcoes: [
          {
            texto: 'Caderno ou na cabeça',
            score: { starter: 3, pro: 0, business: 0 },
            sinal: { starter: 'você está dando os primeiros passos no controle financeiro' },
          },
          {
            texto: 'Planilha do Excel',
            score: { starter: 0, pro: 2, business: 0 },
            sinal: { pro: 'você usa planilha e quer migrar para algo mais confiável' },
          },
          {
            texto: 'Quero controle completo com fluxo de caixa',
            score: { starter: 0, pro: 0, business: 2 },
            sinal: { business: 'você precisa de controle financeiro completo com fluxo de caixa' },
          },
        ],
      },
      {
        id: 'fiado',
        texto: 'Você trabalha com fiado ou crediário para clientes fixos?',
        opcoes: [
          {
            texto: 'Não, só pagamento na hora',
            score: { starter: 2, pro: 0, business: 0 },
            sinal: { starter: 'você trabalha com pagamento imediato' },
          },
          {
            texto: 'Sim, para alguns clientes fixos',
            score: { starter: 0, pro: 2, business: 0 },
            sinal: { pro: 'você tem clientes fixos no fiado que precisam de acompanhamento' },
          },
          {
            texto: 'Sim, é bastante comum',
            score: { starter: 0, pro: 0, business: 3 },
            sinal: { business: 'o fiado é frequente entre seus clientes e precisa de gestão dedicada' },
          },
        ],
      },
      {
        id: 'relatorio_profissional',
        texto: 'Você quer relatório de desempenho por profissional (atendimentos, faturamento)?',
        opcoes: [
          {
            texto: 'Não preciso disso agora',
            score: { starter: 2, pro: 0, business: 0 },
            sinal: { starter: 'você não precisa de análise por profissional neste momento' },
          },
          {
            texto: 'Sim, seria muito interessante',
            score: { starter: 0, pro: 2, business: 1 },
            sinal: { pro: 'você quer acompanhar o desempenho individual de cada barbeiro' },
          },
          {
            texto: 'Sim, é essencial para mim',
            score: { starter: 0, pro: 1, business: 2 },
            sinal: { business: 'relatórios detalhados por profissional são indispensáveis para você' },
          },
        ],
      },
      {
        id: 'objetivo',
        texto: 'Qual é o seu maior objetivo agora?',
        opcoes: [
          {
            texto: 'Organizar o básico da barbearia',
            score: { starter: 3, pro: 0, business: 0 },
            sinal: { starter: 'seu objetivo agora é organizar o básico antes de crescer' },
          },
          {
            texto: 'Crescer com mais controle e dados',
            score: { starter: 0, pro: 3, business: 0 },
            sinal: { pro: 'seu objetivo é crescer com controle e usar dados para decidir' },
          },
          {
            texto: 'Escalar a operação completa',
            score: { starter: 0, pro: 0, business: 3 },
            sinal: { business: 'você está pronto para escalar a operação completa' },
          },
        ],
      },
    ],
  },

  {
    id: 'otica',
    nome: 'Ótica',
    icone: 'Glasses',
    desabilitado: true,
    precos: null,
    perguntas: [],
  },
]
