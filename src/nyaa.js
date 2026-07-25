import {
  looksLikeBatch, hitsExclusion, buildMagnet, parseSize, pickTag, pickItems,
  httpGet, checkNyaaFeed, buildQueries, searchContext, shapeAll, finalize,
  withEpisodeCandidates
} from './lib/shared.js'

const SOURCE_DEFAULT = 'medium'

const NYAA_BASE = 'https://nyaa.si'
const ANIME_CATEGORY = '1_2'

async function rssSearch (query) {
  const url = NYAA_BASE + '/?page=rss&q=' + encodeURIComponent(query) +
    '&c=' + ANIME_CATEGORY + '&s=id&o=desc'
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
    throw new Error('Nyaa returned HTTP ' + res.status + '. The site may be down or blocked on your network.')
  }
  const text = await res.text()
  if (!text.includes('<rss') && !text.includes('<item>')) {
    throw new Error('Nyaa returned an unexpected response. The site layout may have changed.')
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
          throw new Error('Nyaa is rate limiting requests. Wait a moment and try again.')
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
    accuracy: 'medium',
    type: opts.batch ? 'batch' : undefined
  }
}

async function runSearch (query, opts) {
  if (!query.titles || !query.titles.length) return []

  const mode = opts.batch ? 'batch' : (opts.movie ? 'movie' : 'single')
  const ctx = searchContext(query, mode)
  const seen = new Set()
  const collected = []
  let shaped = []

  for (const q of buildQueries(query.titles, { limit: 2, episode: opts.episode })) {
    let items
    try {
      items = await rssSearchWithRetry(q)
    } catch (err) {
      if (collected.length) break
      throw err
    }
    for (const raw of items) {
      const r = itemToResult(raw, { exclusions: ctx.exclusions, batch: opts.batch })
      if (!r || seen.has(r.hash)) continue
      seen.add(r.hash)
      collected.push(r)
    }
    shaped = shapeAll(collected, ctx, SOURCE_DEFAULT)
    if (shaped.filter(r => r._tier === 'A').length >= 20) break
  }

  return finalize(shaped, ctx.resolution)
}

export default new class Nyaa {
  async single (query) {
    // 1-episode entries on AniList are movies or single-episode OVAs. Release
    // group filenames for these almost never carry an episode marker like "- 01"
    // or "S01E01", so applying titleHasEpisode() would filter out every real
    // release. Treat single() on a 1-episode entry as movie mode.
    if (query.episodeCount === 1) return runSearch(query, { movie: true })
    return runSearch(await withEpisodeCandidates(query), { episode: query.episode })
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
    return checkNyaaFeed(NYAA_BASE + '/?page=rss&q=one+piece&c=' + ANIME_CATEGORY)
  }
}()
