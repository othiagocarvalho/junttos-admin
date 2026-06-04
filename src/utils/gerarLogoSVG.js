export function gerarLogoSVG({ nome, corPrimaria = '#6B4FBB', corSecundaria = '#2A1F1F' }) {
  const iniciais = nome.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" width="80" height="80">
    <rect width="80" height="80" rx="16" fill="${corSecundaria}"/>
    <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-size="32" font-weight="700" fill="${corPrimaria}">${iniciais}</text>
  </svg>`
}

export function gerarLogoDataURL({ nome, corPrimaria, corSecundaria }) {
  const svg = gerarLogoSVG({ nome, corPrimaria, corSecundaria })
  return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)))
}
