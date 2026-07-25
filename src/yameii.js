import {
  buildTitleTokens, looksLikeBatch,
  trimTitleForQuery, rankTitlesForQuery, matchesResolution,
  hitsExclusion, buildMagnet, parseSize, pickTag, pickItems, httpGet, checkNyaaFeed,
  detectShowSeason, detectShowYears, classifyResult
} from './lib/shared.js'

const NYAA_BASE = 'https://nyaa.si'
const UPLOADER = 'Yameii'
const ANIME_CATEGORY = '1_2'

async function rssSearch (query) {
  const qs = '?u=' + encodeURIComponent(UPLOADER) +
    '&page=rss' +
    (query ? '&q=' + encodeURIComponent(query) : '') +
    '&c=' + ANIME_CATEGORY +
    '&s=id&o=desc'
  const url = NYAA_BASE + '/' + qs
  let res
  try {
    res = await httpGet(url)
  } catch (err) {
    throw new Error('Cannot reach nyaa.si. Check your internet connection or try again later.')
  }
  if (res.status === 429) {
    const err = new Error('429')
    err.rateLimited = true
    throw err
  }
  if (!res.ok) {
    throw new Error('Nyaa returned HTTP ' + res.status + ' for the Yameii feed. The site may be down or blocked on your network.')
  }
  const text = await res.text()
  if (!text.includes('<rss') && !text.includes('<item>')) {
    throw new Error('Nyaa returned an unexpected response for the Yameii feed.')
  }
  return pickItems(text)
}

async function rssSearchWithRetry (query) {
  try {
    return await rssSearch(query)
  } catch (err) {
    if (err.rateLimited) {
      await new Promise(r => setTimeout(r, 1500))
      try {
        return await rssSearch(query)
      } catch (retryErr) {
        if (retryErr.rateLimited) {
          throw new Error('Nyaa is rate limiting requests for the Yameii feed. Wait a moment and try again.')
        }
        throw retryErr
      }
    }
    throw err
  }
}

function itemToResult (raw, opts) {
  const title = pickTag(raw, 'title')
  const hash = pickTag(raw, 'nyaa:infoHash').toLowerCase()
  if (!title || !hash) return null

  if (hitsExclusion(title, opts.exclusions)) return null

  const seeders = parseInt(pickTag(raw, 'nyaa:seeders'), 10) || 0
  const leechers = parseInt(pickTag(raw, 'nyaa:leechers'), 10) || 0
  const downloads = parseInt(pickTag(raw, 'nyaa:downloads'), 10) || 0
  const size = parseSize(pickTag(raw, 'nyaa:size'))
  const pubDate = pickTag(raw, 'pubDate')
  const date = pubDate ? new Date(pubDate) : new Date()

  return {
    title,
    link: buildMagnet(hash, title),
    hash,
    seeders,
    leechers,
    downloads,
    size,
    date,
    accuracy: 'high'
  }
}

function sortResults (results, resolution) {
  const hasA = results.some(r => r._tier === 'A')
  return results.sort((a, b) => {
    if (hasA && a._tier !== b._tier) return a._tier < b._tier ? -1 : 1
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

async function runSearch (query, opts) {
  if (!query.titles || !query.titles.length) return []

  const exclusions = query.exclusions || []
  const resolution = query.resolution || ''
  const showTokens = buildTitleTokens(query.titles)
  const showSeason = detectShowSeason(query.titles)
  const showYears = detectShowYears(query.titles)
  const mode = opts.batch ? 'batch' : (opts.movie ? 'movie' : 'single')
  const seen = new Set()
  const results = []

  const queries = []
  const seenQueries = new Set()
  for (const title of rankTitlesForQuery(query.titles)) {
    const q = trimTitleForQuery(title)
    if (!q || seenQueries.has(q)) continue
    seenQueries.add(q)
    queries.push(q)
    if (queries.length >= 3) break
  }

  for (const q of queries) {
    let items
    try {
      items = await rssSearchWithRetry(q)
    } catch (err) {
      if (results.length) break
      throw err
    }
    for (const raw of items) {
      const r = itemToResult(raw, { exclusions })
      if (!r || seen.has(r.hash)) continue
      const tier = classifyResult(r.title, { showTokens, showSeason, showYears, episode: opts.episode, mode })
      if (tier === null) continue
      seen.add(r.hash)
      const item = { ...r, _tier: tier }
      if (tier !== 'A') item.accuracy = 'low'
      if (tier === 'B') item.type = 'batch'
      results.push(item)
    }
    if (results.filter(r => r._tier === 'A').length >= 10) break
  }

  return sortResults(results, resolution).slice(0, 30).map(({ _tier, ...rest }) => rest)
}

export default new class Yameii {
  async single (query) {
    if (query.episodeCount === 1) return runSearch(query, { movie: true })
    return runSearch(query, { episode: query.episode })
  }

  async batch (query) {
    const results = await runSearch(query, { batch: true })
    return results
      .filter(r => looksLikeBatch(r.title))
      .map(r => ({ ...r, type: 'batch', accuracy: 'low' }))
  }

  async movie (query) {
    return runSearch(query, { movie: true })
  }

  async test () {
    return checkNyaaFeed(NYAA_BASE + '/?u=' + encodeURIComponent(UPLOADER) + '&page=rss&c=' + ANIME_CATEGORY)
  }
}()
