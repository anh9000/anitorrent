// Renders the "how it works" diagram as a retro green-phosphor CRT SVG.
// All text is converted to vector paths (opentype.js) because SVGs embedded in
// a GitHub README via <img> cannot load external fonts. Output is a single
// static SVG, so there are no GitHub mermaid pan/zoom controls.
import opentype from 'opentype.js'
import { writeFile, mkdir } from 'node:fs/promises'

const FONT_URL = 'https://fonts.gstatic.com/s/pixelifysans/v3/CHy2V-3HFUT7aC4iv1TxGDR9DHEserHN25py2TTp0H1Y.ttf'
const LETTER_SPACING = 0.96

// phosphor palette
const BG = '#03120a'
const BRIGHT = '#3dff88'
const DIM = '#1f8a4d'
const LINE = '#2bd873'

const fontRes = await fetch(FONT_URL)
if (!fontRes.ok) { console.error('font download failed', fontRes.status); process.exit(1) }
const font = opentype.parse(await fontRes.arrayBuffer())
const scale = s => s / font.unitsPerEm

function measure (text, size) {
  let w = 0
  for (const ch of text) w += (font.charToGlyph(ch).advanceWidth || 0) * scale(size) * LETTER_SPACING
  return w
}
function glyphs (text, x, baseline, size) {
  const p = new opentype.Path()
  let cur = x
  for (const ch of text) {
    p.extend(font.charToGlyph(ch).getPath(cur, baseline, size))
    cur += (font.charToGlyph(ch).advanceWidth || 0) * scale(size) * LETTER_SPACING
  }
  return p.toPathData(2)
}
// centered horizontally at cx, auto-shrinks to fit maxw
function centered (text, cx, baseline, size, maxw, fill) {
  let s = size
  while (measure(text, s) > maxw && s > 6) s -= 0.5
  const w = measure(text, s)
  return `<path fill="${fill}" d="${glyphs(text, cx - w / 2, baseline, s)}"/>`
}

const W = 1060
const H = 600
const parts = []

// ---- box helper: rounded rect + vertically-centered lines ----
function box (cx, top, w, h, lines, opts = {}) {
  const x = cx - w / 2
  const out = [`<rect x="${x}" y="${top}" width="${w}" height="${h}" rx="7" fill="#06190f" stroke="${opts.stroke || BRIGHT}" stroke-width="${opts.sw || 2}"${opts.dash ? ` stroke-dasharray="${opts.dash}"` : ''}/>`]
  const totalH = lines.reduce((a, l) => a + l.size + 4, -4)
  let y = top + (h - totalH) / 2 + lines[0].size * 0.78
  for (const l of lines) {
    out.push(centered(l.text, cx, y, l.size, w - 16, l.fill || BRIGHT))
    y += l.size + 4
  }
  return out.join('\n  ')
}

// ---- arrow helper ----
function arrow (x1, y1, x2, y2, opts = {}) {
  const ang = Math.atan2(y2 - y1, x2 - x1)
  const len = 9
  const a1 = ang + Math.PI - 0.45
  const a2 = ang + Math.PI + 0.45
  const head = `<path fill="${opts.color || LINE}" d="M${x2.toFixed(1)} ${y2.toFixed(1)} L${(x2 + len * Math.cos(a1)).toFixed(1)} ${(y2 + len * Math.sin(a1)).toFixed(1)} L${(x2 + len * Math.cos(a2)).toFixed(1)} ${(y2 + len * Math.sin(a2)).toFixed(1)} Z"/>`
  const line = `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${opts.color || LINE}" stroke-width="${opts.sw || 1.6}"${opts.dash ? ` stroke-dasharray="${opts.dash}"` : ''}/>`
  return line + '\n  ' + head
}

