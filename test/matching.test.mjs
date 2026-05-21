// Offline matching test over ~300 real AniList title sets.
// Validates the title-selection and show-matching logic (the code behind every
// recurring search bug) deterministically, no network. Run: npm run test:matching
//
// Per show:
//   1. rankTitlesForQuery yields a usable query (else the show searches nothing,
//      the Witch Hat Atelier zero-results bug)
//   2. buildTitleTokens is non-empty
//   3. self-match: releases built from the show's canonical titles (romaji,
//      english) match the show's own tokens (a show must find its own releases)
// Then measures cross-franchise contamination: one show's tokens matching a
// DIFFERENT franchise's release. Same-franchise season variants (which share
// their main title word) are excluded since those matches are expected.

import { readFile } from 'node:fs/promises'
import {
  rankTitlesForQuery, buildTitleTokens, resultMatchesShow, significantTokens
} from '../src/lib/shared.js'

const shows = JSON.parse(await readFile(new URL('./fixtures/anime.json', import.meta.url), 'utf8'))

const titlesOf = s => [s.native, ...(s.synonyms || []), s.romaji, s.english].filter(Boolean)
const releaseForms = title => [
  `[SubsPlease] ${title} - 01 (1080p) [ABCD1234].mkv`,
  `[Erai-raws] ${title} - 01 [1080p][MultiSub]`,
  `[Group] ${title} S01E01 [1080p]`
]

let emptyQuery = 0
let emptyTokens = 0
const selfFailShows = []
const emptyQueryShows = []
const prepared = []

for (const s of shows) {
  const titles = titlesOf(s)
  const ranked = rankTitlesForQuery(titles)
  const tokens = buildTitleTokens(titles)
  if (!ranked.length) { emptyQuery++; emptyQueryShows.push(titles[0]) }
  if (!tokens.size) emptyTokens++

  // self-match on canonical titles only (romaji + english), which is what
  // release groups actually name files after
  const canon = [s.romaji, s.english].filter(t => t && significantTokens(t).length > 0)
  let selfOk = true
  for (const t of canon) {
    for (const form of releaseForms(t)) {
      if (tokens.size && !resultMatchesShow(form, tokens)) selfOk = false
    }
  }
  if (canon.length && !selfOk) selfFailShows.push(s.english || s.romaji)

  // tokens >= 5 chars are the "franchise-defining" ones (kimetsu, shingeki,
  // gintama); shared between two shows they almost certainly mean same franchise
  const longTokens = [...tokens].filter(t => t.length >= 5)
  const rel = (s.romaji || s.english)
  prepared.push({ id: s.id, tokens, longTokens, canonical: rel ? `[Group] ${rel} - 01 [1080p]` : null, name: rel })
}

// cross-franchise contamination: skip pairs that share ANY >=5-char token
// (proxy for same franchise / season / arc variants, e.g. Gintama arcs,
// Demon Slayer arcs, Attack on Titan final-season parts), since those matches
// are expected and correct, not contamination.
const sharesFranchise = (a, b) => a.longTokens.some(t => b.tokens.has(t))
let crossPairs = 0, totalPairs = 0
const offenders = []
for (const a of prepared) {
  if (!a.tokens.size) continue
  let hits = 0
  for (const b of prepared) {
    if (a.id === b.id || !b.canonical) continue
    if (sharesFranchise(a, b)) continue // same franchise
    totalPairs++
    if (resultMatchesShow(b.canonical, a.tokens)) { crossPairs++; hits++ }
  }
  if (hits > 0) offenders.push({ name: a.name, tokens: [...a.tokens].join(','), hits })
}

console.log('shows tested:                 ', shows.length)
console.log('empty query (searches nothing):', emptyQuery)
console.log('empty tokens (no filter):      ', emptyTokens)
console.log('self-match failures:           ', selfFailShows.length)
console.log('cross-franchise contamination: ', crossPairs, 'of', totalPairs,
  '(' + (100 * crossPairs / totalPairs).toFixed(3) + '%)')

if (emptyQueryShows.length) {
  console.log('\nno usable query (' + emptyQueryShows.length + '):')
  emptyQueryShows.slice(0, 20).forEach(t => console.log('  ' + t))
}
if (selfFailShows.length) {
  console.log('\nself-match failures (' + selfFailShows.length + '):')
  selfFailShows.slice(0, 25).forEach(t => console.log('  ' + t))
}
offenders.sort((a, b) => b.hits - a.hits)
if (offenders.length) {
  console.log('\ntop cross-franchise offenders:')
  offenders.slice(0, 12).forEach(o => console.log('  ' + o.hits + 'x  ' + o.name + '  [' + o.tokens + ']'))
}

let failed = false
if (selfFailShows.length > 0) { console.log('\nFAIL: ' + selfFailShows.length + ' shows do not match their own releases'); failed = true }
if (emptyQuery > shows.length * 0.05) { console.log('\nFAIL: too many shows produce no usable query'); failed = true }
const rate = crossPairs / totalPairs
if (rate > 0.005) { console.log('\nFAIL: cross-franchise contamination ' + (100 * rate).toFixed(3) + '% exceeds 0.5%'); failed = true }

console.log('\n' + (failed ? 'FAILED' : 'PASSED'))
process.exit(failed ? 1 : 0)
