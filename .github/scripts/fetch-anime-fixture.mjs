import { writeFile, mkdir } from 'node:fs/promises'

const Q = `query($page:Int,$sort:[MediaSort]){Page(page:$page,perPage:50){media(sort:$sort,type:ANIME){id title{romaji english native} synonyms}}}`

async function page (sort, p) {
  const res = await fetch('https://graphql.anilist.co', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: Q, variables: { page: p, sort: [sort] } })
  })
  if (!res.ok) { console.error(sort, p, res.status); return [] }
  const j = await res.json()
  return j?.data?.Page?.media || []
}

const byId = new Map()
for (const [sort, pages] of [['TRENDING_DESC', 3], ['POPULARITY_DESC', 3], ['SCORE_DESC', 2]]) {
  for (let p = 1; p <= pages; p++) {
    for (const m of await page(sort, p)) byId.set(m.id, m)
    await new Promise(r => setTimeout(r, 800))
    console.error('fetched', sort, p, '->', byId.size, 'unique')
  }
}

const out = [...byId.values()].map(m => ({
  id: m.id,
  romaji: m.title?.romaji || null,
  english: m.title?.english || null,
  native: m.title?.native || null,
  synonyms: m.synonyms || []
}))
await mkdir('test/fixtures', { recursive: true })
await writeFile('test/fixtures/anime.json', JSON.stringify(out))
console.error('WROTE', out.length, 'shows')
