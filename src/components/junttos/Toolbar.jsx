import { Search, ChevronDown, Filter } from 'lucide-react'
import { T } from '../../theme/tokens'

export default function Toolbar({ search, onSearch, filters = [], placeholder = 'Buscar…' }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, fontFamily: T.ui }}>

      {/* Search */}
      <div style={{ position: 'relative', flex: '1 1 220px' }}>
        <Search style={{
          position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)',
          width: 15, height: 15, color: T.muted, pointerEvents: 'none', strokeWidth: 1.9,
        }} />
        <input
          value={search}
          onChange={e => onSearch(e.target.value)}
          placeholder={placeholder}
          style={{
            width:        '100%',
            height:       40,
            minHeight:    44,
            border:       `1.5px solid ${T.line}`,
            borderRadius: T.rPill,
            background:   T.white,
            padding:      '0 16px 0 38px',
            fontSize:     13.5,
            color:        T.ink,
            outline:      'none',
            fontFamily:   T.ui,
            boxSizing:    'border-box',
            transition:   'border-color .18s, box-shadow .18s',
          }}
          onFocus={e => {
            e.target.style.borderColor = T.purple
            e.target.style.boxShadow   = '0 0 0 3px rgba(94,43,208,.1)'
          }}
          onBlur={e => {
            e.target.style.borderColor = T.line
            e.target.style.boxShadow   = 'none'
          }}
        />
      </div>

      {/* Filter chips */}
      {filters.map(({ label, value, onChange, options }) => (
        <div key={label} style={{ position: 'relative' }}>
          <Filter style={{
            position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
            width: 13, height: 13, color: T.muted, pointerEvents: 'none', strokeWidth: 1.9,
          }} />
          <select
            value={value}
            onChange={e => onChange(e.target.value)}
            style={{
              height:       40,
              minHeight:    44,
              border:       `1.5px solid ${T.line}`,
              borderRadius: T.rPill,
              background:   T.white,
              padding:      '0 32px 0 30px',
              fontSize:     13,
              color:        T.ink,
              outline:      'none',
              fontFamily:   T.ui,
              cursor:       'pointer',
              appearance:   'none',
              transition:   'border-color .18s',
            }}
            onFocus={e  => { e.target.style.borderColor = T.purple }}
            onBlur={e   => { e.target.style.borderColor = T.line }}
          >
            {options.map(o => (
              <option key={o.value} value={o.value}>
                {o.value === 'Todos' || o.value === '' ? `${label}: ${o.label}` : o.label}
              </option>
            ))}
          </select>
          <ChevronDown style={{
            position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
            width: 13, height: 13, color: T.muted, pointerEvents: 'none',
          }} />
        </div>
      ))}
    </div>
  )
}
