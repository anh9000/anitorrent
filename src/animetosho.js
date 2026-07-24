import {
  buildTitleTokens, resultMatchesShow, titleHasEpisode, looksLikeBatch,
  trimTitleForQuery, rankTitlesForQuery, matchesResolution, hitsExclusion,
  detectShowSeason, resultMatchesSeason, detectShowYears, resultMatchesYear
} from './lib/shared.js'

const BASE = 'https://feed.animetosho.org/json'
const MAPPING_URL = 'https://raw.githubusercontent.com/anh9000/anitorrent/main/data/anilist-to-anidb.json'

let mappingCache = null
let mappingPromise = null

function validId (v) {
  const n = Number(v)
  return Number.isInteger(n) && n > 0
}

async function getMapping () {
  if (mappingCache) return mappingCache
  if (!mappingPromise) {
    mappingPromise = (async () => {
      try {
        const r = await fetch(MAPPING_URL)
        if (!r.ok) return {}
        const data = await r.json()
        mappingCache = data && typeof data === 'object' ? data : {}
        return mappingCache
      } catch {
        return {}
      }
    })()
  }
  return mappingPromise
}

async function resolveAnidbAid (query) {
  if (validId(query.anidbAid)) return Number(query.anidbAid)
  if (!validId(query.anilistId)) return null
  const map = await getMapping()
  const aid = map[String(query.anilistId)]
  return validId(aid) ? Number(aid) : null
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

async function fetchByAid (aid) {
  const items = await tryFetch(BASE + '?aid=' + encodeURIComponent(aid))
  return items.map(i => toResult(i, 'high')).filter(Boolean)
}

async function fetchByText (titles) {
  const seen = new Map()
  const ordered = rankTitlesForQuery(titles).slice(0, 3)
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

function filterAndShape (raw, query, mode, showTokens, exclusions, minHits, showSeason, showYears) {
  let out = dedupe(raw)
    .filter(r => !hitsExclusion(r.title, exclusions))
    .filter(r => resultMatchesShow(r.title, showTokens, minHits))
    .filter(r => resultMatchesSeason(r.title, showSeason))
    .filter(r => resultMatchesYear(r.title, showYears))

  if (mode === 'single' && query.episode != null) {
    out = out.filter(r => titleHasEpisode(r.title, query.episode))
  }

  if (mode === 'batch') {
    out = out
      .filter(r => looksLikeBatch(r.title))
      .map(r => ({ ...r, type: 'batch', accuracy: 'low' }))
  }

  return out
}

async function search (query, mode) {
  if (!query) return []

  const exclusions = query.exclusions || []
  const resolution = query.resolution || ''
  const showTokens = buildTitleTokens(query.titles || [])
  const showSeason = detectShowSeason(query.titles || [])
  const showYears = detectShowYears(query.titles || [])
  const minHits = showTokens.size >= 3 ? 2 : 1
  const resolvedAid = await resolveAnidbAid(query)

  let raw = []

  if (mode === 'single' && validId(query.anidbEid)) {
    try { raw = await fetchByEid(query.anidbEid) } catch (_) { raw = [] }
  } else if (resolvedAid) {
    try { raw = await fetchByAid(resolvedAid) } catch (_) { raw = [] }
  }

  let results = filterAndShape(raw, query, mode, showTokens, exclusions, minHits, showSeason, showYears)

  if (!results.length && (query.titles || []).length) {
    const textRaw = await fetchByText(query.titles)
    results = filterAndShape(textRaw, query, mode, showTokens, exclusions, minHits, showSeason, showYears)
  }

  return rank(results, resolution).slice(0, 30)
}

export default new class AnimeTosho {
  async single (query) {
    if (query.episodeCount === 1) return search(query, 'movie')
    return search(query, 'single')
  }
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
