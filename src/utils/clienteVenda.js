// Cadastro rápido de cliente durante a Nova Venda: o campo Aniversário grava
// em lf_clientes.data_nascimento (mesma coluna do cadastro completo em
// Clientes.jsx) sem obrigar a lojista a passar pela tela de Clientes.
//
// Casamento com cliente já existente é por nome (trim, sem caixa) — mesma
// comparação que a autocomplete de Nova Venda já usa. Achando, só grava a
// data se o cliente ainda não tinha uma (nunca sobrescreve o que já estava
// lá). Não achando, cria um cliente novo com nome + telefone + aniversário.
//
// Erros aqui nunca devem derrubar a venda — ela já foi gravada com sucesso
// antes desta função rodar; o try/catch é de propósito, silencioso.
export async function salvarAniversarioCliente({ clientes = [], addCliente, updateCliente, nome, telefone, aniversario }) {
  if (!aniversario) return
  const nomeNorm = (nome || '').trim().toLowerCase()
  if (!nomeNorm) return

  try {
    const existente = clientes.find(c => (c.nome || '').trim().toLowerCase() === nomeNorm)
    if (existente) {
      if (!existente.data_nascimento) {
        await updateCliente(existente.id, { data_nascimento: aniversario })
      }
    } else {
      await addCliente({ nome: nome.trim(), telefone: telefone || '', data_nascimento: aniversario })
    }
  } catch {
    // Silencioso: a venda já foi salva, isto é só um efeito colateral.
  }
}
