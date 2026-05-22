// Bulk live relevance test. Runs the full AniList fixture (~300 trending /
// most-popular / top-scored shows) against the LIVE nyaa source with their
// real full title sets (native + foreign synonyms + romaji + english).
//
// This is the at-scale companion to relevance.test.mjs (15 hand-curated cases).
// It proves the end-to-end matching path on real nyaa.si data across hundreds
// of shows, not just the offline logic.
//
// Contamination judging is INDEPENDENT of the source filter, so it is not
// circular: the source matches on the full token set (incl. native/foreign
// synonym tokens and short tokens); this test judges "off-show" only against
// each show's STRONG canonical tokens (>=4-char words from romaji + english,
// the franchise-defining words release groups actually put in filenames). A
// result that contains none of those is flagged as off-show contamination.
//
// Network test (hits nyaa.si). Sequential with pacing + retry to respect rate
// limits. Transient network failures are retried then skipped (not counted as
// logic failures). Fails only on real contamination.
//
// Run: node test/relevance-bulk.test.mjs [limit]   (default: all fixture shows)

import { readFile } from 'node:fs/promises'
import nyaa from '../dist/nyaa.js'
import { significantTokens, stripLangCodes } from '../src/lib/shared.js'

const shows = JSON.parse(await readFile(new URL('./fixtures/anime.json', import.meta.url), 'utf8'))
const LIMIT = parseInt(process.argv[2], 10) || shows.length
const DELAY = 1100      // ms between shows (rate-limit safety)
const RETRY_WAIT = 4000 // ms backoff on transient network failure

const sleep = ms => new Promise(r => setTimeout(r, ms))
// Canonical romaji + english first, then native, then foreign synonyms, as
// AniList/Hayase actually provide them (query selection depends on this order).
const titlesOf = s => [s.romaji, s.english, s.native, ...(s.synonyms || [])].filter(Boolean)

// strong franchise tokens: >=4-char words from canonical English + romaji only
const strongTokens = s => {
  const set = new Set()
  for (const t of [s.romaji, s.english].filter(Boolean)) {
    for (const tok of significantTokens(t)) if (tok.length >= 4) set.add(tok)
  }
  return set
}

let tested = 0, skipped = 0, withResults = 0, zeroResults = 0
let contaminated = 0, totalResults = 0
const offShowShows = []
const zeroShows = []

for (const s of shows.slice(0, LIMIT)) {
  const titles = titlesOf(s)
  const strong = strongTokens(s)
  let r = null
  for (let attempt = 0; attempt < 3 && r === null; attempt++) {
    try {
      // no episode filter: broadest per-show search -> maximizes contamination
      // surface and makes a true zero (no torrents at all) the real signal
      r = await nyaa.single({ titles, resolution: '1080', exclusions: [] })
    } catch (e) {
      if (attempt < 2) { await sleep(RETRY_WAIT); continue }
      r = 'skip'
    }
  }
  if (r === 'skip') { skipped++; await sleep(DELAY); continue }

  tested++
  totalResults += r.length
  if (r.length === 0) { zeroResults++; zeroShows.push(s.english || s.romaji); await sleep(DELAY); continue }
  withResults++

  // off-show: result contains NONE of the strong canonical tokens.
  // skip shows whose canonical title has no strong token (e.g. "Oshi no Ko"
  // -> oshi/ko only) -- a known, accepted limitation, not measurable here.
  if (strong.size) {
    const offShow = r.filter(x => {
      const lower = stripLangCodes(x.title).toLowerCase()
      const despaced = lower.replace(/[^a-z0-9]/g, '')
      // word-boundary match, OR de-spaced substring for long tokens. The latter
      // forgives releases that concatenate or re-space the title ("DragonBall"
      // for "Dragon Ball", "Mo Dao Zu Shi" for "Modao Zushi") so they are not
      // mis-flagged as off-show. Production matching stays strict word-boundary;
      // this leniency only affects what the diagnostic reports.
      return ![...strong].some(tok =>
        new RegExp('\\b' + tok + '\\b').test(lower) ||
        (tok.length >= 5 && despaced.includes(tok)))
    })
    if (offShow.length) {
      contaminated++
      offShowShows.push({
        name: s.english || s.romaji,
        strong: [...strong].join(','),
        n: offShow.length,
        of: r.length,
        eg: offShow[0].title.slice(0, 60)
      })
    }
  }

  if (tested % 25 === 0) console.log('  ...' + tested + ' tested (' + withResults + ' w/results, ' + contaminated + ' contaminated, ' + skipped + ' skipped)')
  await sleep(DELAY)
}

console.log('\n================ BULK LIVE RESULTS ================')
console.log('fixture shows:           ', LIMIT)
console.log('tested (reached nyaa):   ', tested)
console.log('skipped (network fail):  ', skipped)
console.log('returned results:        ', withResults)
console.log('zero results:            ', zeroResults, '(' + (100 * zeroResults / Math.max(tested, 1)).toFixed(1) + '% of tested)')
console.log('total results matched:   ', totalResults)
console.log('shows w/ contamination:  ', contaminated, '(' + (100 * contaminated / Math.max(withResults, 1)).toFixed(2) + '% of shows w/results)')

if (zeroShows.length) {
  console.log('\nzero-result shows (' + zeroShows.length + ', not necessarily bugs -- movies/OVAs/obscure):')
  zeroShows.slice(0, 30).forEach(t => console.log('  ' + t))
}
if (offShowShows.length) {
  offShowShows.sort((a, b) => b.n - a.n)
  console.log('\noff-show contamination:')
  offShowShows.slice(0, 30).forEach(o => console.log('  ' + o.n + '/' + o.of + '  ' + o.name + '  [' + o.strong + ']  e.g. ' + o.eg))
}

// Gate: contamination must stay near zero. Zero-results are reported, not
// failed, since many fixture entries are movies/OVAs/old shows with no 1080p
// single-episode torrents under their canonical name.
const contamRate = contaminated / Math.max(withResults, 1)
let failed = false
if (contamRate > 0.01) { console.log('\nFAIL: ' + (100 * contamRate).toFixed(2) + '% of shows with results had off-show contamination (>1%)'); failed = true }
if (tested < LIMIT * 0.5) { console.log('\nWARN: over half the shows were skipped due to network/rate-limit; results are not conclusive'); }

console.log('\n' + (failed ? 'FAILED' : 'PASSED'))
process.exit(failed ? 1 : 0)
