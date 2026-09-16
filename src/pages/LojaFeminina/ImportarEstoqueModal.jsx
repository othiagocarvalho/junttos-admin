import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import { X, UploadCloud, FileSpreadsheet, AlertCircle, CheckCircle2 } from 'lucide-react'
import Button from '../../components/studio/Button'
import StatusPill from '../../components/studio/StatusPill'
import VariacaoBadge from '../../components/studio/VariacaoBadge'
import { fmtR } from '../../utils/formatters'
import { agruparLinhasPlanilha, totalizarProdutosImportados } from '../../utils/importarEstoquePlanilha'

// Modal "Importar Estoque" — planilha longa (uma linha por variação):
//   Produto | Cor | Tamanho | Quantidade | Custo | Venda
//
// Parsing/agrupamento é 100% em utils/importarEstoquePlanilha.js (puro,
// testado). Este componente só lê o arquivo, mostra a prévia e, no confirmar,
// chama importarProdutos() — a mesma função que useLojaData.js já usa para
// gravar em lf_produtos com o contexto de movimentação correto
// ('importacao'), então a lista de Estoque atualiza sozinha (fetchAll
// interno) sem precisar recarregar a página.
export default function ImportarEstoqueModal({ theme, importarProdutos, onClose }) {
  const [fileName, setFileName] = useState('')
  const [parseError, setParseError] = useState('')
  const [resultado, setResultado] = useState(null) // { produtos, erros }
  const [saving, setSaving]   = useState(false)
  const [saveError, setSaveError] = useState('')
  const [done, setDone] = useState(null) // { totalProdutos, totalPecas }
  const fileRef = useRef(null)

  function handleFile(e) {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    setFileName(file.name)
    setParseError('')
    setResultado(null)
    setSaveError('')

    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const wb   = XLSX.read(ev.target.result, { type: 'binary' })
        const ws   = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })

        if (rows.length === 0) {
          setParseError('A planilha está vazia.')
          return
        }
        const { produtos, erros } = agruparLinhasPlanilha(rows)
        if (produtos.length === 0 && erros.length === 0) {
          setParseError('Nenhum produto encontrado na planilha.')
          return
        }
        setResultado({ produtos, erros })
      } catch {
        setParseError('Erro ao ler o arquivo. Verifique se é um .xlsx ou .csv válido.')
      }
    }
    reader.readAsBinaryString(file)
  }

  async function handleConfirm() {
    if (!resultado?.produtos?.length || saving) return
    setSaving(true)
    setSaveError('')
    const totais = totalizarProdutosImportados(resultado.produtos)
    const err = await importarProdutos(resultado.produtos)
    setSaving(false)
    if (err) {
      setSaveError('Erro ao importar: ' + err.message)
    } else {
      setDone({ totalProdutos: totais.totalProdutos, totalPecas: totais.totalPecas })
    }
  }

  function fecharTudo() {
    setFileName('')
    setParseError('')
    setResultado(null)
    setSaveError('')
    setDone(null)
    onClose()
  }

  const totais = resultado ? totalizarProdutosImportados(resultado.produtos) : null

  return (
    <div
      onClick={e => e.target === e.currentTarget && !saving && fecharTudo()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 220, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
    >
      <div style={{ background: 'var(--surface)', borderRadius: '20px 20px 0 0', padding: '28px 20px 40px', width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 -8px 40px rgba(0,0,0,0.18)' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          <div>
            <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, fontSize: 16, color: 'var(--ink)' }}>
              Importar Estoque
            </p>
            <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
              Cadastre vários produtos de uma vez, a partir de uma planilha
            </p>
          </div>
          <div role="button" tabIndex={0} onClick={() => !saving && fecharTudo()}
            onKeyDown={e => e.key === 'Enter' && !saving && fecharTudo()}
            style={{ cursor: saving ? 'not-allowed' : 'pointer', color: 'var(--muted)', display: 'flex', alignItems: 'center', padding: 4 }}>
            <X size={18} />
          </div>
        </div>

        {done ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <CheckCircle2 size={40} color={theme.primary} style={{ margin: '0 auto 14px' }} />
            <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, fontSize: 16, color: 'var(--ink)', marginBottom: 6 }}>
              Importação concluída!
            </p>
            <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, color: 'var(--muted)', marginBottom: 22 }}>
              {done.totalProdutos} produto{done.totalProdutos !== 1 ? 's' : ''} · {done.totalPecas} peça{done.totalPecas !== 1 ? 's' : ''} adicionada{done.totalPecas !== 1 ? 's' : ''} ao estoque.
            </p>
            <Button variant="primary" fullWidth onClick={fecharTudo} style={{ background: theme.primary, height: 48 }}>
              Fechar
            </Button>
          </div>
        ) : !resultado ? (
          <>
            <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, color: 'var(--ink-soft)', marginBottom: 6, lineHeight: 1.6 }}>
              Colunas na primeira linha, nessa ordem: <strong>Produto, Cor, Tamanho, Quantidade, Custo, Venda</strong>. Cada linha é uma variação — use "Único" em Cor e/ou Tamanho quando o produto não varia nessa dimensão.
            </p>
            <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.6 }}>
              Aceita arquivos .xlsx ou .csv.
            </p>

            <div
              onClick={() => fileRef.current?.click()}
              style={{
                border: `2px dashed ${fileName ? theme.primary + '70' : 'var(--line)'}`,
                borderRadius: 14, padding: '28px 20px', textAlign: 'center', cursor: 'pointer',
                background: fileName ? `${theme.primary}06` : 'var(--bg)',
              }}
            >
              {fileName
                ? <FileSpreadsheet size={28} color={theme.primary} style={{ margin: '0 auto 10px' }} />
                : <UploadCloud size={28} color="var(--muted)" style={{ margin: '0 auto 10px' }} />
              }
              <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: 600, color: fileName ? theme.primary : 'var(--muted)' }}>
                {fileName || 'Clique para selecionar a planilha'}
              </p>
              {!fileName && (
                <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                  .xlsx ou .csv
                </p>
              )}
            </div>
            <input ref={fileRef} type="file" accept=".xlsx,.csv" onChange={handleFile} style={{ display: 'none' }} />

            {parseError && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 12, padding: '10px 14px', borderRadius: 10, background: 'var(--status-bad-bg, #fee2e2)' }}>
                <AlertCircle size={14} color="var(--status-bad-tx, #dc2626)" style={{ flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, color: 'var(--status-bad-tx, #dc2626)' }}>{parseError}</p>
              </div>
            )}
          </>
        ) : (
          <>
            {/* Resumo do lote */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
              <div style={{ background: 'var(--bg)', borderRadius: 12, border: '1px solid var(--line)', padding: '10px 12px', textAlign: 'center' }}>
                <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 18, fontWeight: 700, color: 'var(--ink)' }}>{totais.totalProdutos}</p>
                <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Produtos</p>
              </div>
              <div style={{ background: 'var(--bg)', borderRadius: 12, border: '1px solid var(--line)', padding: '10px 12px', textAlign: 'center' }}>
                <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 18, fontWeight: 700, color: 'var(--ink)' }}>{totais.totalPecas}</p>
                <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Peças</p>
              </div>
              <div style={{ background: 'var(--bg)', borderRadius: 12, border: '1px solid var(--line)', padding: '10px 12px', textAlign: 'center' }}>
                <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, fontWeight: 700, color: theme.primary }}>{fmtR(totais.totalVenda)}</p>
                <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Venda total</p>
              </div>
            </div>
            <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 11, color: 'var(--muted)', marginBottom: 16, textAlign: 'center' }}>
              Custo total do lote: {fmtR(totais.totalCusto)}
            </p>

            {/* Erros de linha */}
            {resultado.erros.length > 0 && (
              <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 10, background: 'var(--status-bad-bg, #fee2e2)' }}>
                <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, fontWeight: 700, color: 'var(--status-bad-tx, #dc2626)', marginBottom: 6 }}>
                  {resultado.erros.length} linha{resultado.erros.length !== 1 ? 's' : ''} ignorada{resultado.erros.length !== 1 ? 's' : ''} (não vão ser importadas)
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {resultado.erros.map((e, i) => (
                    <p key={i} style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 11, color: 'var(--status-bad-tx, #dc2626)' }}>
                      Linha {e.linha}: {e.motivo}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Lista de produtos válidos */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto', marginBottom: 16 }}>
              {resultado.produtos.map((p, i) => (
                <div key={i} style={{ padding: '12px 14px', background: 'var(--bg)', borderRadius: 12, border: '1px solid var(--line)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 14, fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                      {p.nome}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 11, color: 'var(--muted)' }}>
                        {p.totalPecas} peça{p.totalPecas !== 1 ? 's' : ''}
                      </span>
                      <StatusPill tone="ok" label="Válido" />
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {p.variacoes.map((v, j) => (
                      <VariacaoBadge key={j} nome={v.cor} quantidade={v.quantidade} />
                    ))}
                  </div>
                  {p.avisos.length > 0 && (
                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--line)' }}>
                      {p.avisos.map((a, k) => (
                        <p key={k} style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 10.5, color: '#b45309' }}>
                          ⚠ {a}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {saveError && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 14, padding: '10px 14px', borderRadius: 10, background: 'var(--status-bad-bg, #fee2e2)' }}>
                <AlertCircle size={14} color="var(--status-bad-tx, #dc2626)" style={{ flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, color: 'var(--status-bad-tx, #dc2626)' }}>{saveError}</p>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <Button variant="secondary" onClick={fecharTudo} disabled={saving} style={{ flex: 1, height: 48 }}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                onClick={handleConfirm}
                disabled={saving || resultado.produtos.length === 0}
                style={{ flex: 2, height: 48, background: theme.primary }}
              >
                {saving ? 'Importando...' : `Confirmar importação (${resultado.produtos.length})`}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
