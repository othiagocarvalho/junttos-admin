import { useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { ChevronLeft, Download, UploadCloud, FileSpreadsheet, Check, AlertCircle } from 'lucide-react'
import { paraDataLocal } from '../../utils/datas'
import { fmtR } from '../../utils/formatters'

const AZUL     = '#1E63C8'
const VERDE    = '#17864F'
const VERMELHO = '#C4321F'

// Colunas do modelo, na ordem. Validade é opcional.
const COLUNAS = ['EAN', 'Nome', 'Preço Venda', 'Quantidade', 'Validade']

/** Aceita número de série do Excel, Date, ou texto DD/MM/AAAA e AAAA-MM-DD. */
function lerValidade(valor) {
  if (valor === '' || valor === null || valor === undefined) return null

  // O xlsx devolve datas como número de série quando a célula é do tipo data
  if (typeof valor === 'number') {
    const d = XLSX.SSF.parse_date_code(valor)
    if (!d) return null
    return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
  }

  const txt = String(valor).trim()
  if (!txt) return null

  const br = txt.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (br) return `${br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`

  const d = paraDataLocal(txt)
  if (!d) return null
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function lerNumero(valor) {
  if (valor === '' || valor === null || valor === undefined) return 0
  const n = parseFloat(String(valor).replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

export default function ImportarProdutos({ importarProdutos, setTab }) {
  const [linhas, setLinhas]     = useState(null)   // preview
  const [invalidas, setInval]   = useState([])     // rejeitadas já na leitura
  const [arquivo, setArquivo]   = useState('')
  const [erro, setErro]         = useState('')
  const [salvando, setSalvando] = useState(false)
  const [resultado, setResult]  = useState(null)   // { inseridos, erros }
  const fileRef = useRef(null)

  function baixarModelo() {
    const exemplos = [
      ['7891000100103', 'Arroz Tipo 1 5kg',   24.90, 50, ''],
      ['7891000100200', 'Feijão Carioca 1kg',  8.90, 30, ''],
      ['7891000100301', 'Leite Integral 1L',   5.90, 24, '15/08/2026'],
    ]
    const ws = XLSX.utils.aoa_to_sheet([COLUNAS, ...exemplos])
    ws['!cols'] = [{ wch: 16 }, { wch: 28 }, { wch: 13 }, { wch: 12 }, { wch: 14 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Produtos')
    XLSX.writeFile(wb, 'modelo-produtos-mercado.xlsx')
  }

  function lerArquivo(e) {
    const file = e.target.files[0]
    if (!file) return
    setArquivo(file.name)
    setErro(''); setLinhas(null); setInval([]); setResult(null)

    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const wb   = XLSX.read(ev.target.result, { type: 'binary' })
        const ws   = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

        const ok = []
        const ruins = []
        // +2: pula o cabeçalho e converte para numeração de planilha (1-based)
        rows.slice(1).forEach((row, i) => {
          const numeroLinha = i + 2
          const nome = String(row[1] || '').trim()
          const vazia = row.every(c => String(c ?? '').trim() === '')
          if (vazia) return
          if (!nome) { ruins.push({ linha: numeroLinha, nome: '(sem nome)', motivo: 'sem nome' }); return }

          const preco = lerNumero(row[2])
          if (preco <= 0) { ruins.push({ linha: numeroLinha, nome, motivo: 'preço inválido' }); return }

          const qtd = Math.max(0, Math.round(lerNumero(row[3])))
          const validade = lerValidade(row[4])

          // Formato do Mercado: uma variação "Único" por produto. A validade
          // NÃO entra aqui — ela vive só em lf_produtos.data_vencimento, que é
          // de onde a tela de Validade lê. Um único lugar de verdade evita as
          // duas fontes divergirem depois.
          const variacao = { cor: 'Único', quantidade: qtd }

          ok.push({
            linha:      numeroLinha,
            ean:        String(row[0] || '').trim() || null,
            nome,
            precoVenda: preco,
            quantidade: qtd,
            validade,
            variacoes:  [variacao],
          })
        })

        if (!ok.length && !ruins.length) { setErro('Nenhum produto encontrado na planilha.'); return }
        setLinhas(ok)
        setInval(ruins)
      } catch {
        setErro('Não consegui ler o arquivo. Confira se é uma planilha .xlsx ou .xls válida.')
      }
    }
    reader.readAsBinaryString(file)
    e.target.value = ''
  }

  async function confirmar() {
    if (!linhas?.length || salvando) return
    setSalvando(true)
    const res = await importarProdutos(linhas)
    setSalvando(false)
    if (res?.error) { setErro('Erro ao salvar: ' + res.error.message); return }
    // junta o que foi barrado na leitura com o que o hook rejeitou
    setResult({ inseridos: res.inseridos, erros: [...invalidas, ...(res.erros || [])] })
  }

  const cartao = {
    background: '#FFFFFF', border: '1.5px solid #E4E4E8', borderRadius: 18,
    padding: '16px 18px',
  }
  const rotulo = {
    fontSize: 12, fontWeight: 800, color: '#8A8A93', margin: '0 0 8px',
    textTransform: 'uppercase', letterSpacing: '.1em',
  }

  return (
    <div className="imp-root" style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: '#FFFFFF' }}>
      {/*
        Sem spec T-numerada: esta é uma tela de suporte, não de fluxo. Segue a
        linguagem já estabelecida nas outras telas do Mercado — faixa colorida
        no mobile, cabeçalho neutro no desktop, conteúdo centralizado com
        largura máxima e blocos que não esticam.
      */}
      <style>{`
        .imp-root  { height: 100dvh; }
        .imp-shell { display: contents; }

        @container (min-width: 1024px) {
          .imp-root { height: auto; min-height: 100dvh; }
          .imp-shell {
            display: flex; flex-direction: column; flex: 1; min-height: 0;
            width: 100%; max-width: 1160px; margin: 0 auto;
            padding: 30px 40px 34px; box-sizing: border-box;
          }
          .imp-faixa { background: #FFFFFF !important; padding: 0 0 22px !important; }
          .imp-voltar     { color: #71717A !important; }
          .imp-voltar svg { stroke: #71717A !important; }
          .imp-titulo     { font-size: 34px !important; color: #18181B !important; }
          .imp-sub        { color: #71717A !important; opacity: 1 !important; }
          .imp-corpo      { padding: 0 !important; overflow: visible !important; max-width: 720px; }
          .imp-rodape {
            padding: 24px 0 0 !important; justify-content: flex-end;
            border-top: none !important; max-width: 720px;
          }
          .imp-rodape button { flex: 0 0 auto !important; min-width: 300px; }
        }
      `}</style>

      <div className="imp-shell">
        {/* Faixa */}
        <div className="imp-faixa" style={{ background: AZUL, padding: '14px 22px 20px', flexShrink: 0 }}>
          <button
            className="imp-voltar"
            onClick={() => setTab('estoque')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none',
              cursor: 'pointer', marginBottom: 14, padding: 0, color: '#FFFFFF',
              fontSize: 17, fontWeight: 800, fontFamily: 'inherit',
            }}
          >
            <ChevronLeft size={24} strokeWidth={2.5} />
            Estoque
          </button>
          <p className="imp-titulo" style={{ fontSize: 24, fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
            Importar produtos
          </p>
          <p className="imp-sub" style={{ fontSize: 16, color: '#FFFFFF', opacity: .9, margin: '4px 0 0' }}>
            Cadastre vários de uma vez por planilha
          </p>
        </div>

        {/* Corpo */}
        <div className="imp-corpo" style={{
          flex: 1, minHeight: 0, overflowY: 'auto', padding: '18px 22px',
          display: 'flex', flexDirection: 'column', gap: 14,
        }}>
          {/* Resultado final */}
          {resultado ? (
            <>
              <div style={{ ...cartao, background: '#E8F5EE', border: 'none', textAlign: 'center', padding: '28px 20px' }}>
                <Check size={38} color={VERDE} strokeWidth={2.4} />
                <p style={{ fontSize: 22, fontWeight: 800, color: '#0F5C36', margin: '10px 0 0' }}>
                  {resultado.inseridos} produto{resultado.inseridos === 1 ? '' : 's'} importado{resultado.inseridos === 1 ? '' : 's'}
                </p>
                {resultado.erros.length > 0 && (
                  <p style={{ fontSize: 16, fontWeight: 700, color: '#0F5C36', margin: '4px 0 0', opacity: .85 }}>
                    {resultado.erros.length} com erro
                  </p>
                )}
              </div>

              {resultado.erros.length > 0 && (
                <div style={cartao}>
                  <p style={rotulo}>Linhas não importadas</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {resultado.erros.map((e, i) => (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        background: '#FFF1EC', borderRadius: 12, padding: '10px 12px',
                      }}>
                        <AlertCircle size={18} color={VERMELHO} strokeWidth={2.2} style={{ flexShrink: 0 }} />
                        <p style={{ fontSize: 15, fontWeight: 700, color: '#8A3427', margin: 0 }}>
                          Linha {e.linha}: {e.nome} — {e.motivo}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Passo 1 — modelo */}
              <div style={cartao}>
                <p style={rotulo}>Passo 1 · Baixar o modelo</p>
                <p style={{ fontSize: 16, color: '#52525B', margin: '0 0 14px', lineHeight: 1.5 }}>
                  A planilha tem 5 colunas: <strong>{COLUNAS.join(' · ')}</strong>. A validade é opcional.
                </p>
                <button
                  onClick={baixarModelo}
                  style={{
                    height: 56, minHeight: 56, width: '100%', borderRadius: 16, cursor: 'pointer',
                    border: `1.5px solid ${AZUL}`, background: '#FFFFFF', color: AZUL,
                    fontSize: 17, fontWeight: 800, fontFamily: 'inherit',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}
                >
                  <Download size={20} strokeWidth={2.4} />
                  Baixar modelo
                </button>
              </div>

              {/* Passo 2 — upload */}
              <div style={cartao}>
                <p style={rotulo}>Passo 2 · Enviar a planilha</p>
                <div
                  onClick={() => fileRef.current?.click()}
                  style={{
                    border: `2px dashed ${arquivo ? AZUL : '#D4D4D8'}`, borderRadius: 16,
                    padding: '26px 18px', textAlign: 'center', cursor: 'pointer',
                    background: arquivo ? `${AZUL}0A` : '#FAFAFA',
                  }}
                >
                  {arquivo
                    ? <FileSpreadsheet size={30} color={AZUL} strokeWidth={2} />
                    : <UploadCloud size={30} color="#8A8A93" strokeWidth={2} />}
                  <p style={{
                    fontSize: 16, fontWeight: 800, margin: '10px 0 0',
                    color: arquivo ? AZUL : '#52525B',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {arquivo || 'Toque para escolher o arquivo'}
                  </p>
                  {!arquivo && (
                    <p style={{ fontSize: 14, color: '#8A8A93', margin: '2px 0 0' }}>.xlsx ou .xls</p>
                  )}
                </div>
                <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={lerArquivo} style={{ display: 'none' }} />

                {erro && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10, marginTop: 12,
                    background: '#FFF1EC', borderRadius: 12, padding: '12px 14px',
                  }}>
                    <AlertCircle size={18} color={VERMELHO} strokeWidth={2.2} style={{ flexShrink: 0 }} />
                    <p style={{ fontSize: 15, fontWeight: 700, color: '#8A3427', margin: 0 }}>{erro}</p>
                  </div>
                )}
              </div>

              {/* Passo 3 — preview */}
              {linhas && (
                <div style={{ ...cartao, border: `1.5px solid ${AZUL}55` }}>
                  <p style={rotulo}>
                    Passo 3 · Conferir ({linhas.length} produto{linhas.length === 1 ? '' : 's'})
                  </p>

                  {invalidas.length > 0 && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12,
                      background: '#FFF1EC', borderRadius: 12, padding: '10px 12px',
                    }}>
                      <AlertCircle size={18} color={VERMELHO} strokeWidth={2.2} style={{ flexShrink: 0 }} />
                      <p style={{ fontSize: 15, fontWeight: 700, color: '#8A3427', margin: 0 }}>
                        {invalidas.length} linha{invalidas.length === 1 ? '' : 's'} será{invalidas.length === 1 ? '' : 'ão'} ignorada{invalidas.length === 1 ? '' : 's'}
                      </p>
                    </div>
                  )}

                  <div className="imp-preview" style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
                    {linhas.map(p => (
                      <div key={p.linha} style={{
                        background: '#F7F7F9', borderRadius: 12, padding: '10px 12px',
                        display: 'flex', alignItems: 'center', gap: 10,
                      }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{
                            fontSize: 16, fontWeight: 800, color: '#18181B', margin: 0,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>{p.nome}</p>
                          <p style={{ fontSize: 13, color: '#71717A', margin: '2px 0 0' }}>
                            {p.quantidade} un.
                            {p.ean ? ` · ${p.ean}` : ''}
                            {p.validade ? ` · vence ${p.validade.split('-').reverse().join('/')}` : ''}
                          </p>
                        </div>
                        <p style={{ fontSize: 16, fontWeight: 800, color: AZUL, margin: 0, flexShrink: 0 }}>
                          {fmtR(p.precoVenda)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Rodapé */}
        <div className="imp-rodape" style={{
          padding: '14px 22px calc(20px + env(safe-area-inset-bottom))', display: 'flex',
          flexShrink: 0, borderTop: '1px solid #F1F1F4', background: '#FFFFFF',
        }}>
          {resultado ? (
            <button
              onClick={() => setTab('estoque')}
              style={{
                flex: 1, height: 68, minHeight: 68, borderRadius: 18, border: 'none',
                background: AZUL, color: '#FFFFFF', cursor: 'pointer',
                fontSize: 18, fontWeight: 800, whiteSpace: 'nowrap',
              }}
            >
              Ver no estoque
            </button>
          ) : (
            <button
              onClick={confirmar}
              disabled={!linhas?.length || salvando}
              style={{
                flex: 1, height: 68, minHeight: 68, borderRadius: 18, border: 'none',
                background: linhas?.length ? AZUL : '#E4E4E8',
                color: linhas?.length ? '#FFFFFF' : '#A1A1AA',
                cursor: linhas?.length ? 'pointer' : 'default',
                fontSize: 18, fontWeight: 800, whiteSpace: 'nowrap',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              <Check size={22} strokeWidth={2.6} />
              {salvando
                ? 'Importando...'
                : linhas?.length ? `Importar ${linhas.length} produto${linhas.length === 1 ? '' : 's'}` : 'Importar'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
