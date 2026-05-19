import opentype from 'opentype.js'
import { writeFile, mkdir } from 'node:fs/promises'
import { Resvg } from '@resvg/resvg-js'

const FONT_URL = 'https://fonts.gstatic.com/s/pixelifysans/v3/CHy2V-3HFUT7aC4iv1TxGDR9DHEserHN25py2TTp0H1Y.ttf'

const CANVAS_W = 1280
const CANVAS_H = 640
const BG = '#0a0a0a'
const FG = '#f6f8fa'
const ACCENT = '#9ca3af'

const TITLE = 'anitorrent'
const TITLE_SIZE = 220
const TITLE_SPACING = 0.93

const SUBTITLE = 'Hayase extension pack'
const SUBTITLE_SIZE = 48
const SUBTITLE_SPACING = 0.93

const TAG = '6 sources    auto updating    no maintenance'
const TAG_SIZE = 28
const TAG_SPACING = 0.93

console.log('Downloading Pixelify Sans...')
const fontRes = await fetch(FONT_URL)
if (!fontRes.ok) {
  console.error('Font download failed:', fontRes.status)
  process.exit(1)
}
const font = opentype.parse(await fontRes.arrayBuffer())

function renderTextPath (text, fontSize, spacingFactor) {
  const combined = new opentype.Path()
  let cursor = 0
  const scale = fontSize / font.unitsPerEm
  for (const ch of text) {
    const glyph = font.charToGlyph(ch)
    const glyphPath = glyph.getPath(cursor, fontSize, fontSize)
    combined.extend(glyphPath)
    cursor += (glyph.advanceWidth || 0) * scale * spacingFactor
  }
  return combined
}

function pathSvg (path, color, opacity = 1) {
  return `<path fill="${color}" opacity="${opacity}" d="${path.toPathData(2)}"/>`
}

function transform (path, dx, dy) {
  return `<g transform="translate(${dx} ${dy})">${path}</g>`
}

const titlePath = renderTextPath(TITLE, TITLE_SIZE, TITLE_SPACING)
const titleBox = titlePath.getBoundingBox()
const titleW = titleBox.x2 - titleBox.x1
const titleH = titleBox.y2 - titleBox.y1
const titleDx = (CANVAS_W - titleW) / 2 - titleBox.x1
const titleDy = CANVAS_H / 2 - titleH / 2 - titleBox.y1 - 30

const subtitlePath = renderTextPath(SUBTITLE, SUBTITLE_SIZE, SUBTITLE_SPACING)
const subtitleBox = subtitlePath.getBoundingBox()
const subtitleW = subtitleBox.x2 - subtitleBox.x1
const subtitleDx = (CANVAS_W - subtitleW) / 2 - subtitleBox.x1
const subtitleDy = titleDy + titleBox.y2 + 60 - subtitleBox.y1

const tagPath = renderTextPath(TAG, TAG_SIZE, TAG_SPACING)
const tagBox = tagPath.getBoundingBox()
const tagW = tagBox.x2 - tagBox.x1
const tagDx = (CANVAS_W - tagW) / 2 - tagBox.x1
const tagDy = subtitleDy + (subtitleBox.y2 - subtitleBox.y1) + 40 - tagBox.y1

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_W}" height="${CANVAS_H}" viewBox="0 0 ${CANVAS_W} ${CANVAS_H}">
  <rect width="${CANVAS_W}" height="${CANVAS_H}" fill="${BG}"/>
  ${transform(pathSvg(titlePath, FG), titleDx, titleDy)}
  ${transform(pathSvg(subtitlePath, FG, 0.85), subtitleDx, subtitleDy)}
  ${transform(pathSvg(tagPath, ACCENT, 0.7), tagDx, tagDy)}
</svg>
`

await mkdir('.github/assets', { recursive: true })
await writeFile('.github/assets/social-preview.svg', svg)

const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: CANVAS_W } })
const pngBuffer = resvg.render().asPng()
await writeFile('.github/assets/social-preview.png', pngBuffer)

console.log('Wrote .github/assets/social-preview.svg (' + svg.length + ' bytes)')
console.log('Wrote .github/assets/social-preview.png (' + pngBuffer.length + ' bytes)')
console.log('Canvas:', CANVAS_W + 'x' + CANVAS_H)
