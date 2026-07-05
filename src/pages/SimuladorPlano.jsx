import { useState } from 'react'
import {
  Shirt, Scissors, Glasses,
  ChevronLeft, ChevronRight, RotateCcw, Sparkles,
} from 'lucide-react'
import PageHeader from '../components/studio/PageHeader'
import Card from '../components/studio/Card'
import Button from '../components/studio/Button'
import { VERTICAIS } from '../data/simuladorPlanos'

const ICONE_MAP = { Shirt, Scissors, Glasses }

const PLANO_DISPLAY = {
  starter: {
    label:         'Starter',
    bg:            'var(--bg)',
    border:        'var(--line)',
    cardBorder:    '2px solid var(--line)',
    titleColor:    'var(--ink)',
    priceColor:    'var(--muted)',
    bodyColor:     'var(--ink-soft)',
    badgeBg:       '#ECECF1',
    badgeText:     'var(--muted)',
  },
  pro: {
    label:         'Pro',
    bg:            'color-mix(in srgb, var(--primary) 6%, white)',
    border:        'color-mix(in srgb, var(--primary) 25%, transparent)',
    cardBorder:    '2px solid color-mix(in srgb, var(--primary) 35%, transparent)',
    titleColor:    'var(--primary)',
    priceColor:    'color-mix(in srgb, var(--primary) 70%, white)',
    bodyColor:     'var(--ink-soft)',
    badgeBg:       'color-mix(in srgb, var(--primary) 12%, white)',
    badgeText:     'var(--primary)',
  },
  business: {
    label:         'Business',
    bg:            '#18181B',
    border:        '#3F3F46',
    cardBorder:    '2px solid #3F3F46',
    titleColor:    '#FFFFFF',
    priceColor:    '#A1A1AA',
    bodyColor:     '#D4D4D8',
    badgeBg:       '#3F3F46',
    badgeText:     '#FFFFFF',
  },
}

function calcularResultado(perguntas, respostas) {
  const totais = { starter: 0, pro: 0, business: 0 }
  perguntas.forEach((q, qi) => {
    const opcaoIdx = respostas[qi]
    if (opcaoIdx == null) return
    const score = q.opcoes[opcaoIdx].score
    totais.starter  += score.starter  || 0
    totais.pro      += score.pro      || 0
    totais.business += score.business || 0
  })
  const ordem = ['starter', 'pro', 'business']
  const plano = Object.entries(totais)
    .sort(([a, va], [b, vb]) => vb - va || ordem.indexOf(a) - ordem.indexOf(b))
    [0][0]
  return { plano, totais }
}

function buildJustificativa(perguntas, respostas, plano) {
  const sinais = []
  perguntas.forEach((q, qi) => {
    const opcaoIdx = respostas[qi]
    if (opcaoIdx == null) return
    const sinal = q.opcoes[opcaoIdx].sinal?.[plano]
    if (sinal) sinais.push(sinal)
  })
  const label = PLANO_DISPLAY[plano].label
  if (sinais.length === 0) {
    return `O ${label} é a solução mais adequada para o seu momento atual.`
  }
  const top = sinais.slice(0, 3)
  const last = top.pop()
  if (top.length === 0) {
    return `Como ${last}, o ${label} é a escolha certa para você.`
  }
  return `Como ${top.join(', ')} e ${last}, o ${label} é ideal para o seu momento.`
}

