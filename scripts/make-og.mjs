// Gera public/og.png (1200×630) com a identidade editorial.
// Rodar manualmente quando a identidade mudar: node scripts/make-og.mjs
import satori from 'satori'
import { Resvg } from '@resvg/resvg-js'
import { writeFileSync } from 'node:fs'

async function googleFont (family, weight, italic = false) {
  const ital = italic ? 'ital,' : ''
  const spec = italic ? `1,${weight}` : weight
  const css = await fetch(`https://fonts.googleapis.com/css2?family=${family}:${ital}wght@${spec}`).then(r => r.text())
  const url = css.match(/src: url\((.+?)\)/)?.[1]
  if (!url) throw new Error(`Fonte não encontrada: ${family}`)
  return Buffer.from(await fetch(url).then(r => r.arrayBuffer()))
}

const [fraunces, frauncesItalic, hanken] = await Promise.all([
  googleFont('Fraunces', 600),
  googleFont('Fraunces', 500, true),
  googleFont('Hanken+Grotesk', 500),
])

const PAPER = '#FAF8F2'
const INK = '#2B2620'
const GREEN = '#2E7D5B'
const MINT = '#34d399'

const svg = await satori(
  {
    type: 'div',
    props: {
      style: {
        width: '1200px', height: '630px', display: 'flex', flexDirection: 'column',
        background: PAPER, color: INK, padding: '64px 72px 56px', position: 'relative',
      },
      children: [
        { type: 'div', props: { style: { position: 'absolute', right: '36px', top: '-60px', fontFamily: 'FrauncesItalic', fontSize: '420px', color: MINT, opacity: 0.22 }, children: '¶' } },
        { type: 'div', props: { style: { display: 'flex', flexDirection: 'column', borderBottom: `4px solid ${INK}`, paddingBottom: '10px' }, children: [
          { type: 'div', props: { style: { fontFamily: 'Hanken', fontSize: '22px', letterSpacing: '5px', color: '#6B635A' }, children: 'MINTLY — GESTÃO FINANCEIRA PARA RESTAURANTES' } },
        ] } },
        { type: 'div', props: { style: { display: 'flex', borderBottom: `1.5px solid ${INK}`, height: '5px', marginTop: '2px' } } },
        { type: 'div', props: { style: { display: 'flex', flexDirection: 'column', marginTop: '96px' }, children: [
          { type: 'div', props: { style: { fontFamily: 'Fraunces', fontSize: '96px', lineHeight: 1.08, display: 'flex' }, children: [
            { type: 'span', props: { children: 'A documentação ' } },
            { type: 'span', props: { style: { fontFamily: 'FrauncesItalic', color: GREEN, marginLeft: '22px' }, children: 'viva' } },
          ] } },
          { type: 'div', props: { style: { fontFamily: 'Fraunces', fontSize: '96px', lineHeight: 1.08 }, children: 'do projeto.' } },
        ] } },
        { type: 'div', props: { style: { marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderTop: `1.5px solid #C9C2B6`, paddingTop: '20px' }, children: [
          { type: 'div', props: { style: { fontFamily: 'Fraunces', fontSize: '30px' }, children: 'Mintly · Documentos' } },
          { type: 'div', props: { style: { fontFamily: 'Hanken', fontSize: '20px', color: '#6B635A', letterSpacing: '3px' }, children: 'RELEASES · SPECS · DIAGRAMAS' } },
        ] } },
      ],
    },
  },
  {
    width: 1200,
    height: 630,
    fonts: [
      { name: 'Fraunces', data: fraunces, weight: 600, style: 'normal' },
      { name: 'FrauncesItalic', data: frauncesItalic, weight: 500, style: 'italic' },
      { name: 'Hanken', data: hanken, weight: 500, style: 'normal' },
    ],
  },
)

const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng()
writeFileSync(new URL('../public/og.png', import.meta.url), png)
console.log(`public/og.png gerado (${(png.length / 1024).toFixed(0)} KB)`)
