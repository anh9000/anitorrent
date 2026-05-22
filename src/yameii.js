import {
  buildTitleTokens, resultMatchesShow, titleHasEpisode, looksLikeBatch,
  trimTitleForQuery, rankTitlesForQuery, matchesResolution,
  hitsExclusion, buildMagnet, parseSize, pickTag, pickItems, httpGet
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

function rankResults (results, resolution) {
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

function queryVariantsForTitle (title) {
  const base = trimTitleForQuery(title)
  if (!base) return []
  return [base]
}

async function runSearch (query, opts) {
  if (!query.titles || !query.titles.length) return []

  const exclusions = query.exclusions || []
  const resolution = query.resolution || ''
  const showTokens = buildTitleTokens(query.titles)
  const seen = new Set()
  const results = []

  const titles = rankTitlesForQuery(query.titles).slice(0, 2)
  for (const title of titles) {
    const variants = queryVariantsForTitle(title)
    for (const q of variants) {
      let items
      try {
        items = await rssSearchWithRetry(q)
      } catch (err) {
        if (results.length) return rankResults(results, resolution).slice(0, 30)
        throw err
      }
      for (const raw of items) {
        const r = itemToResult(raw, { exclusions })
        if (!r) continue
        if (seen.has(r.hash)) continue
        if (!resultMatchesShow(r.title, showTokens)) continue
        if (opts.episode != null && !opts.batch && !opts.movie && !titleHasEpisode(r.title, opts.episode)) continue
        seen.add(r.hash)
        results.push(r)
      }
    }
    if (results.length >= 10) break
  }

  return rankResults(results, resolution).slice(0, 30)
}

export default new class Yameii {
  async single (query) {
    return runSearch(query, { episode: query.episode })
  }

  async batch (query) {
    const results = await runSearch(query, { batch: true })
    return results
      .filter(r => looksLikeBatch(r.title))
      .map(r => ({ ...r, type: 'batch' }))
  }

  async movie (query) {
    return runSearch(query, { movie: true })
  }

  async test () {
    const url = NYAA_BASE + '/?u=' + encodeURIComponent(UPLOADER) + '&page=rss&c=' + ANIME_CATEGORY
    let res
    try {
      res = await httpGet(url)
    } catch (err) {
      throw new Error('Cannot reach nyaa.si. Check your internet connection or try again later.')
    }
    if (!res.ok) {
      throw new Error('Nyaa returned HTTP ' + res.status + ' for the Yameii feed.')
    }
    return true
  }
}()
