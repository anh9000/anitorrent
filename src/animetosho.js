const BASE = 'https://feed.animetosho.org/json'

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'this', 'that', 'her', 'his',
  'are', 'was', 'were', 'has', 'have', 'had', 'who', 'what', 'when',
  'where', 'why', 'how', 'all', 'any', 'one', 'two', 'season',
  'episode', 'part', 'arc', 'movie', 'film', 'ova', 'special'
])

function pad (n) {
  const s = String(n)
  return s.length < 2 ? '0' + s : s
}

function escapeQuery (str) {
  return String(str || '').replace(/[^\w\s\-.]/g, ' ').replace(/\s+/g, ' ').trim()
}

function significantTokens (title) {
  return escapeQuery(title)
    .toLowerCase()
    .split(/\s+/)
    .filter(t => t.length >= 3 && !STOPWORDS.has(t))
}

function trimTitleForQuery (title) {
  const colon = title.indexOf(':')
  const base = colon > 0 ? title.slice(0, colon) : title
  return significantTokens(base).slice(0, 4).join(' ') || escapeQuery(title)
}

function buildTitleTokens (titles) {
  const tokens = new Set()
  for (const t of titles) {
    for (const tok of significantTokens(t)) tokens.add(tok)
  }
  return tokens
}

function resultMatchesShow (title, tokens, minHits = 1) {
  if (!tokens.size) return true
  const lower = title.toLowerCase()
  let hits = 0
  for (const tok of tokens) {
    if (lower.includes(tok)) {
      hits++
      if (hits >= minHits) return true
    }
  }
  return false
}

function validId (v) {
  const n = Number(v)
  return Number.isInteger(n) && n > 0
}

function titleHasEpisode (title, ep) {
  if (ep == null) return true
  const n = String(ep).replace(/^0+/, '') || '0'
  const re = new RegExp(
    '(?:^|[\\s\\-_.\\[\\(])' +
    '(?:e|ep|episode\\s*|s\\d{1,2}e)?' +
    '0*' + n +
    '(?:v\\d)?' +
    '(?:[\\s\\-_.\\]\\)]|$)',
    'i'
  )
  return re.test(title)
}

function hitsExclusion (title, exclusions) {
  if (!exclusions || !exclusions.length) return false
  const lower = title.toLowerCase()
  return exclusions.some(kw => kw && lower.includes(String(kw).toLowerCase()))
}

function matchesResolution (title, resolution) {
  if (!resolution) return true
  return title.includes(resolution + 'p') || title.includes(resolution)
}

async function tryFetch (url) {
  let res
  try {
    res = await fetch(url)
  } catch (err) {
    throw new Error('Cannot reach AnimeTosho. Check your internet connection or try again later.')
  }
  if (!res.ok) {
    throw new Error('AnimeTosho returned HTTP ' + res.status + '. The site may be down or rate limiting your IP.')
  }
  let data
  try {
    data = await res.json()
  } catch (err) {
    throw new Error('AnimeTosho returned an unexpected response. The API may have changed.')
  }
  if (!Array.isArray(data)) return []
  return data
}

function toResult (item, accuracy) {
  const hash = String(item.info_hash || '').toLowerCase()
  if (!hash) return null
  return {
    title: item.title || item.torrent_name || '',
    link: item.magnet_uri || hash,
    hash,
    seeders: Number(item.seeders) || 0,
    leechers: Number(item.leechers) || 0,
    downloads: Number(item.torrent_downloaded_count) || 0,
    size: Number(item.total_size) || 0,
    date: item.timestamp ? new Date(item.timestamp * 1000) : new Date(),
    accuracy
  }
}

function rank (results, resolution) {
  return results.sort((a, b) => {
    if (resolution) {
      const am = matchesResolution(a.title, resolution) ? 1 : 0
      const bm = matchesResolution(b.title, resolution) ? 1 : 0
      if (am !== bm) return bm - am
    }
    const dt = (b.date?.getTime?.() || 0) - (a.date?.getTime?.() || 0)
    if (dt !== 0) return dt
    return b.seeders - a.seeders
  })
}

function dedupe (items) {
  const seen = new Set()
  const out = []
  for (const r of items) {
    if (!r || seen.has(r.hash)) continue
    seen.add(r.hash)
    out.push(r)
  }
  return out
}

async function fetchByEid (eid) {
  const items = await tryFetch(BASE + '?eid=' + encodeURIComponent(eid))
  return items.map(i => toResult(i, 'high')).filter(Boolean)
}

async function fetchByShow (aid, type) {
  const items = await tryFetch(BASE + '?show=' + encodeURIComponent(aid) + '&type=' + encodeURIComponent(type))
  return items.map(i => toResult(i, 'high')).filter(Boolean)
}

async function fetchByText (titles) {
  const seen = new Map()
  const ordered = [...titles].sort((a, b) => a.length - b.length).slice(0, 3)
  for (const title of ordered) {
    const q = trimTitleForQuery(title)
    if (!q) continue
    let items
    try {
      items = await tryFetch(BASE + '?q=' + encodeURIComponent(q))
    } catch (err) {
      if (seen.size) break
      throw err
    }
    for (const i of items) {
      const r = toResult(i, 'medium')
      if (r && !seen.has(r.hash)) seen.set(r.hash, r)
    }
    if (seen.size >= 30) break
  }
  return [...seen.values()]
}

async function search (query, mode) {
  if (!query) return []

  const exclusions = query.exclusions || []
  const resolution = query.resolution || ''
  const showTokens = buildTitleTokens(query.titles || [])

  let results = []

  if (mode === 'single' && validId(query.anidbEid)) {
    try { results = await fetchByEid(query.anidbEid) } catch (_) { results = [] }
  } else if (mode === 'batch' && validId(query.anidbAid)) {
    try { results = await fetchByShow(query.anidbAid, 'batches') } catch (_) { results = [] }
  } else if (mode === 'movie' && validId(query.anidbAid)) {
    try { results = await fetchByShow(query.anidbAid, 'movies') } catch (_) { results = [] }
  }

  if (!results.length && (query.titles || []).length) {
    results = await fetchByText(query.titles)
  }

  const minHits = showTokens.size >= 3 ? 2 : 1

  results = dedupe(results)
    .filter(r => !hitsExclusion(r.title, exclusions))
    .filter(r => resultMatchesShow(r.title, showTokens, minHits))

  if (mode === 'single' && query.episode != null) {
    results = results.filter(r => titleHasEpisode(r.title, query.episode))
  }

  return rank(results, resolution).slice(0, 30)
}

export default new class AnimeTosho {
  async single (query) { return search(query, 'single') }
  async batch (query) { return search(query, 'batch') }
  async movie (query) { return search(query, 'movie') }

  async test () {
    let res
    try {
      res = await fetch(BASE + '?q=test')
    } catch (err) {
      throw new Error('Cannot reach AnimeTosho. Check your internet connection or try again later.')
    }
    if (!res.ok) {
      throw new Error('AnimeTosho returned HTTP ' + res.status + '. The site may be down.')
    }
    return true
  }
}()
