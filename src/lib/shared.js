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
  'naru', 'nani', 'desu', 'dake', 'made', 'demo', 'inai', 'koi', 'ken', 'shi'
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
  if (/\bs\d{1,2}e\d{1,3}\b/i.test(title)) return false
  if (/\s-\s*\d{1,4}(?:v\d)?\s*(?:\[|\(|$)/.test(title)) return false
  return BATCH_PATTERNS.some(re => re.test(title))
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
