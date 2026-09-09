// Configuração da faixa de vídeo do topo do catálogo.
//
// A feature existia no catálogo público desde o começo (docs/CATALOGO_SPEC.md,
// seção 4.1) mas NÃO tinha tela: só dava para ligar escrevendo o jsonb
// `catalogo_video_topo` direto no banco. Este bloco é essa tela.
//
// Um componente só para mobile e desktop: ConfigB2B e ConfigB2BDesktop têm o
// mesmo formulário, e duplicar aqui seria criar duas verdades sobre o mesmo
// jsonb. O layout se adapta por flex-wrap, sem media query.

import { useRef, useState } from 'react'
import { Video, Upload, Trash2, Image as ImageIcon } from 'lucide-react'
import SecaoTitulo from '../studio/SecaoTitulo'
import Input, { Label } from '../studio/Input'
import {
  VIDEO_ACCEPT, CAPA_ACCEPT, validarVideo, validarCapa,
  uploadVideoTopo, temMidia,
} from '../../utils/videoTopo'

/** Linha de ajuda abaixo de um campo. */
const AJUDA = {
  margin: '6px 0 0', fontFamily: 'var(--font-ui)', fontSize: 12,
  color: 'var(--muted)', lineHeight: 1.45,
}

/** Botão de arquivo — o <input type=file> nativo não aceita estilo. */
function BotaoArquivo({ Icon, texto, accept, onArquivo, ocupado, theme }) {
  const ref = useRef(null)
  return (
    <>
      <input
        ref={ref} type="file" accept={accept} style={{ display: 'none' }}
        onChange={e => {
          const f = e.target.files?.[0]
          // Zera o valor para reescolher o MESMO arquivo disparar onChange de
          // novo — sem isso, tentar reenviar depois de um erro não faz nada.
          e.target.value = ''
          if (f) onArquivo(f)
        }}
      />
      <button
        type="button"
        onClick={() => ref.current?.click()}
        disabled={ocupado}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          height: 40, padding: '0 14px', borderRadius: 'var(--r-input)',
          border: `1px solid ${theme?.primary || 'var(--primary)'}`,
          background: 'transparent', color: theme?.primary || 'var(--primary)',
          cursor: ocupado ? 'progress' : 'pointer', opacity: ocupado ? 0.6 : 1,
          fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 600,
        }}
      >
        <Icon size={14} /> {ocupado ? 'Enviando…' : texto}
      </button>
    </>
  )
}

