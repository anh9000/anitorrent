// Shared matching, query, and torrent helpers used by every source.
// Single source of truth: fix matching logic here once, all sources inherit it.

// nyaa.si sits behind ddos-guard, which serves a challenge page (not RSS) to
// clients that do not look like a browser. A plain fetch() with no User-Agent
// gets challenged in some host environments, so the response has no <item> and
// the source returns nothing. Sending browser-like headers gets past it. In a
// real browser/worker, User-Agent is a forbidden header and is silently
// ignored (the browser sets its own), so this is safe everywhere.
export const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/xml, text/xml, text/html, application/json, */*'
}

export function httpGet (url, opts = {}) {
  const { headers, ...rest } = opts
  return fetch(url, { headers: { ...BROWSER_HEADERS, ...headers }, ...rest })
}

// test() runs on Hayase launch and Hayase kills it with a generic "Extension
// check timed out" toast if it hasn't returned in about ten seconds. We beat
// that with our own 6s abort so we can throw a specific, non-scary message
// telling the user what is actually going on and that no reinstall is needed.
// Used by every nyaa.si-based source (Nyaa, Yameii, ToonsHub).
export async function checkNyaaFeed (url) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 6000)
  let res
  try {
    res = await httpGet(url, { signal: ctrl.signal })
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('nyaa.si is slow to respond right now. This is temporary and usually clears in a minute. Searches will still work; the extension is fine, no reinstall needed.')
    }
    throw new Error('nyaa.si is currently unreachable. The extension will work again once the site is back, nothing to fix on your end.')
  } finally {
    clearTimeout(timer)
  }
  if (res.status === 429) {
    throw new Error('nyaa.si is rate-limiting requests. Wait a minute and toggle this extension off and on.')
  }
  if (!res.ok) {
    throw new Error('nyaa.si returned HTTP ' + res.status + '. The extension will work again once the site is back.')
  }
  const text = await res.text()
  if (!text.includes('<rss') && !text.includes('<item>')) {
    throw new Error('nyaa.si returned an unexpected response (likely a ddos-guard challenge). Try again in a minute; the extension will keep working when it clears.')
  }
  return true
}

export const TRACKERS = [
  'udp://tracker.opentrackr.org:1337/announce',
  'udp://open.stealth.si:80/announce',
  'udp://tracker.torrent.eu.org:451/announce',
  'udp://exodus.desync.com:6969/announce',
  'udp://tracker.coppersurfer.tk:6969/announce',
  'udp://tracker.openbittorrent.com:6969/announce',
  'http://nyaa.tracker.wf:7777/announce'
]

export const BATCH_PATTERNS = [
  /\bbatch\b/i,
  /\bcomplete\b/i,
  /\bseason\s*\d+\b/i,
  /\bs\d{1,2}\b(?!\s*e\d)/i,
  /\b\d{1,3}\s*[-~]\s*\d{1,3}\b/
]

export const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'this', 'that', 'her', 'his',
  'are', 'was', 'were', 'has', 'have', 'had', 'who', 'what', 'when',
  'where', 'why', 'how', 'all', 'any', 'one', 'two', 'season',
  'episode', 'part', 'arc', 'movie', 'film', 'ova', 'special',
  // Japanese romanization noise: grammatical particles, pronouns, honorifics,
  // copula, common verbs, and arc/chapter markers that romanize to short tokens
  // and appear across unrelated shows ("-hen" arc suffix, "na Ken", "boku/ore"
  // pronouns, "-sama/-san/-kun/-chan" honorifics). Never show-identifying.
  'hen', 'boku', 'ore', 'kimi', 'sama', 'san', 'kun', 'chan', 'suru',
  'naru', 'nani', 'desu', 'dake', 'made', 'demo', 'inai', 'koi', 'ken', 'shi',
  // "dan" leaked "Grow Up Show: Himawari no Circus-dan" (Japanese for "troupe")
  // into every Dandadan search. Dandadan self-match is unaffected because the
  // canonical title tokens to "dandadan" (14 chars, kept), not "dan".
  'dan'
])

export function escapeQuery (str) {
  return String(str || '').replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

export function significantTokens (title) {
  return escapeQuery(title)
    .toLowerCase()
    .split(/\s+/)
    .filter(t => t.length >= 3 && !STOPWORDS.has(t) && !/^\d+(st|nd|rd|th)$/.test(t))
}

export function buildTitleTokens (titles) {
  // Word-boundary matching (tokenInTitle) already prevents fragment tokens like
  // "dan" from matching inside unrelated words like "danganronpa", so no
  // substring de-duplication is needed (and de-duping wrongly dropped real
  // words like "toxin" inside the concatenated synonym "marriagetoxin").
  const tokens = new Set()
  for (const t of titles || []) {
    for (const tok of significantTokens(t)) tokens.add(tok)
  }
  return tokens
}

export function tokenInTitle (tok, lower) {
  return new RegExp('\\b' + tok + '\\b').test(lower)
}

export function stripLangCodes (title) {
  // Multi-sub release groups (Erai-raws etc.) append a long run of bracketed
  // language/region codes: [ENG][POR-BR][SPA-LA][DAN][CHI]... These are file
  // metadata, not part of the show name, yet "[DAN]" matches the token "dan"
  // (from "DAN DA DAN") via word boundaries and pulled Ranma/Ao no Hako into
  // Dandadan results. Strip all-caps 2-3 letter bracket codes before matching.
  return String(title).replace(/\[[A-Z]{2,3}(?:-[A-Z]{2,3})?\]/g, ' ')
}

export function resultMatchesShow (title, tokens, minHits = 1) {
  if (!tokens.size) return true
  const lower = stripLangCodes(title).toLowerCase()
  let hits = 0
  for (const tok of tokens) {
    if (tokenInTitle(tok, lower)) {
      hits++
      if (hits >= minHits) return true
    }
  }
  return false
}

const ROMAN_SEASON = { II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10 }

// Extract a season number from a single title string, or null if none found.
// Handles "SxxExx", "Season 2", "2nd Season", trailing Roman numeral, trailing
// digit. Used both to classify the show (from AniList titles) and to classify
// a torrent result title, so the two can be compared.
export function detectResultSeason (title) {
  const t = String(title || '')
  // "S02E01" (combined) OR "S2 - 08" / "S02" (season marker alone, no episode
  // appended). Release groups use BOTH conventions: SubsPlease writes "S2 - 08"
  // and Erai-raws writes similar, while many BD groups write "S02E01". The
  // earlier regex only caught the SxxExx form and missed the space-separated
  // one, leaking Season 2 releases into Season 1 searches.
  let m = t.match(/\bS(\d{1,2})(?:E\d|\b)/i)
  if (m) return parseInt(m[1], 10)
  // "Season 2" / "2nd Season" / "3rd Season" / "4th Season"
  m = t.match(/\b(?:Season\s+(\d+)|(\d+)(?:st|nd|rd|th)\s+Season)\b/i)
  if (m) return parseInt(m[1] || m[2], 10)
  // Trailing Roman numeral after a word: "Foo II", "Die Neue These IV"
  m = t.match(/\b[A-Za-z]+\s+(II|III|IV|V|VI|VII|VIII|IX|X)(?=\s|:|\.|-|$|\[|\()/)
  if (m) return ROMAN_SEASON[m[1]]
  // Trailing single digit 2-9 at end / before delimiter, but SKIP when
  // preceded by "Part". "Part N" is ambiguous in anime naming: sometimes it
  // means season number, sometimes a cour within a season (e.g. "BLEACH TYBW
  // Part 4" is cour 4 of season 1 of the arc but release groups use S17
  // continuous numbering, not "Part 4"). Detecting "Part N" as a season marker
  // caused every real release to be rejected. Rest of the pattern is unchanged.
  const digitRE = /\b([2-9])(?=\s*$|\s*[:\-|(\[])/g
  let dm
  while ((dm = digitRE.exec(t)) !== null) {
    const before = t.slice(Math.max(0, dm.index - 8), dm.index).toLowerCase()
    if (/\bpart\s+$/.test(before)) continue
    return parseInt(dm[1], 10)
  }
  return null
}

// Highest season detected across a show's title list. Returns 1 as the default
// when no season marker is present anywhere (single-season show or unmarked
// sequel like "Frieren"). We take the max because AniList often lists both the
// bare franchise name and the season-numbered variant in the same title set,
// and we want the season-numbered one to win.
export function detectShowSeason (titles) {
  let max = 0
  for (const t of titles || []) {
    const n = detectResultSeason(t)
    if (n && n > max) max = n
  }
  return max || 1
}

// True when the result's season is compatible with the searched show.
// Asymmetric rule reflecting release-group conventions:
//   - Show is S2+: result MUST carry a matching season marker. Reject anything
//     with no marker at all (that is almost certainly an older-season release
//     that just happens to share the show's tokens, e.g. "Youjo Senki - 01"
//     for a "Youjo Senki II" search).
//   - Show is S1: reject only results that explicitly claim a higher season
//     (so "Foo Season 2 - 01" does not leak into a plain "Foo" search).
//     Bare unmarked results are fine.
export function resultMatchesSeason (title, showSeason) {
  const rs = detectResultSeason(title)
  if (showSeason > 1) return rs === showSeason
  return !rs || rs === 1
}

// Year detection, used to disambiguate franchise siblings released in
// different years. AniList often puts the year in the show's title itself
// ("Vampire Hunter D (2000)", "Hunter x Hunter (2011)"), and release filenames
// commonly include the year too ("Vampire.Hunter.D.1985.1080p..."). If the
// show's own titles carry a year, we require any result that ALSO carries a
// year to share it. Results with no year at all still pass (movie releases
// often omit year in the filename). Shows with no year get no year check at
// all, so this doesn't touch typical series matching.
const YEAR_RE = /(?:^|[\s._\[(\-])(19[3-9]\d|20\d{2})(?=[\s._\])\-]|$)/g

export function detectYears (text) {
  const s = String(text || '')
  const years = new Set()
  YEAR_RE.lastIndex = 0
  let m
  while ((m = YEAR_RE.exec(s)) !== null) years.add(m[1])
  return years
}

export function detectShowYears (titles) {
  const years = new Set()
  for (const t of titles || []) for (const y of detectYears(t)) years.add(y)
  return years
}

export function resultMatchesYear (title, showYears) {
  if (!showYears || !showYears.size) return true
  const rYears = detectYears(title)
  if (!rYears.size) return true
  for (const y of rYears) if (showYears.has(y)) return true
  return false
}

export function titleHasEpisode (title, ep) {
  if (ep == null) return true
  const n = String(ep).replace(/^0+/, '') || '0'
  const patterns = [
    new RegExp('\\b(?:e|ep|episode\\s*|s\\d{1,2}e)0*' + n + '\\b(?!\\d)', 'i'),
    new RegExp('[\\s._][-~]\\s+0*' + n + '(?:v\\d)?(?=[\\s\\[\\(]|$)', 'i'),
    new RegExp('[\\[\\(]0*' + n + '(?:v\\d)?[\\]\\)]', 'i')
  ]
  return patterns.some(re => re.test(title))
}

export function looksLikeBatch (title) {
  if (/\bs\d{1,2}e\d{1,3}\s*[-~]\s*(?:s\d{1,2})?e?\d{1,3}\b/i.test(title)) return true
  if (/\bs\d{1,2}e\d{1,3}\b/i.test(title)) return false
  if (/\s-\s*\d{1,4}(?:v\d)?\s*(?:\[|\(|$)/.test(title)) return false
  return BATCH_PATTERNS.some(re => re.test(title))
}

export function tagAccuracy (tier, dateMs, sourceDefault) {
  if (tier === 'A') return sourceDefault
  if (tier === 'B') return 'low'
  const days = (Date.now() - (dateMs || 0)) / 86400000
  if (days < 60) return sourceDefault
  if (days < 180) return 'medium'
  return 'low'
}

// Up to `limit` DISTINCT search strings for a show. Multiple AniList titles
// often trim to the same query (every Bleach variant becomes "bleach"), which
// used to fire the same request two or three times and waste the budget.
//
// When an episode is given, an episode-numbered query is appended. Feeds return
// only their most recent page, so an older episode is invisible to the plain
// title query; "frieren 08" is the only way to reach it. Results from it are
// tiered like any other, so a stale batch it drags in cannot outrank a real
// match.
export function buildQueries (titles, opts = {}) {
  const limit = opts.limit || 3
  const bases = []
  const seen = new Set()
  for (const title of rankTitlesForQuery(titles || [])) {
    const q = trimTitleForQuery(title)
    if (!q || seen.has(q)) continue
    seen.add(q)
    bases.push(q)
    if (bases.length >= limit) break
  }
  // Every base title also gets an episode-numbered form, not just the first:
  // groups name files after whichever title they prefer, so "meitantei conan
  // 1100" finds nothing while "detective conan 1100" finds the episode. These
  // are a second phase, not extra work up front, since a feed's recent page
  // already holds the current episode of an airing show.
  const numbered = opts.episode == null ? [] : bases.map(b => b + ' ' + pad(opts.episode))
  return { bases, numbered }
}

// Fetch in two phases, stopping the moment the episode is found.
//
// The numbered queries are a second phase that only runs when the plain titles
// did not turn up the episode, which for an airing show is never.
//
// Requests are sequential by default. Three sources read the same nyaa feed, so
// firing each source's queries at once turns into a burst several times that
// size, and nyaa answers with 429. It also gains nothing: nyaa serializes
// requests per IP, so six at once measured 2.4s to 2.9s each against 0.5s each
// in sequence. Sources on their own host pass parallel: true.
export async function collectFeed (queries, fetchItems, mapItem, ctx, sourceDefault, opts = {}) {
  const seen = new Set()
  const collected = []
  let shaped = []
  let lastError = null

  const absorb = items => {
    for (const raw of items) {
      const r = mapItem(raw)
      if (!r || seen.has(r.hash)) continue
      seen.add(r.hash)
      collected.push(r)
    }
    shaped = shapeAll(collected, ctx, sourceDefault)
  }
  const foundEpisode = () => shaped.some(r => r._tier === 'A')

  const phase = async (qs, stopWhenFound) => {
    if (opts.parallel) {
      const settled = await Promise.allSettled(qs.map(q => fetchItems(q)))
      const ok = []
      for (const s of settled) {
        if (s.status === 'rejected') lastError = s.reason
        else ok.push(s.value)
      }
      for (const items of ok) absorb(items)
      return
    }
    for (const q of qs) {
      try {
        absorb(await fetchItems(q))
      } catch (err) {
        lastError = err
        continue
      }
      if (stopWhenFound && foundEpisode()) return
    }
  }

  // Every base title is searched. Stopping at the first one that matched costs
  // real results: a show whose releases are split across two naming conventions
  // only shows the half that happened to be queried first. The numbered round
  // is different, it exists purely to reach an episode that fell off the feed,
  // so the first query that finds it ends the round.
  await phase(queries.bases, false)
  if (!collected.length && lastError) throw lastError
  if (queries.numbered.length && !foundEpisode()) await phase(queries.numbered, true)
  return shaped
}

const ANILIST_API = 'https://graphql.anilist.co'
const offsetCache = new Map()

// AniList splits long shows into one entry per cour while release groups keep
// numbering files continuously across the arc. "BLEACH: TYBW - The Calamity"
// ep 1 is ep 41 on nyaa. Walking the PREQUEL chain and accumulating episode
// counts recovers the offsets: 14 + 13 + 13 = 40, so 1 -> 41.
//
// The chain is followed past the arc boundary too (into the 366-episode 2004
// series), because different groups pick different roots. Every cumulative sum
// becomes a candidate, so whichever convention a group used still matches.
async function fetchPrequelChain (anilistId) {
  const seen = new Set()
  const counts = []
  let current = Number(anilistId)
  for (let depth = 0; depth < 12 && current && !seen.has(current); depth++) {
    seen.add(current)
    const body = JSON.stringify({
      query: 'query($id:Int){Media(id:$id){episodes format relations{edges{relationType node{id episodes format}}}}}',
      variables: { id: current }
    })
    let media
    try {
      const res = await fetch(ANILIST_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body
      })
      if (!res.ok) break
      media = (await res.json())?.data?.Media
    } catch {
      break
    }
    if (!media) break
    const prequel = (media.relations?.edges || [])
      .filter(e => e.relationType === 'PREQUEL')
      .map(e => e.node)
      .filter(n => n && (n.format === 'TV' || n.format === 'ONA' || n.format === 'TV_SHORT'))
      .sort((a, b) => (b.episodes || 0) - (a.episodes || 0))[0]
    if (!prequel || !prequel.episodes) break
    counts.push(prequel.episodes)
    current = prequel.id
  }
  return counts
}

export async function resolveEpisodeCandidates (query) {
  const ep = Number(query.episode)
  if (!Number.isInteger(ep) || !query.anilistId) return null
  const key = String(query.anilistId)
  if (!offsetCache.has(key)) {
    offsetCache.set(key, fetchPrequelChain(query.anilistId).catch(() => []))
  }
  const counts = await offsetCache.get(key)
  const candidates = new Set([ep])
  let running = 0
  for (const c of counts || []) {
    running += c
    // A cour is never shorter than this. Ignoring tiny offsets keeps a stray
    // one-episode special from making ep N also match ep N+1, which would let
    // next week's release masquerade as this week's on an airing show.
    if (running >= 10) candidates.add(ep + running)
  }
  return candidates
}

export function searchContext (query, mode) {
  const titles = query.titles || []
  // Threshold comes from the canonical title alone. Taking it from the union of
  // every synonym let foreign ones inflate the count: "One Piece" gained tokens
  // from its Vietnamese and Italian names, demanding two hits from a title that
  // only ever contains one, so no real release could match.
  const primary = rankTitlesForQuery(titles)[0]
  const primaryTokens = primary ? buildTitleTokens([primary]) : new Set()
  return {
    mode,
    showTokens: buildTitleTokens(titles),
    showSeason: detectShowSeason(titles),
    showYears: detectShowYears(titles),
    minHits: primaryTokens.size >= 3 ? 2 : 1,
    episode: query.episode,
    episodeCandidates: query.episodeCandidates || null,
    exclusions: query.exclusions || [],
    resolution: query.resolution || ''
  }
}

// Tier + age-tag a raw result. Returns null when it is not this show.
export function shapeResult (r, ctx, sourceDefault) {
  const tier = classifyResult(r.title, ctx)
  if (tier === null) return null
  const out = { ...r, _tier: tier, accuracy: tagAccuracy(tier, r.date?.getTime?.(), sourceDefault) }
  if (tier === 'B') out.type = 'batch'
  return out
}

// Shape every result under both numbering schemes and keep the better one.
//
// A per-cour entry has two plausible readings of "episode 1": the literal one,
// and ep 41 of the continuous arc. Both usually find something, since an older
// cour also has an "01" file, so presence alone cannot decide. Recency can: the
// episode the user is asking for is the one that was just uploaded, while the
// rival reading only turns up a years-old file from a finished cour.
export function shapeAll (items, ctx, sourceDefault) {
  const shape = c => {
    const out = []
    for (const r of items) {
      const s = shapeResult(r, c, sourceDefault)
      if (s) out.push(s)
    }
    return out
  }
  const exact = shape({ ...ctx, episodeCandidates: null })
  if (ctx.episode != null) ctx.chosenEpisodes = new Set([ctx.episode])
  if (!ctx.episodeCandidates || ctx.episodeCandidates.size <= 1) return exact

  // Only one candidate can be right. Each cour boundary in the chain produces
  // one, so The Calamity ep 1 could read as 1, 15, 28, 41 or 407, and accepting
  // all of them let a two-year-old ep 28 sit beside today's ep 41. Score each
  // on its own and keep the single freshest: the episode being asked for is the
  // one that was just uploaded.
  let best = null
  for (const n of ctx.episodeCandidates) {
    const shaped = shape({ ...ctx, episodeCandidates: new Set([n]) })
    const newest = newestOf(shaped)
    if (newest == null) continue
    if (!best || newest > best.newest) best = { newest, shaped, episode: n }
  }
  if (!best) return exact
  ctx.chosenEpisodes = new Set([best.episode])
  return best.shaped
}

function newestOf (results) {
  let newest = null
  for (const r of results) {
    if (r._tier !== 'A') continue
    const t = r.date?.getTime?.() || 0
    if (newest == null || t > newest) newest = t
  }
  return newest
}

// Newest first. Exact-episode matches lead only when some exist, so per-cour
// entries (where no filename maps to the AniList episode number) still put the
// freshest upload on top instead of a years-old batch.
export function sortResults (results, resolution) {
  const hasExact = results.some(r => r._tier === 'A')
  return results.sort((a, b) => {
    if (hasExact && a._tier !== b._tier) return a._tier < b._tier ? -1 : 1
    const dt = (b.date?.getTime?.() || 0) - (a.date?.getTime?.() || 0)
    if (dt !== 0) return dt
    if (resolution) {
      const am = matchesResolution(a.title, resolution) ? 1 : 0
      const bm = matchesResolution(b.title, resolution) ? 1 : 0
      if (am !== bm) return bm - am
    }
    return (b.seeders || 0) - (a.seeders || 0)
  })
}

// Episode numbers a filename states outright, as [from, to] pairs so a range
// covers everything inside it. Only high-confidence forms are read: a title
// with no recognizable marker yields nothing and is never treated as wrong.
export function titleEpisodeMarkers (title) {
  const out = []
  const push = (a, b) => {
    const lo = parseInt(a, 10)
    const hi = b == null ? lo : parseInt(b, 10)
    if (Number.isInteger(lo)) out.push([lo, Number.isInteger(hi) ? hi : lo])
  }
  let m
  const se = /\bs\d{1,2}e(\d{1,4})(?:\s*[-~]\s*(?:s\d{1,2})?e(\d{1,4}))?\b/gi
  while ((m = se.exec(title)) !== null) push(m[1], m[2])
  const ep = /\bep(?:isode)?\.?\s*(\d{1,4})\b/gi
  while ((m = ep.exec(title)) !== null) push(m[1], null)
  const dash = /[\s._]-\s*(\d{1,4})(?:v\d)?\s*(?=[[(]|$)/g
  while ((m = dash.exec(title)) !== null) push(m[1], null)
  const range = /\b(\d{1,4})\s*[-~]\s*(\d{1,4})\b/g
  while ((m = range.exec(title)) !== null) {
    const a = parseInt(m[1], 10)
    const b = parseInt(m[2], 10)
    if (b > a && b - a < 400) push(m[1], m[2])
  }
  return out
}

// True when the filename names an episode and none of them is the one wanted.
// A dub source sitting on ep 2 while ep 4 is being asked for is not a weaker
// match for ep 4, it is a different episode, and Hayase merges every source
// into one list where it would sit beside the real thing.
export function hasConflictingEpisode (title, wanted) {
  if (!wanted || !wanted.size) return false
  const markers = titleEpisodeMarkers(title)
  if (!markers.length) return false
  for (const [lo, hi] of markers) {
    for (const w of wanted) if (w >= lo && w <= hi) return false
  }
  return true
}

// Title-only matches are dropped once a real episode match exists: they are
// other episodes of the same show, which is noise when a specific one was
// asked for.
//
// When nothing matched, what is left is a guess, so it is capped at low
// accuracy: another source that did find the episode has to outrank it in the
// merged picker. Guesses that name a different episode outright are dropped
// outright. Ones with no episode in the name (packs, movies, unlabelled rips)
// stay, which is what keeps the picker from going empty.
export function finalize (results, ctx, limit = 30) {
  const resolution = typeof ctx === 'string' ? ctx : (ctx && ctx.resolution) || ''
  const hasExact = results.some(r => r._tier === 'A')
  let kept
  if (hasExact) {
    kept = results.filter(r => r._tier !== 'C')
  } else {
    const wanted = typeof ctx === 'string' ? null : wantedEpisodes(ctx)
    kept = results
      .filter(r => !hasConflictingEpisode(r.title, wanted))
      .map(r => ({ ...r, accuracy: 'low' }))
  }
  return sortResults(kept, resolution).slice(0, limit).map(({ _tier, ...rest }) => rest)
}

function wantedEpisodes (ctx) {
  if (!ctx || ctx.mode !== 'single' || ctx.episode == null) return null
  return ctx.chosenEpisodes || new Set([ctx.episode])
}

// Attach absolute-numbering candidates so per-cour entries match the filenames
// release groups actually use. Never throws: a failed lookup leaves the query
// untouched and matching falls back to the AniList episode number alone.
export async function withEpisodeCandidates (query) {
  try {
    const episodeCandidates = await resolveEpisodeCandidates(query)
    if (!episodeCandidates || episodeCandidates.size <= 1) return query
    return { ...query, episodeCandidates }
  } catch {
    return query
  }
}

// Common English words that are too broad to be a useful standalone search
// query (a synonym like "Monster #8" or romaji that strips to "Level" would
// otherwise drag in every unrelated show containing the word). Only used to
// DEMOTE such a title when the show has a better one; if it is the only title,
// it is still used. Distinct from STOPWORDS (which are dropped from matching).
export const GENERIC_QUERY_WORDS = new Set([
  'monster', 'level', 'hero', 'world', 'girl', 'boy', 'demon', 'devil',
  'dragon', 'angel', 'king', 'queen', 'story', 'magic', 'school', 'love',
  'life', 'club', 'sword', 'blood', 'dark', 'light', 'night', 'master',
  'star', 'moon', 'witch', 'ghost', 'dead', 'zombie', 'idol', 'club'
])

export function trimTitleForQuery (title) {
  const colon = title.indexOf(':')
  const base = colon > 0 ? title.slice(0, colon) : title
  return significantTokens(base).slice(0, 4).join(' ') || escapeQuery(title)
}

export function rankTitlesForQuery (titles) {
  const list = (titles || [])
    .map((t, i) => {
      const stripped = String(t).replace(/\s/g, '')
      const ascii = escapeQuery(t).replace(/\s/g, '')
      const queryToks = trimTitleForQuery(t).split(/\s+/).filter(Boolean)
      return {
        t,
        i,
        tokens: significantTokens(t).length,
        // A query is "degenerate" when it collapses to a single word that is
        // too generic to search: very short ("Orb: ..." -> "orb") or a common
        // word ("Ore dake Level Up na Ken" -> "level", "Monster #8" -> "monster").
        // A specific single token ("bakemonogatari", "noragami", "kaiju") is
        // fine. Degenerate titles get demoted so a better title is queried first.
        degenerate: queryToks.length <= 1 &&
          ((queryToks[0] || '').length < 4 || GENERIC_QUERY_WORDS.has(queryToks[0])),
        asciiRatio: stripped.length ? ascii.length / stripped.length : 0
      }
    })
    .filter(x => x.tokens > 0)

  // Prefer mostly-Latin titles (romaji / english) over heavily transliterated
  // foreign synonyms; fall back to all titles if every one is foreign so the
  // show still searches something (never return zero -> Witch Hat bug).
  const latin = list.filter(x => x.asciiRatio >= 0.5)
  const pool = latin.length ? latin : list

  // Then KEEP THE ORIGINAL ORDER. AniList and Hayase provide the canonical
  // romaji and english titles first and the foreign synonyms / acronyms /
  // descriptive translations ("HxH", "Monster #8", "Stray God", "Atelier
  // spiczastych kapeluszy") last, and the canonical titles are what release
  // groups actually name files after. Reordering by token length or "cleverer"
  // heuristics is what promoted foreign synonyms to the top and made shows like
  // Witch Hat Atelier search a Polish title and return nothing. The only
  // reordering is pushing degenerate single-word queries to the back.
  return pool
    .sort((a, b) => (a.degenerate - b.degenerate) || (a.i - b.i))
    .map(x => x.t)
}

export function pad (n) {
  const s = String(n)
  return s.length < 2 ? '0' + s : s
}

// Tier a token-matched result for picker ordering. Mirrors the way nyaa's own
// search behaves (date-desc within relevance tiers) so per-cour AniList entries
// like BLEACH: The Calamity surface today's E41 uploads at the top instead of
// being buried under 2-year-old batches whose range happens to contain "01".
//
// Returns null if the result should not appear at all (token or exclusion fail).
// Returns 'A' | 'B' | 'C' where A ranks first:
//   A = passes season+year AND (single-episode match | movie mode | batch mode)
//   B = passes season+year but is a batch containing the requested ep in single mode
//   C = token-only match (season/year/episode mismatch) - fallback
export function classifyResult (title, opts) {
  const showTokens = opts.showTokens
  const minHits = opts.minHits != null ? opts.minHits : (showTokens && showTokens.size >= 3 ? 2 : 1)
  if (!resultMatchesShow(title, showTokens, minHits)) return null
  const seasonOk = resultMatchesSeason(title, opts.showSeason)
  const yearOk = resultMatchesYear(title, opts.showYears)
  const isBatch = looksLikeBatch(title)
  if (opts.mode === 'batch') {
    return (seasonOk && yearOk && isBatch) ? 'A' : 'C'
  }
  if (opts.mode === 'movie') {
    return (seasonOk && yearOk) ? 'A' : 'C'
  }
  const epOk = opts.episode == null || matchesAnyEpisode(title, opts)
  if (seasonOk && yearOk && epOk) {
    return isBatch ? 'B' : 'A'
  }
  return 'C'
}

function matchesAnyEpisode (title, opts) {
  const candidates = opts.episodeCandidates
  if (candidates && candidates.size) {
    for (const n of candidates) if (titleHasEpisode(title, n)) return true
    return false
  }
  return titleHasEpisode(title, opts.episode)
}

export function matchesResolution (title, resolution) {
  if (!resolution) return true
  return title.includes(resolution + 'p') || title.includes(resolution)
}

export function hitsExclusion (title, exclusions) {
  if (!exclusions || !exclusions.length) return false
  const lower = title.toLowerCase()
  return exclusions.some(kw => kw && lower.includes(String(kw).toLowerCase()))
}

export function buildMagnet (hash, name) {
  const trackers = TRACKERS.map(t => 'tr=' + encodeURIComponent(t)).join('&')
  const dn = name ? '&dn=' + encodeURIComponent(name) : ''
  return 'magnet:?xt=urn:btih:' + String(hash).toLowerCase() + dn + '&' + trackers
}

export function parseSize (text) {
  if (!text) return 0
  const m = text.match(/([\d.]+)\s*(KiB|MiB|GiB|TiB|KB|MB|GB|TB|B)/i)
  if (!m) return 0
  const value = parseFloat(m[1])
  const unit = m[2].toLowerCase()
  const mult = {
    b: 1,
    kib: 1024, kb: 1000,
    mib: 1024 ** 2, mb: 1000 ** 2,
    gib: 1024 ** 3, gb: 1000 ** 3,
    tib: 1024 ** 4, tb: 1000 ** 4
  }[unit] || 1
  return Math.round(value * mult)
}

export function pickTag (xml, tag) {
  const open = '<' + tag + '>'
  const close = '</' + tag + '>'
  const i = xml.indexOf(open)
  if (i === -1) return ''
  const j = xml.indexOf(close, i + open.length)
  if (j === -1) return ''
  let val = xml.slice(i + open.length, j)
  if (val.startsWith('<![CDATA[') && val.endsWith(']]>')) {
    val = val.slice(9, -3)
  }
  return val.trim()
}

export function pickItems (xml) {
  const out = []
  let cursor = 0
  while (true) {
    const start = xml.indexOf('<item>', cursor)
    if (start === -1) break
    const end = xml.indexOf('</item>', start)
    if (end === -1) break
    out.push(xml.slice(start + 6, end))
    cursor = end + 7
  }
  return out
}
