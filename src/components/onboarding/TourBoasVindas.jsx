// Modal do tour de boas-vindas, um slide por vez.
//
// Aparece sozinho quando lf_config.tour_pendente é true e some ao terminar
// ou pular — os dois caminhos gravam tour_pendente = false, então ninguém vê
// duas vezes sem o admin reativar.
//
// Ícones do lucide-react (já é dependência do projeto). O mockup pedia Tabler;
// trocar a biblioteca de ícones por causa de uma tela nova traria um pacote
// inteiro e dois estilos convivendo — ver relatório.

import { useState } from 'react'
import {
  X, ShoppingCart, Package, Wallet, Users, Target, Receipt,
  BarChart3, Store, TrendingUp, Building2, ArrowRight, Check,
} from 'lucide-react'
import Logo from '../junttos/Logo'

const FONT = 'Plus Jakarta Sans, sans-serif'

const ICONES = {
  venda:       ShoppingCart,
  estoque:     Package,
  fechamento:  Wallet,
  clientes:    Users,
  meta:        Target,
  crediario:   Receipt,
  relatorios:  BarChart3,
  catalogo:    Store,
  financeiro:  TrendingUp,
  b2b:         Building2,
}

export default function TourBoasVindas({ slides = [], primary = '#5E2BD0', onFechar }) {
  const [i, setI] = useState(0)
  if (!slides.length) return null

  const slide   = slides[i]
  const ultimo  = i === slides.length - 1
  const inicial = slide.tipo === 'boasvindas'
  const Icone   = ICONES[slide.icone] || ShoppingCart

  function avancar() {
    if (ultimo) onFechar?.()
    else setI(n => n + 1)
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 3000,
        background: 'rgba(17,12,25,0.62)', backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20, fontFamily: FONT,
      }}
    >
      <div
        style={{
          background: '#FFFFFF', borderRadius: 24, width: '100%', maxWidth: 420,
          boxShadow: '0 24px 60px rgba(0,0,0,0.28)', position: 'relative',
          padding: '28px 26px 24px', boxSizing: 'border-box',
          maxHeight: '92vh', overflowY: 'auto',
        }}
      >
        {/* Pular fica sempre visível, inclusive no último slide. */}
        <button
          type="button"
          onClick={onFechar}
          aria-label="Pular tour"
          style={{
            position: 'absolute', top: 14, right: 14,
            display: 'inline-flex', alignItems: 'center', gap: 4,
            height: 32, padding: '0 10px', borderRadius: 99,
            border: 'none', background: '#F4F4F7', cursor: 'pointer',
            fontFamily: FONT, fontSize: 12.5, fontWeight: 700, color: '#71717A',
          }}
        >
          Pular <X size={13} strokeWidth={2.5} />
        </button>

        {inicial ? (
          // Slide 0 tem formato próprio: marca no topo, sem ícone de função.
          <div style={{ textAlign: 'center', paddingTop: 12 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9, marginBottom: 22 }}>
              <Logo size={30} showWordmark={false} />
              <span style={{ fontSize: 21, fontWeight: 800, color: '#18181B', letterSpacing: '-0.02em' }}>
                Junttos
              </span>
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#18181B', lineHeight: 1.32, margin: '0 0 12px' }}>
              {slide.titulo}
            </h2>
            <p style={{ fontSize: 14.5, color: '#52525B', lineHeight: 1.6, margin: 0 }}>
              {slide.texto}
            </p>
          </div>
        ) : (
          <div style={{ textAlign: 'center', paddingTop: 16 }}>
            <div style={{
              width: 78, height: 78, borderRadius: 22, margin: '0 auto 20px',
              background: `${primary}14`, border: `1px solid ${primary}26`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icone size={36} color={primary} strokeWidth={1.8} />
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#18181B', margin: '0 0 10px' }}>
              {slide.titulo}
            </h2>
            <p style={{ fontSize: 14.5, color: '#52525B', lineHeight: 1.6, margin: 0 }}>
              {slide.texto}
            </p>
          </div>
        )}

        {/* Bolinhas de progresso */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, margin: '26px 0 20px', flexWrap: 'wrap' }}>
          {slides.map((s, n) => (
            <span
              key={s.id}
              style={{
                width: n === i ? 20 : 7, height: 7, borderRadius: 99,
                background: n === i ? primary : n < i ? `${primary}55` : '#E4E4E7',
                transition: 'width .2s, background .2s',
              }}
            />
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          {i > 0 && (
            <button
              type="button"
              onClick={() => setI(n => n - 1)}
              style={{
                height: 50, padding: '0 18px', borderRadius: 14,
                border: '1.5px solid #E4E4E7', background: '#FFFFFF', cursor: 'pointer',
                fontFamily: FONT, fontSize: 14.5, fontWeight: 700, color: '#52525B',
              }}
            >
              Voltar
            </button>
          )}
          <button
            type="button"
            onClick={avancar}
            style={{
              flex: 1, height: 50, borderRadius: 14, border: 'none',
              background: primary, color: '#FFFFFF', cursor: 'pointer',
              fontFamily: FONT, fontSize: 15, fontWeight: 800,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {inicial
              ? <>Vamos lá <ArrowRight size={17} strokeWidth={2.5} /></>
              : ultimo
                ? <>Começar a usar <Check size={17} strokeWidth={2.5} /></>
                : <>Próximo <ArrowRight size={17} strokeWidth={2.5} /></>}
          </button>
        </div>
      </div>
    </div>
  )
}
