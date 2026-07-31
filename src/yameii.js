import {
  looksLikeBatch, hitsExclusion, buildMagnet, parseSize, pickTag, pickItems,
  httpGet, checkNyaaFeed, buildQueries, searchContext, finalize, collectFeed,
  withEpisodeCandidates
} from './lib/shared.js'

const SOURCE_DEFAULT = 'high'

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

async function runSearch (query, opts) {
  if (!query.titles || !query.titles.length) return []

  const mode = opts.batch ? 'batch' : (opts.movie ? 'movie' : 'single')
  const ctx = searchContext(query, mode)
  const queries = buildQueries(query.titles, { limit: 2, episode: opts.episode })
  const shaped = await collectFeed(
    queries,
    rssSearchWithRetry,
    raw => itemToResult(raw, { exclusions: ctx.exclusions }),
    ctx,
    SOURCE_DEFAULT
  )
  return finalize(shaped, ctx)
}

export default new class Yameii {
  async single (query) {
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
    return checkNyaaFeed(NYAA_BASE + '/?u=' + encodeURIComponent(UPLOADER) + '&page=rss&c=' + ANIME_CATEGORY)
  }
}()
