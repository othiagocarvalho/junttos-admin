import { useState, useRef, useCallback, useEffect } from 'react'
import { Maximize2, X } from 'lucide-react'

const NW = 174
const NH = 64

const NODES_DEF = [
  { id: 'github',      label: 'GitHub',          sub: 'Repositório fonte',    x: 60,  y: 200, color: '#5E2BD0' },
  { id: 'vercel',      label: 'Vercel',           sub: 'CI/CD · Deploy',       x: 340, y: 200, color: '#5E2BD0' },
  { id: 'painel',      label: 'Painel Admin',     sub: 'junttos-admin',        x: 620, y: 80,  color: '#5E2BD0' },
  { id: 'app-lojista', label: 'App do Lojista',   sub: 'PWA / Mobile',         x: 620, y: 300, color: '#5E2BD0' },
  { id: 'loja-fem',    label: 'Loja Feminina',    sub: 'Módulo',               x: 900, y: 160, color: '#5E2BD0' },
  { id: 'loja-masc',   label: 'Loja Masculina',   sub: 'Módulo',               x: 900, y: 280, color: '#5E2BD0' },
  { id: 'barbearia',   label: 'Barbearia',        sub: 'Módulo',               x: 900, y: 400, color: '#FF6F5E' },
  { id: 'outros',      label: 'Outros Módulos',   sub: 'Extensível',           x: 900, y: 520, color: '#FF6F5E' },
  { id: 'supabase',    label: 'Supabase',         sub: 'Backend as a Service', x: 60,  y: 460, color: '#FF6F5E' },
  { id: 'auth',        label: 'Auth',             sub: 'Autenticação',         x: 340, y: 400, color: '#FF6F5E' },
  { id: 'storage',     label: 'Storage',          sub: 'Arquivos · Assets',    x: 340, y: 520, color: '#FF6F5E' },
  { id: 'n8n',         label: 'N8n',              sub: 'Automações',           x: 60,  y: 660, color: '#FF6F5E' },
]

const EDGES_DEF = [
  { id: 'e1',  from: 'github',      to: 'vercel'      },
  { id: 'e2',  from: 'vercel',      to: 'painel'      },
  { id: 'e3',  from: 'vercel',      to: 'app-lojista' },
  { id: 'e4',  from: 'supabase',    to: 'auth'        },
  { id: 'e5',  from: 'supabase',    to: 'storage'     },
  { id: 'e6',  from: 'app-lojista', to: 'loja-fem'    },
  { id: 'e7',  from: 'app-lojista', to: 'loja-masc'   },
  { id: 'e8',  from: 'app-lojista', to: 'barbearia'   },
  { id: 'e9',  from: 'app-lojista', to: 'outros'      },
  { id: 'e10', from: 'auth',        to: 'painel'      },
  { id: 'e11', from: 'auth',        to: 'app-lojista' },
  { id: 'e12', from: 'n8n',         to: 'supabase'    },
  { id: 'e13', from: 'storage',     to: 'painel'      },
]

const ICONS = {
  github:        '⌥',
  vercel:        '▲',
  painel:        '⚙',
  'app-lojista': '◉',
  'loja-fem':    '◈',
  'loja-masc':   '◈',
  barbearia:     '✦',
  outros:        '⊕',
  supabase:      '◬',
  auth:          '⬡',
  storage:       '▣',
  n8n:           '⚡',
}

function makePath(from, to) {
  const x1 = from.x + NW, y1 = from.y + NH / 2
  const x2 = to.x,         y2 = to.y  + NH / 2
  const cp = Math.max(Math.abs(x2 - x1) * 0.5, 80)
  return { d: `M${x1},${y1} C${x1+cp},${y1} ${x2-cp},${y2} ${x2},${y2}`, x1, y1, x2, y2 }
}

