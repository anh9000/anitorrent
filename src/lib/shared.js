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
  'episode', 'part', 'arc', 'movie', 'film', 'ova', 'special'
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
  const all = new Set()
  for (const t of titles || []) {
    for (const tok of significantTokens(t)) all.add(tok)
  }
  const arr = [...all]
  return new Set(arr.filter(tok => !arr.some(other => other !== tok && other.includes(tok))))
}

export function tokenInTitle (tok, lower) {
  return new RegExp('\\b' + tok + '\\b').test(lower)
}

export function resultMatchesShow (title, tokens, minHits = 1) {
  if (!tokens.size) return true
  const lower = String(title).toLowerCase()
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
  return (titles || [])
    .map(t => {
      const stripped = String(t).replace(/\s/g, '')
      const ascii = escapeQuery(t).replace(/\s/g, '')
      return {
        t,
        tokens: significantTokens(t).length,
        asciiRatio: stripped.length ? ascii.length / stripped.length : 0
      }
    })
    .filter(x => x.tokens > 0)
    .sort((a, b) => (b.asciiRatio - a.asciiRatio) || (b.tokens - a.tokens))
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
