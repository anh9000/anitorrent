import opentype from 'opentype.js'
import { writeFile, mkdir } from 'node:fs/promises'

const FONT_URL = 'https://fonts.gstatic.com/s/pixelifysans/v3/CHy2V-3HFUT7aC4iv1TxGDR9DHEserHN25py2TTp0H1Y.ttf'
const TEXT = 'anitorrent'
const FONT_SIZE = 96
const PADDING = 12

console.log('Downloading Pixelify Sans...')
const fontRes = await fetch(FONT_URL)
if (!fontRes.ok) {
  console.error('Font download failed:', fontRes.status)
  process.exit(1)
}
const fontBuffer = await fontRes.arrayBuffer()
const font = opentype.parse(fontBuffer)
console.log('Loaded font:', font.names.fullName?.en || font.names.fontFamily?.en)

const combined = new opentype.Path()
let cursor = 0
const scale = FONT_SIZE / font.unitsPerEm
for (const ch of TEXT) {
  const glyph = font.charToGlyph(ch)
  const glyphPath = glyph.getPath(cursor, FONT_SIZE, FONT_SIZE)
  combined.extend(glyphPath)
  cursor += (glyph.advanceWidth || 0) * scale
}

const bbox = combined.getBoundingBox()
const innerW = Math.ceil(bbox.x2 - bbox.x1)
const innerH = Math.ceil(bbox.y2 - bbox.y1)
const width = innerW + PADDING * 2
const height = innerH + PADDING * 2

const pathData = combined.toPathData(2)

function buildSvg (fillColor) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${bbox.x1 - PADDING} ${bbox.y1 - PADDING} ${width} ${height}" role="img" aria-label="${TEXT}">
  <title>${TEXT}</title>
  <path fill="${fillColor}" d="${pathData}"/>
</svg>
`
}

await mkdir('.github/assets', { recursive: true })
await writeFile('.github/assets/title-light.svg', buildSvg('#0a0a0a'))
await writeFile('.github/assets/title-dark.svg', buildSvg('#f6f8fa'))

console.log('Wrote .github/assets/title-light.svg and .github/assets/title-dark.svg')
console.log('Inner size:', innerW + 'x' + innerH, '| Padded:', width + 'x' + height)
