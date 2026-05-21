// Shared matching, query, and torrent helpers used by every source.
// Single source of truth: fix matching logic here once, all sources inherit it.

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

export function trimTitleForQuery (title) {
  const colon = title.indexOf(':')
  const base = colon > 0 ? title.slice(0, colon) : title
  return significantTokens(base).slice(0, 4).join(' ') || escapeQuery(title)
}

export function rankTitlesForQuery (titles) {
  const list = (titles || [])
    .map(t => {
      const stripped = String(t).replace(/\s/g, '')
      const ascii = escapeQuery(t).replace(/\s/g, '')
      const toks = significantTokens(t)
      const maxTok = toks.reduce((m, s) => Math.max(m, s.length), 0)
      return {
        t,
        tokens: toks.length,
        maxTok,
        signature: maxTok >= 4 ? toks.find(s => s.length === maxTok) : '',
        despaced: escapeQuery(t).toLowerCase().replace(/\s/g, ''),
        asciiRatio: stripped.length ? ascii.length / stripped.length : 0
      }
    })
    .filter(x => x.tokens > 0)

  // Cross-title recurrence: how many of the show's OTHER titles contain this
  // title's signature (longest) token, as a substring so it survives spacing
  // and romanization differences (kaiju in kaijuu in 8kaijuu, monogatari in
  // bakemonogatari). A canonical name's signature recurs across romaji /
  // english / transliterations; a one-off descriptive synonym ("Monster #8",
  // "Monster Tale", "Stray God", "Tiger X Dragon", "HxH") matches nothing else.
  // That recurrence is what reliably separates the real title from loose
  // synonyms, which when chosen as the search query drag in unrelated shows
  // that then slip past token matching. Picking by longest token alone fails
  // ("Monster #8" has a longer token than "Kaiju No. 8" yet is the wrong query).
  for (const x of list) {
    x.recur = x.signature
      ? list.reduce((n, y) => {
        if (y === x || !y.signature) return n
        // bidirectional: relate if either signature contains the other, so the
        // pair is credited symmetrically and the maxTok tiebreaker then picks
        // the longer, more specific name (bakemonogatari over monogatari).
        const related = y.despaced.includes(x.signature) || x.despaced.includes(y.signature)
        return n + (related ? 1 : 0)
      }, 0)
      : 0
  }

  // Prefer mostly-Latin titles (romaji/english) over heavily transliterated
  // foreign synonyms. If every title is foreign, keep them all as a fallback so
  // the show still searches something (never return zero -> Witch Hat bug).
  const latin = list.filter(x => x.asciiRatio >= 0.5)
  const pool = latin.length ? latin : list
  // Recurrence is a boolean GATE, not a weighted count: counting biases toward
  // short generic tokens ("level", "monster") because a shorter token is a
  // substring of more titles, which is exactly the wrong title to query. So we
  // only ask "does this title's signature recur at all", then pick the LONGEST
  // signature among those that do (bakemonogatari over monogatari, solo
  // leveling over the bare "level" of "Ore dake Level Up na Ken"). Shows whose
  // titles share nothing (Noragami, Toradora) have no recurrence and fall back
  // to longest-token, which is still the canonical name over a short synonym.
  return pool
    .sort((a, b) =>
      ((b.recur > 0) - (a.recur > 0)) ||
      (b.maxTok - a.maxTok) ||
      (b.tokens - a.tokens) ||
      (b.asciiRatio - a.asciiRatio))
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
