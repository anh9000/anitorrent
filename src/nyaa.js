const NYAA_BASE = 'https://nyaa.si'
const ANIME_CATEGORY = '1_2'

const TRACKERS = [
  'udp://tracker.opentrackr.org:1337/announce',
  'udp://open.stealth.si:80/announce',
  'udp://tracker.torrent.eu.org:451/announce',
  'udp://exodus.desync.com:6969/announce',
  'udp://tracker.coppersurfer.tk:6969/announce',
  'udp://tracker.openbittorrent.com:6969/announce',
  'http://nyaa.tracker.wf:7777/announce'
]

const BATCH_PATTERNS = [
  /\bbatch\b/i,
  /\bcomplete\b/i,
  /\bseason\s*\d+\b/i,
  /\bs\d{1,2}\b(?!\s*e\d)/i,
  /\b\d{1,3}\s*[-~]\s*\d{1,3}\b/
]

function escapeQuery (str) {
  return str.replace(/[^\w\s\-.]/g, ' ').replace(/\s+/g, ' ').trim()
}

function pad (n) {
  const s = String(n)
  return s.length < 2 ? '0' + s : s
}

function buildMagnet (hash, name) {
  const trackers = TRACKERS.map(t => 'tr=' + encodeURIComponent(t)).join('&')
  const dn = name ? '&dn=' + encodeURIComponent(name) : ''
  return 'magnet:?xt=urn:btih:' + hash.toLowerCase() + dn + '&' + trackers
}

function parseSize (text) {
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

function pickTag (xml, tag) {
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

function pickItems (xml) {
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

function looksLikeBatch (title) {
  return BATCH_PATTERNS.some(re => re.test(title))
}

function matchesResolution (title, resolution) {
  if (!resolution) return true
  return title.includes(resolution + 'p') || title.includes(resolution)
}

function hitsExclusion (title, exclusions) {
  if (!exclusions || !exclusions.length) return false
  const lower = title.toLowerCase()
  return exclusions.some(kw => kw && lower.includes(String(kw).toLowerCase()))
}

async function rssSearch (query) {
  const url = NYAA_BASE + '/?page=rss&q=' + encodeURIComponent(query) +
    '&c=' + ANIME_CATEGORY + '&s=seeders&o=desc'
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error('Nyaa returned HTTP ' + res.status + '. The site may be down or blocked on your network.')
  }
  const text = await res.text()
  if (!text.includes('<rss') && !text.includes('<item>')) {
    throw new Error('Nyaa returned an unexpected response. The site layout may have changed.')
  }
  return pickItems(text)
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

function rankResults (results, resolution) {
  if (!resolution) return results
  return results.sort((a, b) => {
    const am = matchesResolution(a.title, resolution) ? 1 : 0
    const bm = matchesResolution(b.title, resolution) ? 1 : 0
    if (am !== bm) return bm - am
    return b.seeders - a.seeders
  })
}

function buildQuery (title, opts) {
  let q = escapeQuery(title)
  if (opts.episode != null && !opts.batch && !opts.movie) {
    q += ' ' + pad(opts.episode)
  }
  if (opts.resolution) q += ' ' + opts.resolution + 'p'
  return q
}

async function runSearch (query, opts) {
  if (!query.titles || !query.titles.length) return []

  const exclusions = query.exclusions || []
  const resolution = query.resolution || ''
  const seen = new Set()
  const results = []

  const titles = query.titles.slice(0, 3)
  for (const title of titles) {
    const q = buildQuery(title, { ...opts, resolution })
    let items
    try {
      items = await rssSearch(q)
    } catch (err) {
      if (results.length) break
      throw err
    }
    for (const raw of items) {
      const r = itemToResult(raw, { exclusions, batch: opts.batch })
      if (!r) continue
      if (seen.has(r.hash)) continue
      seen.add(r.hash)
      results.push(r)
    }
    if (results.length >= 20) break
  }

  return rankResults(results, resolution).slice(0, 30)
}

export default new class Nyaa {
  async single (query) {
    return runSearch(query, { episode: query.episode })
  }

  async batch (query) {
    const results = await runSearch(query, { batch: true })
    return results.map(r => ({
      ...r,
      type: looksLikeBatch(r.title) ? 'batch' : r.type
    }))
  }

  async movie (query) {
    return runSearch(query, { movie: true })
  }

  async test () {
    const url = NYAA_BASE + '/?page=rss&q=one+piece&c=' + ANIME_CATEGORY
    let res
    try {
      res = await fetch(url)
    } catch (err) {
      throw new Error('Cannot reach nyaa.si. Check your internet connection or try again later.')
    }
    if (!res.ok) {
      throw new Error('Nyaa returned HTTP ' + res.status + '. The site may be down or blocked on your network.')
    }
    return true
  }
}()
