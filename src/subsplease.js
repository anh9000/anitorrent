import {
  hitsExclusion, buildQueries, searchContext, classifyResult,
  tagAccuracy, finalize, withEpisodeCandidates
} from './lib/shared.js'

const SOURCE_DEFAULT = 'high'

const BASE = 'https://subsplease.org/api/'
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

function base32ToHex (b32) {
  let bits = ''
  for (const c of b32.toUpperCase()) {
    const idx = BASE32_ALPHABET.indexOf(c)
    if (idx < 0) continue
    bits += idx.toString(2).padStart(5, '0')
  }
  let hex = ''
  for (let i = 0; i + 4 <= bits.length; i += 4) {
    hex += parseInt(bits.slice(i, i + 4), 2).toString(16)
  }
  return hex
}

function parseMagnet (magnet) {
  const m = String(magnet || '')
  const hashMatch = m.match(/xt=urn:btih:([A-Z2-7]{32}|[a-fA-F0-9]{40})/i)
  let hash = ''
  if (hashMatch) {
    const raw = hashMatch[1]
    hash = raw.length === 40 ? raw.toLowerCase() : base32ToHex(raw)
  }
  const sizeMatch = m.match(/[?&]xl=(\d+)/i)
  const size = sizeMatch ? parseInt(sizeMatch[1], 10) : 0
  return { hash, size }
}

function episodeMatches (entryEpisode, wanted) {
  if (wanted == null) return true
  const e = String(entryEpisode || '').trim()
  if (!e) return false
  if (e.includes('-') || e.includes('~')) return false
  const n = parseInt(e, 10)
  return Number.isInteger(n) && n === Number(wanted)
}

function isBatchEntry (entry) {
  const e = String(entry.episode || '')
  if (/\d+\s*[-~]\s*\d+/.test(e)) return true
  if (/batch/i.test(e)) return true
  return false
}

async function searchApi (q) {
  const url = BASE + '?f=search&tz=UTC&s=' + encodeURIComponent(q)
  let res
  try {
    res = await fetch(url)
  } catch (err) {
    throw new Error('Cannot reach SubsPlease. Check your internet connection or try again later.')
  }
  if (!res.ok) {
    throw new Error('SubsPlease returned HTTP ' + res.status + '. The site may be down.')
  }
  let data
  try {
    data = await res.json()
  } catch (err) {
    throw new Error('SubsPlease returned an unexpected response.')
  }
  if (Array.isArray(data)) return []
  if (!data || typeof data !== 'object') return []
  return Object.entries(data).map(([key, entry]) => ({ key, ...entry }))
}

function entryToResults (entry, opts) {
  const downloads = Array.isArray(entry.downloads) ? entry.downloads : []
  const date = entry.release_date ? new Date(entry.release_date) : new Date()
  const out = []
  for (const dl of downloads) {
    if (!dl || !dl.magnet) continue
    const { hash, size } = parseMagnet(dl.magnet)
    if (!hash) continue
    const res = dl.res ? dl.res + 'p' : ''
    const title = '[SubsPlease] ' + entry.key + (res ? ' (' + res + ')' : '')
    if (hitsExclusion(title, opts.exclusions)) continue
    out.push({
      title,
      link: dl.magnet,
      hash,
      seeders: 0,
      leechers: 0,
      downloads: 0,
      size,
      date,
      accuracy: opts.batch ? 'low' : tagAccuracy(opts.tier, date.getTime(), SOURCE_DEFAULT),
      type: (opts.batch || opts.tier === 'B') ? 'batch' : undefined
    })
  }
  return out
}

function episodeMatchesAny (entry, query) {
  const candidates = query.episodeCandidates
  if (candidates && candidates.size) {
    for (const n of candidates) if (episodeMatches(entry.episode, n)) return true
    return false
  }
  return episodeMatches(entry.episode, query.episode)
}

async function runSearch (query, mode) {
  if (!query || !query.titles || !query.titles.length) return []

  const ctx = searchContext(query, mode)
  const seenHashes = new Set()
  const seenKeys = new Set()
  const entries = []

  for (const q of buildQueries(query.titles, { limit: 3 })) {
    let batch
    try {
      batch = await searchApi(q)
    } catch (err) {
      if (entries.length) break
      throw err
    }
    for (const e of batch) {
      if (seenKeys.has(e.key)) continue
      seenKeys.add(e.key)
      entries.push(e)
    }
    if (entries.length >= 50) break
  }

  const build = useCandidates => {
    const epCtx = useCandidates ? ctx : { ...ctx, episodeCandidates: null }
    const shaped = []
    for (const e of entries) {
      const tier = classifyResult(e.key, epCtx)
      if (tier === null) continue
      const isBatch = isBatchEntry(e)
      if (mode === 'batch' && !isBatch) continue
      if (mode === 'movie' && isBatch) continue

      let effectiveTier = tier
      if (mode === 'single') {
        if (isBatch) effectiveTier = 'B'
        else if (tier === 'A' && !episodeMatchesAny(e, epCtx)) effectiveTier = 'C'
      }
      shaped.push({ entry: e, tier: effectiveTier })
    }
    return shaped
  }

  let shaped = build(false)
  if (!shaped.some(s => s.tier === 'A') && ctx.episodeCandidates?.size > 1) {
    const relaxed = build(true)
    if (relaxed.some(s => s.tier === 'A')) shaped = relaxed
  }

  const out = []
  for (const { entry, tier } of shaped) {
    const opts = { exclusions: ctx.exclusions, batch: mode === 'batch', tier }
    for (const r of entryToResults(entry, opts)) {
      if (seenHashes.has(r.hash)) continue
      seenHashes.add(r.hash)
      out.push({ ...r, _tier: tier })
    }
  }

  return finalize(out, ctx.resolution)
}

export default new class SubsPlease {
  async single (query) {
    if (query.episodeCount === 1) return runSearch(query, 'movie')
    return runSearch(await withEpisodeCandidates(query), 'single')
  }
  async batch (query) { return runSearch(query, 'batch') }
  async movie (query) { return runSearch(query, 'movie') }

  async test () {
    let res
    try {
      res = await fetch(BASE + '?f=latest&tz=UTC')
    } catch (err) {
      throw new Error('Cannot reach SubsPlease. Check your internet connection or try again later.')
    }
    if (!res.ok) {
      throw new Error('SubsPlease returned HTTP ' + res.status + '. The site may be down.')
    }
    return true
  }
}()
