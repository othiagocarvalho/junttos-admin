import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { registrarHistorico } from '../lib/historicoCobranca'
import { executarCriacaoLoja, isSlugReservado, isValidSlug } from './criarLojaFluxo'

// A orquestração (e todo o rollback) mora em criarLojaFluxo.js, que não
// importa Supabase nem React e por isso é testável de verdade. Aqui fica só o
// estado da tela. Reexportado para não mexer em quem já importa daqui —
// CadastroCliente, ConsultorNovaLoja e os testes.
export {
  toSlug, isValidSlug, buildLojaPayload,
  SLUGS_RESERVADOS, isSlugReservado,
} from './criarLojaFluxo'

/**
 * Hook que encapsula toda a lógica de criação de loja:
 * validação → INSERT lf_config → create-user edge function → INSERT jt_cobrancas.
 *
 * Usado tanto por CadastroCliente (admin) quanto por ConsultorNovaLoja.
 * O campo cadastrado_por_consultor_id só é enviado quando fornecido.
 */
export function useCreateLoja() {
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState('')
  const [successLink, setSuccessLink] = useState('')

  function reset() { setError(''); setSuccessLink('') }

  async function save(params) {
    const { nome, slug } = params

    if (!nome?.trim() || !slug?.trim()) {
      setError('Nome e slug são obrigatórios.')
      return null
    }
    if (isSlugReservado(slug)) {
      setError(`"${slug}" é um endereço reservado do sistema. Escolha outro slug.`)
      return null
    }
    if (!isValidSlug(slug)) {
      setError('Slug inválido. Use apenas letras minúsculas, números e hífens (2–40 caracteres, sem começar/terminar com hífen).')
      return null
    }

    setSaving(true); setError('')
    try {
      const { link, aviso } = await executarCriacaoLoja(params, {
        supabase,
        origin: window.location.origin,
        registrarHistorico,
      })
      // Aviso é falha não fatal: a loja existe, mas alguma coisa acessória
      // (contratante, cobranças) não foi gravada. Aparece junto do sucesso.
      if (aviso) setError(aviso)
      setSuccessLink(link)
      return link
    } catch (err) {
      setError(err.message)
      return null
    } finally {
      setSaving(false)
    }
  }

  return { save, saving, error, successLink, reset }
}