// ===== layout =====
const QUERY = { cx: 530, top: 42, w: 440, h: 54 }
const SRC = { top: 190, h: 66, w: 152, gap: 12, n: 6 }
const srcStart = (W - (SRC.n * SRC.w + (SRC.n - 1) * SRC.gap)) / 2
const srcCx = i => srcStart + SRC.w / 2 + i * (SRC.w + SRC.gap)
const sources = [
  ['Nyaa', 'nyaa.si'],
  ['AnimeTosho', 'feed.animetosho.org'],
  ['Seadex', 'releases.moe'],
  ['SubsPlease', 'subsplease.org'],
  ['Yameii', 'nyaa.si'],
  ['ToonsHub', 'nyaa.si']
]
const FILTER = { cx: 530, top: 322, w: 580, h: 52 }
const MERGE = { cx: 530, top: 424, w: 470, h: 50 }
const RESULT = { cx: 530, top: 516, w: 360, h: 48 }
const MAP = { cx: srcCx(1), top: 120, w: 210, h: 34 }

// fan-out: query -> each source
const fan = []
for (let i = 0; i < SRC.n; i++) fan.push(arrow(QUERY.cx, QUERY.top + QUERY.h, srcCx(i), SRC.top))
// fan-in: each source -> filter
for (let i = 0; i < SRC.n; i++) fan.push(arrow(srcCx(i), SRC.top + SRC.h, FILTER.cx, FILTER.top))
// dotted: anidb map -> AnimeTosho
fan.push(arrow(MAP.cx, MAP.top + MAP.h, srcCx(1), SRC.top, { dash: '3 3', color: DIM }))
// filter -> merge -> result
fan.push(arrow(FILTER.cx, FILTER.top + FILTER.h, MERGE.cx, MERGE.top))
fan.push(arrow(MERGE.cx, MERGE.top + MERGE.h, RESULT.cx, RESULT.top))

const boxes = []
boxes.push(box(QUERY.cx, QUERY.top, QUERY.w, QUERY.h, [
  { text: 'Hayase query', size: 22 },
  { text: 'titles - episode - resolution - exclusions', size: 12, fill: DIM }
]))
for (let i = 0; i < SRC.n; i++) {
  boxes.push(box(srcCx(i), SRC.top, SRC.w, SRC.h, [
    { text: sources[i][0], size: 15 },
    { text: sources[i][1], size: 10, fill: DIM }
  ]))
}
boxes.push(box(MAP.cx, MAP.top, MAP.w, MAP.h, [
  { text: 'anilist-to-anidb.json', size: 12, fill: DIM }
], { stroke: DIM, sw: 1.5, dash: '4 3' }))
boxes.push(box(FILTER.cx, FILTER.top, FILTER.w, FILTER.h, [
  { text: 'shared filter - src/lib/shared.js', size: 16 },
  { text: 'pick title - match show - episode - resolution', size: 11, fill: DIM }
]))
boxes.push(box(MERGE.cx, MERGE.top, MERGE.w, MERGE.h, [
  { text: 'Hayase merges every source', size: 15 },
  { text: 'de-duplicate by infohash', size: 11, fill: DIM }
]))
boxes.push(box(RESULT.cx, RESULT.top, RESULT.w, RESULT.h, [
  { text: 'results in the picker', size: 17 }
]))

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="anitorrent search flow: Hayase query fans out to six sources in parallel, an AniList-to-AniDB map feeds AnimeTosho, results pass through the shared filter, then Hayase merges and de-duplicates by infohash before showing results">
  <defs>
    <radialGradient id="vig" cx="50%" cy="42%" r="75%">
      <stop offset="0%" stop-color="#06210f"/>
      <stop offset="100%" stop-color="${BG}"/>
    </radialGradient>
    <pattern id="scan" width="3" height="3" patternUnits="userSpaceOnUse">
      <rect width="3" height="3" fill="none"/>
      <rect width="3" height="1.2" fill="#000000" opacity="0.22"/>
    </pattern>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="1.6" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <rect x="6" y="6" width="${W - 12}" height="${H - 12}" rx="22" fill="url(#vig)" stroke="#0c3a1f" stroke-width="3"/>

  <g filter="url(#glow)">
  ${fan.join('\n  ')}
  ${boxes.join('\n  ')}
  </g>

  <rect x="6" y="6" width="${W - 12}" height="${H - 12}" rx="22" fill="url(#scan)"/>
</svg>
`

await mkdir('.github/assets', { recursive: true })
await writeFile('.github/assets/how-it-works.svg', svg)
console.log('Wrote .github/assets/how-it-works.svg', W + 'x' + H)