export default function VideoTopoConfig({ valor, aoMudar, lojaId, client, theme }) {
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState('')   // '' | 'video' | 'capa'

  const set = (campo, v) => aoMudar({ ...valor, [campo]: v })
  const comMidia = temMidia(valor)

  async function enviar(file, tipo) {
    const problema = tipo === 'capa' ? validarCapa(file) : validarVideo(file)
    if (problema) { setErro(problema); return }
    setErro('')
    setEnviando(tipo)
    try {
      const url = await uploadVideoTopo(client, lojaId, file, tipo)
      aoMudar({ ...valor, [tipo === 'capa' ? 'imagemUrl' : 'videoUrl']: url })
    } catch (e) {
      // Mesma leitura de status usada no upload de foto: a recusa de RLS do
      // Storage tem a MESMA mensagem com e sem sessão, então afirmar a causa
      // manda quem investiga para o lado errado.
      const status = Number(e?.status) || Number(e?.statusCode) || 0
      const msg = String(e?.message || e || '')
      if (status === 401 || /jwt|token/i.test(msg)) {
        setErro('Sua sessão expirou. Saia, entre de novo e repita o envio.')
      } else if (/row-level security/i.test(msg)) {
        setErro('O Storage recusou a gravação. Pode ser sessão não aceita, ou o '
          + 'bucket sem policy de INSERT para esta loja '
          + '(ver supabase/migration_storage_produtos_midia.sql).')
      } else {
        setErro(status ? `${msg} (HTTP ${status})` : msg)
      }
    } finally {
      setEnviando('')
    }
  }

  return (
    <div>
      <SecaoTitulo
        Icon={Video}
        titulo="Vídeo de topo"
        descricao="Faixa de capa acima do cabeçalho do catálogo"
        theme={theme}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Ligar/desligar. Fica no topo porque é a decisão principal. */}
        <label style={{
          display: 'flex', alignItems: 'flex-start', gap: 9, cursor: 'pointer',
          fontFamily: 'var(--font-ui)', fontSize: 13.5, color: 'var(--ink)',
        }}>
          <input
            type="checkbox"
            checked={valor.ativo === true}
            onChange={e => set('ativo', e.target.checked)}
            style={{ width: 16, height: 16, marginTop: 2, cursor: 'pointer', accentColor: theme?.primary }}
          />
          <span>
            Mostrar a faixa no catálogo
            <span style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginTop: 2, lineHeight: 1.45 }}>
              {comMidia
                ? 'A faixa aparece no topo, acima do nome da loja.'
                : 'Envie um vídeo ou uma imagem de capa primeiro — sem mídia a faixa não aparece, mesmo marcada.'}
            </span>
          </span>
        </label>

        {/* ── Vídeo ── */}
        <div>
          <Label>Vídeo (MP4 ou WEBM, até 15 MB)</Label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <BotaoArquivo
              Icon={Upload} texto={valor.videoUrl ? 'Trocar vídeo' : 'Enviar vídeo'}
              accept={VIDEO_ACCEPT} onArquivo={f => enviar(f, 'video')}
              ocupado={enviando === 'video'} theme={theme}
            />
            {valor.videoUrl && (
              <button
                type="button"
                onClick={() => set('videoUrl', '')}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  height: 40, padding: '0 12px', borderRadius: 'var(--r-input)',
                  border: '1px solid var(--line)', background: 'var(--bg)',
                  color: 'var(--status-bad-tx)', cursor: 'pointer',
                  fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 600,
                }}
              ><Trash2 size={14} /> Remover</button>
            )}
          </div>
        </div>

        {/* ── Capa ──
            Não é enfeite: é o poster do vídeo enquanto ele carrega, o que
            aparece para quem pediu menos animação no sistema, e a única mídia
            quando não há vídeo (a spec manda animar a imagem devagar nesse
            caso). */}
        <div>
          <Label>Imagem de capa (opcional)</Label>
          <p style={{ margin: '0 0 8px', fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--muted)', lineHeight: 1.45 }}>
            Aparece enquanto o vídeo carrega e para quem tem animações reduzidas no
            celular. Sem vídeo, ela vira a faixa sozinha.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <BotaoArquivo
              Icon={ImageIcon} texto={valor.imagemUrl ? 'Trocar capa' : 'Enviar capa'}
              accept={CAPA_ACCEPT} onArquivo={f => enviar(f, 'capa')}
              ocupado={enviando === 'capa'} theme={theme}
            />
            {valor.imagemUrl && (
              <button
                type="button"
                onClick={() => set('imagemUrl', '')}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  height: 40, padding: '0 12px', borderRadius: 'var(--r-input)',
                  border: '1px solid var(--line)', background: 'var(--bg)',
                  color: 'var(--status-bad-tx)', cursor: 'pointer',
                  fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 600,
                }}
              ><Trash2 size={14} /> Remover</button>
            )}
          </div>
        </div>

        {/* ── Textos sobre a faixa ──
            Campo vazio = SEM TEXTO. O título caía no nome da loja e a etiqueta
            em "Coleção nova", então apagar os campos não apagava nada no
            catálogo — a lojista era empurrada a digitar "." ou "//" para
            simular vazio. Agora vazio funciona, e a ajuda abaixo diz isso com
            todas as letras para ninguém precisar descobrir tentando. */}
        <div>
          <Label>Etiqueta</Label>
          <Input
            value={valor.etiqueta}
            onChange={e => set('etiqueta', e.target.value)}
            placeholder="Coleção nova"
          />
          <p style={AJUDA}>Deixe vazio para não mostrar etiqueta nenhuma.</p>
        </div>
        <div>
          <Label>Título</Label>
          <Input
            value={valor.titulo}
            onChange={e => set('titulo', e.target.value)}
            placeholder="Coleção Verão"
          />
          <p style={AJUDA}>Deixe vazio para não mostrar título nenhum.</p>
        </div>
        <p style={AJUDA}>
          Com os dois campos vazios, o vídeo aparece limpo, sem nenhum texto por cima.
        </p>

        {erro && (
          <p role="alert" style={{
            margin: 0, fontFamily: 'var(--font-ui)', fontSize: 12.5, lineHeight: 1.5,
            color: 'var(--status-bad-tx)', background: 'rgba(180,56,31,.08)',
            border: '1px solid var(--status-bad-tx)', borderRadius: 'var(--r-input)',
            padding: '10px 12px',
          }}>{erro}</p>
        )}

        {/* ── Prévia ──
            Reproduz a faixa real: mesma altura em clamp, mesmo overlay e mesma
            tipografia da seção 4.1 da spec. Vale mais que descrever em texto o
            que a lojista vai ver. */}
        {comMidia && (
          <div>
            <Label>Prévia</Label>
            <div style={{
              position: 'relative', height: 'clamp(140px, 22vw, 200px)',
              overflow: 'hidden', background: '#191713', borderRadius: 12,
            }}>
              {valor.videoUrl ? (
                <video
                  key={valor.videoUrl}
                  src={valor.videoUrl} poster={valor.imagemUrl || undefined}
                  autoPlay muted loop playsInline preload="metadata"
                  // Mesmo object-fit do catálogo (contain): a prévia existe
                  // para mostrar a verdade. Com `cover` aqui e `contain` lá, a
                  // lojista aprovaria um enquadramento e publicaria outro.
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }}
                />
              ) : (
                <img
                  src={valor.imagemUrl} alt=""
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                />
              )}
              <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(180deg, rgba(25,23,19,.34) 0%, rgba(25,23,19,.1) 40%, rgba(25,23,19,.8) 100%)',
              }} />
              {/* Sem fallback, igual ao catálogo: a prévia mostrava
                  "Coleção nova" e "(nome da loja)" para campos vazios, que era
                  justamente a impressão errada de que vazio produz texto. */}
              {(valor.etiqueta || valor.titulo) && (
                <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '14px 16px' }}>
                  {valor.etiqueta && (
                    <p style={{
                      margin: 0, fontSize: 10.5, fontWeight: 600, letterSpacing: '.16em',
                      textTransform: 'uppercase', color: 'rgba(251,249,245,.8)',
                      fontFamily: 'var(--font-ui)',
                    }}>{valor.etiqueta}</p>
                  )}
                  {valor.titulo && (
                    <p style={{
                      margin: valor.etiqueta ? '3px 0 0' : 0,
                      fontFamily: 'Instrument Serif, Georgia, serif',
                      fontWeight: 400, fontSize: 'clamp(20px, 3.6vw, 30px)',
                      lineHeight: 1.05, color: '#FBF9F5',
                    }}>{valor.titulo}</p>
                  )}
                </div>
              )}
            </div>
            {!valor.ativo && (
              <p style={{ margin: '7px 0 0', fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--muted)' }}>
                Assim vai ficar quando você marcar "Mostrar a faixa no catálogo".
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
