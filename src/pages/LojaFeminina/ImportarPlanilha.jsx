import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import { Download, CheckCircle2, AlertCircle, ArrowLeft, FileSpreadsheet, UploadCloud } from 'lucide-react'
import Card from '../../components/studio/Card'
import Button from '../../components/studio/Button'
import StatusPill from '../../components/studio/StatusPill'
import EmptyState from '../../components/studio/EmptyState'

function fmtR(v) { return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',') }

export default function ImportarPlanilha({ theme, importarProdutos, onBack }) {
  const [preview, setPreview]   = useState(null)
  const [fileName, setFileName] = useState('')
  const [error, setError]       = useState('')
  const [saving, setSaving]     = useState(false)
  const [done, setDone]         = useState(false)
  const fileRef = useRef(null)

  function downloadTemplate() {
    const headers  = ['Nome', 'Preço Custo', 'Preço Venda', 'Variação 1', 'Qtd 1', 'Variação 2', 'Qtd 2', 'Variação 3', 'Qtd 3']
    const examples = [
      ['Vestido Floral', 45.00, 89.90, 'P', 5, 'M', 3, 'G', 2],
      ['Blusa Básica',   20.00, 49.90, 'Preta', 4, 'Branca', 6, '', ''],
      ['Calça Jeans',    60.00, 129.90, '36', 3, '38', 5, '40', 2],
    ]
    const ws = XLSX.utils.aoa_to_sheet([headers, ...examples])
    ws['!cols'] = [
      { wch: 22 }, { wch: 14 }, { wch: 14 },
      { wch: 12 }, { wch: 8 }, { wch: 12 }, { wch: 8 }, { wch: 12 }, { wch: 8 },
    ]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Produtos')
    XLSX.writeFile(wb, 'modelo-produtos.xlsx')
  }

  function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setFileName(file.name)
    setError('')
    setPreview(null)

    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const wb   = XLSX.read(ev.target.result, { type: 'binary' })
        const ws   = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

        const products = rows
          .slice(1)
          .filter(row => String(row[0] || '').trim())
          .map(row => {
            const variacoes = [
              row[3] ? { cor: String(row[3]).trim(), quantidade: parseInt(row[4]) || 0 } : null,
              row[5] ? { cor: String(row[5]).trim(), quantidade: parseInt(row[6]) || 0 } : null,
              row[7] ? { cor: String(row[7]).trim(), quantidade: parseInt(row[8]) || 0 } : null,
            ].filter(v => v && v.cor)

            return {
              nome:       String(row[0]).trim(),
              precoCusto: parseFloat(String(row[1]).replace(',', '.')) || 0,
              precoVenda: parseFloat(String(row[2]).replace(',', '.')) || 0,
              variacoes,
            }
          })

        if (products.length === 0) {
          setError('Nenhum produto encontrado na planilha.')
          return
        }
        setPreview(products)
      } catch {
        setError('Erro ao ler o arquivo. Verifique se é um arquivo Excel válido.')
      }
    }
    reader.readAsBinaryString(file)
    e.target.value = ''
  }

  async function handleConfirm() {
    if (!preview?.length || saving) return
    setSaving(true)
    const err = await importarProdutos(preview)
    setSaving(false)
    if (err) {
      setError('Erro ao salvar: ' + err.message)
    } else {
      setDone(true)
    }
  }

  if (done) {
    return (
      <div style={{ paddingTop: 32 }}>
        <Card padding={0}>
          <EmptyState
            icon={CheckCircle2}
            title="Importação concluída!"
            subtitle={`${preview.length} produto${preview.length !== 1 ? 's' : ''} adicionado${preview.length !== 1 ? 's' : ''} ao estoque.`}
          />
        </Card>
      </div>
    )
  }

  return (
    <div style={{ paddingTop: 8 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={onBack} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--muted)', display: 'flex', alignItems: 'center', padding: 4,
        }}>
          <ArrowLeft size={20} />
        </button>
        <div>
          <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, fontSize: 16, color: 'var(--ink)' }}>Importar Planilha Excel</p>
          <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, color: 'var(--muted)' }}>Cadastre vários produtos de uma vez</p>
        </div>
      </div>

      {/* Passo 1 — Baixar modelo */}
      <Card style={{ marginBottom: 14 }}>
        <p style={{
          fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 10, fontWeight: 700,
          color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 10,
        }}>
          Passo 1 — Baixar o modelo
        </p>
        <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, color: 'var(--ink-soft)', marginBottom: 14, lineHeight: 1.6 }}>
          Baixe o modelo, preencha com seus produtos e volte para importar.
        </p>
        <Button
          variant="secondary"
          icon={Download}
          onClick={downloadTemplate}
          style={{ background: 'var(--bg)', border: `1.5px solid ${theme.primary}50`, color: theme.primary }}
        >
          Baixar modelo .xlsx
        </Button>
      </Card>

      {/* Passo 2 — Upload */}
      <Card style={{ marginBottom: 14 }}>
        <p style={{
          fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 10, fontWeight: 700,
          color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 12,
        }}>
          Passo 2 — Enviar planilha preenchida
        </p>

        <Card
          onClick={() => fileRef.current?.click()}
          padding="28px 20px"
          style={{
            border: `2px dashed ${fileName ? theme.primary + '70' : 'var(--line)'}`,
            textAlign: 'center', cursor: 'pointer',
            background: fileName ? `${theme.primary}06` : 'var(--bg)',
            transition: 'all .15s',
          }}
        >
          {fileName
            ? <FileSpreadsheet size={28} color={theme.primary} style={{ margin: '0 auto 10px' }} />
            : <UploadCloud size={28} color="var(--muted)" style={{ margin: '0 auto 10px' }} />
          }
          <p style={{
            fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: 600,
            color: fileName ? theme.primary : 'var(--muted)',
          }}>
            {fileName || 'Clique para selecionar a planilha'}
          </p>
          {!fileName && (
            <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
              .xlsx ou .xls
            </p>
          )}
        </Card>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFile} style={{ display: 'none' }} />

        {error && (
          <div style={{
            display: 'flex', gap: 8, alignItems: 'flex-start',
            marginTop: 10, padding: '10px 14px', borderRadius: 'var(--r-input)',
            background: 'var(--status-bad-bg)', border: '1px solid transparent',
          }}>
            <AlertCircle size={14} color="var(--status-bad-tx)" style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, color: 'var(--status-bad-tx)' }}>{error}</p>
          </div>
        )}
      </Card>

      {/* Passo 3 — Preview e confirmação */}
      {preview && (
        <Card style={{ border: `1px solid ${theme.primary}30`, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <p style={{
              fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 10, fontWeight: 700,
              color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.14em',
            }}>
              Passo 3 — Confirmar ({preview.length} produto{preview.length !== 1 ? 's' : ''})
            </p>
            <StatusPill tone="ok" label="Prontos" />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto', marginBottom: 16 }}>
            {preview.map((p, i) => (
              <div key={i} style={{
                padding: '12px 14px', background: 'var(--bg)',
                borderRadius: 'var(--r-input)', border: '1px solid var(--line)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: p.variacoes.length > 0 ? 6 : 0 }}>
                  <span style={{
                    fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 14, fontWeight: 700, color: 'var(--ink)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0,
                  }}>
                    {p.nome}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    {p.precoCusto > 0 && (
                      <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 11, color: 'var(--muted)' }}>
                        Custo: {fmtR(p.precoCusto)}
                      </span>
                    )}
                    {p.precoVenda > 0 && (
                      <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 11, fontWeight: 700, color: theme.primary }}>
                        Venda: {fmtR(p.precoVenda)}
                      </span>
                    )}
                    <StatusPill tone="ok" label="Válido" />
                  </div>
                </div>
                {p.variacoes.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {p.variacoes.map((v, j) => (
                      <span key={j} style={{
                        fontSize: 11, padding: '2px 8px', borderRadius: 6,
                        background: `${theme.primary}14`, color: theme.primary,
                        fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 600,
                      }}>
                        {v.cor} ({v.quantidade})
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <Button
            variant="primary"
            fullWidth
            icon={saving ? undefined : CheckCircle2}
            disabled={saving}
            onClick={handleConfirm}
            style={{ height: 50, background: theme.primary, boxShadow: saving ? 'none' : `0 4px 16px ${theme.primary}40` }}
          >
            {saving
              ? 'Importando...'
              : `Confirmar e importar ${preview.length} produto${preview.length !== 1 ? 's' : ''}`
            }
          </Button>
        </Card>
      )}
    </div>
  )
}