export default function ArquiteturaPage() {
  const [nodes, setNodes] = useState(NODES_DEF)
  const [view,  setView]  = useState({ x: 60, y: 60, s: 0.88 })
  const [busy,  setBusy]  = useState(false)
  const [fs,    setFs]    = useState(false)

  const vRef  = useRef({ x: 60, y: 60, s: 0.88 })
  const nRef  = useRef(NODES_DEF)
  const gRef  = useRef(null)
  const elRef = useRef(null)

  function pushView(v)  { vRef.current = v; setView(v) }
  function pushNodes(n) { nRef.current = n; setNodes([...n]) }

  useEffect(() => {
    const onChange = () => setFs(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      elRef.current?.requestFullscreen()
    } else {
      document.exitFullscreen()
    }
  }

  useEffect(() => {
    const el = elRef.current
    if (!el) return
    const onWheel = (e) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const cx = e.clientX - rect.left
      const cy = e.clientY - rect.top
      const f = e.deltaY < 0 ? 1.08 : 0.92
      const v = vRef.current
      const ns = Math.min(Math.max(v.s * f, 0.15), 4)
      const af = ns / v.s
      pushView({ x: cx - (cx - v.x) * af, y: cy - (cy - v.y) * af, s: ns })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const onDown = useCallback((e) => {
    if (e.button !== 0) return
    const nEl = e.target.closest('[data-nid]')
    if (nEl) {
      const id   = nEl.dataset.nid
      const node = nRef.current.find(n => n.id === id)
      const v    = vRef.current
      gRef.current = {
        type: 'node', id,
        ox: (e.clientX - v.x) / v.s - node.x,
        oy: (e.clientY - v.y) / v.s - node.y,
      }
      setBusy(true)
      e.stopPropagation()
    } else {
      const v = vRef.current
      gRef.current = { type: 'pan', sx: e.clientX, sy: e.clientY, vx: v.x, vy: v.y }
      setBusy(true)
    }
  }, [])

  const onMove = useCallback((e) => {
    const g = gRef.current
    if (!g) return
    if (g.type === 'pan') {
      const v = vRef.current
      pushView({ ...v, x: g.vx + e.clientX - g.sx, y: g.vy + e.clientY - g.sy })
    } else {
      const v = vRef.current
      const x = (e.clientX - v.x) / v.s - g.ox
      const y = (e.clientY - v.y) / v.s - g.oy
      pushNodes(nRef.current.map(n => n.id === g.id ? { ...n, x, y } : n))
    }
  }, [])

  const onUp = useCallback(() => { gRef.current = null; setBusy(false) }, [])

  const { x: vx, y: vy, s: vs } = view

  const edges = EDGES_DEF.map(e => {
    const f = nodes.find(n => n.id === e.from)
    const t = nodes.find(n => n.id === e.to)
    if (!f || !t) return null
    return { ...e, ...makePath(f, t), fc: f.color, tc: t.color }
  }).filter(Boolean)

  return (
    <div
      ref={elRef}
      onMouseDown={onDown}
      onMouseMove={onMove}
      onMouseUp={onUp}
      onMouseLeave={onUp}
      style={{
        position: 'fixed',
        top: 0, left: fs ? 0 : 240, right: 0, bottom: 0,
        background: '#0a0a0a',
        overflow: 'hidden',
        cursor: busy ? 'grabbing' : 'grab',
        userSelect: 'none',
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      {/* Dot grid */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: 'radial-gradient(circle, #2a2a2a 1px, transparent 1px)',
        backgroundSize: `${28 * vs}px ${28 * vs}px`,
        backgroundPosition: `${vx % (28 * vs)}px ${vy % (28 * vs)}px`,
      }} />

      {/* World */}
      <div style={{
        position: 'absolute',
        transformOrigin: '0 0',
        transform: `translate(${vx}px,${vy}px) scale(${vs})`,
      }}>
        {/* Edges */}
        <svg style={{
          position: 'absolute', top: 0, left: 0,
          width: 1, height: 1,
          overflow: 'visible', pointerEvents: 'none',
        }}>
          <defs>
            {edges.map(e => (
              <linearGradient key={e.id} id={`g-${e.id}`} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} gradientUnits="userSpaceOnUse">
                <stop offset="0%"   stopColor={e.fc} stopOpacity="0.65" />
                <stop offset="100%" stopColor={e.tc} stopOpacity="0.65" />
              </linearGradient>
            ))}
          </defs>
          {edges.map(e => (
            <g key={e.id}>
              <path d={e.d} fill="none" stroke={`url(#g-${e.id})`} strokeWidth="1.5" />
              <circle cx={e.x2} cy={e.y2} r="3.5" fill={e.tc} opacity="0.85" />
            </g>
          ))}
        </svg>

        {/* Nodes */}
        {nodes.map(n => (
          <div
            key={n.id}
            data-nid={n.id}
            style={{
              position: 'absolute',
              left: n.x, top: n.y,
              width: NW, height: NH,
              background: 'linear-gradient(160deg, #161616 0%, #101010 100%)',
              border: `1px solid ${n.color}30`,
              borderTop: `2px solid ${n.color}cc`,
              borderRadius: 10,
              boxShadow: `0 0 0 1px ${n.color}14, 0 8px 32px rgba(0,0,0,0.6), 0 0 24px ${n.color}10`,
              cursor: 'grab',
              display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px',
            }}
          >
            {/* Input port */}
            <div style={{
              position: 'absolute', left: -5, top: '50%', transform: 'translateY(-50%)',
              width: 10, height: 10, borderRadius: '50%',
              background: '#0a0a0a', border: `2px solid ${n.color}88`,
            }} />

            {/* Icon */}
            <div style={{
              width: 30, height: 30, borderRadius: 8, flexShrink: 0,
              background: `${n.color}16`, border: `1px solid ${n.color}40`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, color: n.color,
            }}>
              {ICONS[n.id] || '◆'}
            </div>

            {/* Label */}
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{
                fontSize: 12.5, fontWeight: 600, color: '#ececec',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {n.label}
              </div>
              <div style={{
                fontSize: 10.5, color: '#4a4a4a', marginTop: 2,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {n.sub}
              </div>
            </div>

            {/* Output port */}
            <div style={{
              position: 'absolute', right: -5, top: '50%', transform: 'translateY(-50%)',
              width: 10, height: 10, borderRadius: '50%',
              background: '#0a0a0a', border: `2px solid ${n.color}88`,
            }} />
          </div>
        ))}
      </div>

      {/* Fullscreen button */}
      <button
        onMouseDown={(e) => e.stopPropagation()}
        onClick={toggleFullscreen}
        style={{
          position: 'absolute', top: 14, right: 14,
          width: 34, height: 34,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#161616', border: '1px solid #2a2a2a',
          borderRadius: 8, cursor: 'pointer', color: '#555',
          transition: 'color .15s, border-color .15s, background .15s',
          zIndex: 10,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = '#ccc'
          e.currentTarget.style.borderColor = '#444'
          e.currentTarget.style.background = '#1e1e1e'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = '#555'
          e.currentTarget.style.borderColor = '#2a2a2a'
          e.currentTarget.style.background = '#161616'
        }}
        title={fs ? 'Sair do fullscreen' : 'Fullscreen'}
      >
        {fs ? <X size={15} /> : <Maximize2 size={15} />}
      </button>

      {/* Zoom badge */}
      <div style={{
        position: 'absolute', bottom: 16, right: 16,
        fontSize: 11, color: '#3a3a3a', fontFamily: 'monospace',
        background: '#111', border: '1px solid #1e1e1e',
        padding: '4px 10px', borderRadius: 6, pointerEvents: 'none',
      }}>
        {Math.round(vs * 100)}%
      </div>

      {/* Hint */}
      <div style={{
        position: 'absolute', bottom: 16, left: 16,
        fontSize: 11, color: '#2e2e2e', pointerEvents: 'none',
      }}>
        Scroll para zoom · Drag para mover · Arraste os nós
      </div>
    </div>
  )
}
