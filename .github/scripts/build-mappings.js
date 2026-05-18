import { writeFile, mkdir } from 'node:fs/promises'

const SOURCE = 'https://github.com/manami-project/anime-offline-database/releases/latest/download/anime-offline-database-minified.json'
const OUT = 'data/anilist-to-anidb.json'

const RE_ANILIST = /anilist\.co\/anime\/(\d+)/
const RE_ANIDB = /anidb\.net\/anime\/(\d+)/

console.log('Downloading', SOURCE)
const res = await fetch(SOURCE)
if (!res.ok) {
  console.error('HTTP', res.status, res.statusText)
  process.exit(1)
}
const data = await res.json()
const entries = Array.isArray(data?.data) ? data.data : []
console.log('Source entries:', entries.length)

const mapping = {}
let bothCount = 0
for (const entry of entries) {
  let anilist = null
  let anidb = null
  for (const src of entry.sources || []) {
    if (!anilist) {
      const m = RE_ANILIST.exec(src)
      if (m) anilist = Number(m[1])
    }
    if (!anidb) {
      const m = RE_ANIDB.exec(src)
      if (m) anidb = Number(m[1])
    }
    if (anilist && anidb) break
  }
  if (anilist && anidb) {
    mapping[anilist] = anidb
    bothCount++
  }
}

await mkdir('data', { recursive: true })
const out = JSON.stringify(mapping)
await writeFile(OUT, out)

console.log('Wrote', OUT)
console.log('  AniList -> AniDB pairs:', bothCount)
console.log('  Coverage:', ((bothCount / entries.length) * 100).toFixed(1) + '%')
console.log('  File size:', (out.length / 1024).toFixed(1), 'KB')
console.log('  Source last update:', data?.lastUpdate || '?')
