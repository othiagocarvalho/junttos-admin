import { T } from '../../theme/tokens'
import { UFS, sanitizaVencimentoDia } from './contratante'

// Campos do contratante, compartilhados entre o cadastro de loja nova
// (CadastroCliente) e a edição de loja existente (LojaDetalhe). São os mesmos
// que a Edge Function copia para o snapshot do contrato — manter as duas telas
// no mesmo componente evita que uma ganhe um campo e a outra não.
// As constantes e helpers ficam em ./contratante.js — ver o porquê lá.

const inp = {
  width: '100%', height: 44, boxSizing: 'border-box',
  background: T.mist, border: `1.5px solid ${T.line}`,
  borderRadius: T.rInput, padding: '0 14px',
  fontFamily: T.ui, fontSize: 14, color: T.ink, outline: 'none',
}
const sel = {
  ...inp, cursor: 'pointer', appearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24'%3E%3Cpath fill='%237B7390' d='M7 10l5 5 5-5z'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 14px center',
}
const lbl = { display: 'block', fontSize: 12, fontWeight: 600, color: T.ink, marginBottom: 6 }
// Os dois modais são estreitos (≤540px), então as linhas quebram sozinhas.
const row = { display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }

/**
 * @param valores  objeto com os 14 campos (aceita um form maior — só lê o que interessa)
 * @param onChange (campo, valor) => void
 * @param intro    texto opcional acima dos campos
 */
export default function CamposContratante({ valores, onChange, intro }) {
  const v = k => valores?.[k] ?? ''
  const set = k => e => onChange(k, e.target.value)

  function handleVencimento(e) {
    const limpo = sanitizaVencimentoDia(e.target.value)
    if (limpo === null) return          // digitação inválida: ignora
    onChange('vencimento_dia', limpo)
  }

  return (
    <>
      {intro && (
        <p style={{ fontSize: 11, color: T.muted, marginBottom: 14, lineHeight: 1.5 }}>{intro}</p>
      )}

      <div style={{ marginBottom: 16 }}>
        <label style={lbl}>Razão social / Nome completo</label>
        <input value={v('razao_social')} onChange={set('razao_social')} placeholder="Maria Store Comércio LTDA — ou o nome completo, se for CPF" style={inp} />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={lbl}>CPF / CNPJ</label>
        <input value={v('cpf_cnpj')} onChange={set('cpf_cnpj')} placeholder="000.000.000-00 ou 00.000.000/0000-00" style={{ ...inp, fontFamily: T.mono }} />
      </div>

      <div style={row}>
        <div style={{ flex: '3 1 220px', minWidth: 0 }}>
          <label style={lbl}>Endereço</label>
          <input value={v('endereco')} onChange={set('endereco')} placeholder="Rua das Flores" style={inp} />
        </div>
        <div style={{ flex: '1 1 90px', minWidth: 0 }}>
          <label style={lbl}>Número</label>
          <input value={v('numero')} onChange={set('numero')} placeholder="123" style={inp} />
        </div>
      </div>

      <div style={row}>
        <div style={{ flex: '1 1 160px', minWidth: 0 }}>
          <label style={lbl}>Complemento</label>
          <input value={v('complemento')} onChange={set('complemento')} placeholder="Sala 2" style={inp} />
        </div>
        <div style={{ flex: '1 1 160px', minWidth: 0 }}>
          <label style={lbl}>Bairro</label>
          <input value={v('bairro')} onChange={set('bairro')} placeholder="Centro" style={inp} />
        </div>
      </div>

      <div style={row}>
        <div style={{ flex: '2 1 160px', minWidth: 0 }}>
          <label style={lbl}>Cidade</label>
          <input value={v('cidade')} onChange={set('cidade')} placeholder="Fortaleza" style={inp} />
        </div>
        <div style={{ flex: '0 1 92px', minWidth: 0 }}>
          <label style={lbl}>UF</label>
          <select value={v('estado')} onChange={set('estado')} style={sel}>
            <option value="">—</option>
            {UFS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
          </select>
        </div>
        <div style={{ flex: '1 1 120px', minWidth: 0 }}>
          <label style={lbl}>CEP</label>
          <input value={v('cep')} onChange={set('cep')} placeholder="60000-000" style={{ ...inp, fontFamily: T.mono }} />
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={lbl}>Responsável</label>
        <input value={v('responsavel_nome')} onChange={set('responsavel_nome')} placeholder="Nome de quem assina o contrato" style={inp} />
      </div>

      <div style={row}>
        <div style={{ flex: '1 1 180px', minWidth: 0 }}>
          <label style={lbl}>E-mail do responsável</label>
          <input type="email" value={v('responsavel_email')} onChange={set('responsavel_email')} placeholder="maria@email.com" style={inp} />
        </div>
        <div style={{ flex: '1 1 150px', minWidth: 0 }}>
          <label style={lbl}>Telefone do responsável</label>
          <input value={v('responsavel_telefone')} onChange={set('responsavel_telefone')} placeholder="(85) 99999-0000" style={inp} />
        </div>
      </div>

      <div style={{ ...row, marginBottom: 4 }}>
        <div style={{ flex: '1 1 180px', minWidth: 0 }}>
          <label style={lbl}>Início do contrato</label>
          <input type="date" value={v('contrato_inicio')} onChange={set('contrato_inicio')} style={{ ...inp, cursor: 'pointer', colorScheme: 'light' }} />
        </div>
        <div style={{ flex: '1 1 130px', minWidth: 0 }}>
          <label style={lbl}>Dia de vencimento</label>
          <input
            type="number" min="1" max="31" step="1"
            value={v('vencimento_dia')}
            onChange={handleVencimento}
            placeholder="10"
            style={inp}
          />
          <p style={{ fontSize: 11, color: T.muted, marginTop: 5 }}>
            Todo dia {v('vencimento_dia') || '__'} de cada mês
          </p>
        </div>
      </div>
    </>
  )
}