function VerticalSelector({ verticais, selected, onSelect }) {
  return (
    <div style={{
      display: 'flex',
      gap: 8,
      overflowX: 'auto',
      WebkitOverflowScrolling: 'touch',
      scrollbarWidth: 'none',
      paddingBottom: 2,
    }}>
      {verticais.map(v => {
        const Icon = ICONE_MAP[v.icone]
        const isActive   = v.id === selected
        const isDisabled = !!v.desabilitado
        return (
          <button
            key={v.id}
            onClick={() => !isDisabled && onSelect(v.id)}
            disabled={isDisabled}
            style={{
              display:    'inline-flex',
              alignItems: 'center',
              gap:        7,
              padding:    '9px 16px',
              borderRadius: 'var(--r-chip)',
              border:     isActive
                ? '1.5px solid var(--primary)'
                : '1.5px solid var(--line)',
              background: isActive
                ? 'color-mix(in srgb, var(--primary) 9%, white)'
                : 'var(--surface)',
              color: isDisabled
                ? 'var(--muted-2)'
                : isActive
                  ? 'var(--primary)'
                  : 'var(--muted)',
              fontFamily:  'var(--font-ui)',
              fontSize:    13.5,
              fontWeight:  isActive ? 700 : 500,
              cursor:      isDisabled ? 'not-allowed' : 'pointer',
              opacity:     isDisabled ? 0.55 : 1,
              flexShrink:  0,
              transition:  'border-color .15s, background .15s, color .15s',
              whiteSpace:  'nowrap',
            }}
          >
            {Icon && <Icon size={16} strokeWidth={1.9} />}
            {v.nome}
            {isDisabled && (
              <span style={{
                fontSize:      10,
                fontWeight:    700,
                background:    'var(--line)',
                color:         'var(--muted)',
                padding:       '2px 7px',
                borderRadius:  999,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}>
                Em breve
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

function ResultCard({ vertical, respostas, onReiniciar }) {
  const { plano }      = calcularResultado(vertical.perguntas, respostas)
  const display        = PLANO_DISPLAY[plano]
  const preco          = vertical.precos[plano]
  const justificativa  = buildJustificativa(vertical.perguntas, respostas, plano)

  return (
    <div style={{
      background:   display.bg,
      border:       display.cardBorder,
      borderRadius: 'var(--r-card)',
      padding:      '36px 28px',
      marginTop:    24,
      textAlign:    'center',
    }}>
      {/* Badge */}
      <div style={{
        display:       'inline-flex',
        alignItems:    'center',
        gap:           6,
        background:    display.badgeBg,
        color:         display.badgeText,
        fontWeight:    700,
        fontSize:      11,
        padding:       '4px 12px',
        borderRadius:  999,
        letterSpacing: '0.07em',
        textTransform: 'uppercase',
        marginBottom:  20,
        fontFamily:    'var(--font-mono)',
      }}>
        <Sparkles size={12} />
        Plano recomendado
      </div>

      {/* Plan name */}
      <h2 style={{
        fontSize:      48,
        fontWeight:    800,
        color:         display.titleColor,
        letterSpacing: '-0.03em',
        margin:        0,
        lineHeight:    1,
        fontFamily:    'var(--font-ui)',
      }}>
        {display.label}
      </h2>

      {/* Price */}
      <p style={{
        fontSize:    32,
        fontWeight:  700,
        color:       display.priceColor,
        fontFamily:  'var(--font-mono)',
        margin:      '10px 0 22px',
      }}>
        {preco}
        <span style={{ fontSize: 15, fontWeight: 400 }}>/mês</span>
      </p>

      {/* Justification */}
      <p style={{
        fontSize:   15,
        color:      display.bodyColor,
        lineHeight: 1.65,
        maxWidth:   460,
        margin:     '0 auto 32px',
        fontFamily: 'var(--font-ui)',
      }}>
        {justificativa}
      </p>

      {/* Restart */}
      <Button
        icon={RotateCcw}
        variant="secondary"
        onClick={onReiniciar}
        style={plano === 'business' ? {
          borderColor: '#52525B',
          color:       '#D4D4D8',
          background:  '#27272A',
        } : {}}
      >
        Simular novamente
      </Button>
    </div>
  )
}

export default function SimuladorPlano() {
  const [verticalId,     setVerticalId]     = useState('moda')
  const [perguntaAtual,  setPerguntaAtual]  = useState(0)
  const [respostas,      setRespostas]      = useState({})
  const [concluido,      setConcluido]      = useState(false)

  const vertical  = VERTICAIS.find(v => v.id === verticalId)
  const perguntas = vertical.perguntas
  const total     = perguntas.length

  function selecionarVertical(id) {
    setVerticalId(id)
    setPerguntaAtual(0)
    setRespostas({})
    setConcluido(false)
  }

  function selecionarOpcao(opcaoIdx) {
    setRespostas(r => ({ ...r, [perguntaAtual]: opcaoIdx }))
  }

  function avancar() {
    if (perguntaAtual < total - 1) {
      setPerguntaAtual(p => p + 1)
    } else {
      setConcluido(true)
    }
  }

  function voltar() {
    if (perguntaAtual > 0) setPerguntaAtual(p => p - 1)
  }

  function reiniciar() {
    setPerguntaAtual(0)
    setRespostas({})
    setConcluido(false)
  }

  const opcaoAtual  = respostas[perguntaAtual]
  const podeAvancar = opcaoAtual != null

  const pct = Math.round(
    ((perguntaAtual + (podeAvancar ? 1 : 0)) / total) * 100
  )

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', fontFamily: 'var(--font-ui)' }}>
      <PageHeader
        title="Simulador de Plano"
        subtitle={
          concluido
            ? 'Recomendação baseada nas suas respostas'
            : 'Responda até 10 perguntas e descubra o plano ideal para o seu negócio'
        }
      />

      {/* Vertical selector */}
      <VerticalSelector
        verticais={VERTICAIS}
        selected={verticalId}
        onSelect={selecionarVertical}
      />

      {/* ── Result ── */}
      {concluido && (
        <ResultCard
          vertical={vertical}
          respostas={respostas}
          onReiniciar={reiniciar}
        />
      )}

      {/* ── Quiz ── */}
      {!concluido && (
        <>
          {/* Progress bar */}
          <div style={{ marginTop: 24, marginBottom: 20 }}>
            <div style={{
              display:        'flex',
              justifyContent: 'space-between',
              alignItems:     'center',
              marginBottom:   8,
            }}>
              <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 500 }}>
                Pergunta {perguntaAtual + 1} de {total}
              </span>
              <span style={{
                fontSize:   12,
                color:      'var(--muted)',
                fontFamily: 'var(--font-mono)',
              }}>
                {pct}%
              </span>
            </div>
            <div style={{
              height:       6,
              background:   'var(--line)',
              borderRadius: 999,
              overflow:     'hidden',
            }}>
              <div style={{
                height:       '100%',
                background:   'var(--primary)',
                borderRadius: 999,
                width:        `${pct}%`,
                transition:   'width .35s ease',
              }} />
            </div>
          </div>

          {/* Question card */}
          <Card style={{ padding: '28px 24px' }}>
            <p style={{
              fontSize:      11,
              fontWeight:    700,
              color:         'var(--primary)',
              letterSpacing: '0.09em',
              textTransform: 'uppercase',
              marginBottom:  10,
              fontFamily:    'var(--font-mono)',
            }}>
              {String(perguntaAtual + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
            </p>

            <h2 style={{
              fontSize:      20,
              fontWeight:    700,
              color:         'var(--ink)',
              lineHeight:    1.45,
              marginBottom:  24,
              letterSpacing: '-0.01em',
            }}>
              {perguntas[perguntaAtual].texto}
            </h2>

            {/* Options */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {perguntas[perguntaAtual].opcoes.map((opcao, idx) => {
                const isSelected = opcaoAtual === idx
                return (
                  <button
                    key={idx}
                    onClick={() => selecionarOpcao(idx)}
                    style={{
                      display:    'flex',
                      alignItems: 'center',
                      gap:        14,
                      padding:    '14px 16px',
                      borderRadius: 'var(--r-input)',
                      border: isSelected
                        ? '2px solid var(--primary)'
                        : '1.5px solid var(--line)',
                      background: isSelected
                        ? 'color-mix(in srgb, var(--primary) 6%, white)'
                        : 'var(--surface)',
                      cursor:     'pointer',
                      textAlign:  'left',
                      fontFamily: 'var(--font-ui)',
                      transition: 'border-color .15s, background .15s',
                      width:      '100%',
                    }}
                  >
                    {/* Radio dot */}
                    <div style={{
                      width:       22,
                      height:      22,
                      borderRadius: '50%',
                      flexShrink:  0,
                      border: isSelected
                        ? '2px solid var(--primary)'
                        : '2px solid var(--line)',
                      background: isSelected ? 'var(--primary)' : 'var(--surface)',
                      display:    'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'border-color .15s, background .15s',
                    }}>
                      {isSelected && (
                        <div style={{
                          width:       8,
                          height:      8,
                          borderRadius: '50%',
                          background:  '#fff',
                        }} />
                      )}
                    </div>

                    <span style={{
                      fontSize:   14.5,
                      fontWeight: isSelected ? 600 : 500,
                      color:      isSelected ? 'var(--primary)' : 'var(--ink)',
                      transition: 'color .15s',
                    }}>
                      {opcao.texto}
                    </span>
                  </button>
                )
              })}
            </div>
          </Card>

          {/* Navigation */}
          <div style={{
            display:        'flex',
            justifyContent: 'space-between',
            alignItems:     'center',
            marginTop:      20,
            gap:            12,
          }}>
            <Button
              variant="secondary"
              icon={ChevronLeft}
              onClick={voltar}
              disabled={perguntaAtual === 0}
              style={{ minWidth: 120 }}
            >
              Voltar
            </Button>

            <Button
              variant="primary"
              onClick={avancar}
              disabled={!podeAvancar}
              style={{ minWidth: 160 }}
            >
              {perguntaAtual === total - 1 ? 'Ver Resultado' : (
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  Próxima <ChevronRight size={16} />
                </span>
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
