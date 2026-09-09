// Bancada de teste do catálogo novo — SOMENTE DESENVOLVIMENTO.
//
// Existe para olhar o CatalogoPublicoV2 rodando sem plugá-lo em nenhuma rota
// do app. Entrada própria (preview-catalogo.html), fora do index.html, então
// `vite build` nem enxerga este arquivo — o bundle de produção continua
// idêntico ao de antes.
//
// Uso:  npm run dev  →  http://localhost:5173/preview-catalogo.html?loja=tropicaleatacado

import { createRoot } from 'react-dom/client'
import CatalogoPublicoV2 from '../pages/catalogo/CatalogoPublicoV2'

const loja = new URLSearchParams(window.location.search).get('loja') || 'tropicaleatacado'

createRoot(document.getElementById('root')).render(<CatalogoPublicoV2 lojaId={loja} />)
