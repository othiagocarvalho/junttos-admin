import { T } from '../../theme/tokens'

export default function DataTable({ columns, children, style: extra = {} }) {
  return (
    <div style={{ overflowX: 'auto', ...extra }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: T.ui }}>
        <thead>
          <tr style={{ background: '#FBFAFE', borderBottom: `1px solid ${T.line}` }}>
            {columns.map((col, i) => (
              <th
                key={i}
                style={{
                  textAlign:     'left',
                  padding:       '10px 20px',
                  fontSize:      11,
                  fontWeight:    700,
                  color:         T.muted2,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  whiteSpace:    'nowrap',
                }}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>

      <style>{`
        .jt-tr:hover td { background: #FBFAFE; }
        .jt-tr td {
          padding: 13px 20px;
          border-bottom: 1px solid ${T.line};
          font-size: 13.5px;
          color: ${T.ink};
          transition: background .1s;
        }
        .jt-tr:last-child td { border-bottom: none; }
      `}</style>
    </div>
  )
}
