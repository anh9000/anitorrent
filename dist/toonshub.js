// src/lib/shared.js
var BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/xml, text/xml, text/html, application/json, */*"
};
function httpGet(url, opts = {}) {
  const { headers, ...rest } = opts;
  return fetch(url, { headers: { ...BROWSER_HEADERS, ...headers }, ...rest });
}
async function checkNyaaFeed(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6e3);
  let res;
  try {
    res = await httpGet(url, { signal: ctrl.signal });
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error("nyaa.si is slow to respond right now. This is temporary and usually clears in a minute. Searches will still work; the extension is fine, no reinstall needed.");
    }
    throw new Error("nyaa.si is currently unreachable. The extension will work again once the site is back, nothing to fix on your end.");
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 429) {
    throw new Error("nyaa.si is rate-limiting requests. Wait a minute and toggle this extension off and on.");
  }
  if (!res.ok) {
    throw new Error("nyaa.si returned HTTP " + res.status + ". The extension will work again once the site is back.");
  }
  const text = await res.text();
  if (!text.includes("<rss") && !text.includes("<item>")) {
    throw new Error("nyaa.si returned an unexpected response (likely a ddos-guard challenge). Try again in a minute; the extension will keep working when it clears.");
  }
  return true;
}
var TRACKERS = [
  "udp://tracker.opentrackr.org:1337/announce",
  "udp://open.stealth.si:80/announce",
  "udp://tracker.torrent.eu.org:451/announce",
  "udp://exodus.desync.com:6969/announce",
  "udp://tracker.coppersurfer.tk:6969/announce",
  "udp://tracker.openbittorrent.com:6969/announce",
  "http://nyaa.tracker.wf:7777/announce"
];
var BATCH_PATTERNS = [
  /\bbatch\b/i,
  /\bcomplete\b/i,
  /\bseason\s*\d+\b/i,
  /\bs\d{1,2}\b(?!\s*e\d)/i,
  /\b\d{1,3}\s*[-~]\s*\d{1,3}\b/
];
var STOPWORDS = /* @__PURE__ */ new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "this",
  "that",
  "her",
  "his",
  "are",
  "was",
  "were",
  "has",
  "have",
  "had",
  "who",
  "what",
  "when",
  "where",
  "why",
  "how",
  "all",
  "any",
  "one",
  "two",
  "season",
  "episode",
  "part",
  "arc",
  "movie",
  "film",
  "ova",
  "special",
  // Japanese romanization noise: grammatical particles, pronouns, honorifics,
  // copula, common verbs, and arc/chapter markers that romanize to short tokens
  // and appear across unrelated shows ("-hen" arc suffix, "na Ken", "boku/ore"
  // pronouns, "-sama/-san/-kun/-chan" honorifics). Never show-identifying.
  "hen",
  "boku",
  "ore",
  "kimi",
  "sama",
  "san",
  "kun",
  "chan",
  "suru",
  "naru",
  "nani",
  "desu",
  "dake",
  "made",
  "demo",
  "inai",
  "koi",
  "ken",
  "shi",
  // "dan" leaked "Grow Up Show: Himawari no Circus-dan" (Japanese for "troupe")
  // into every Dandadan search. Dandadan self-match is unaffected because the
  // canonical title tokens to "dandadan" (14 chars, kept), not "dan".
  "dan"
]);
function escapeQuery(str) {
  return String(str || "").replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
}
function significantTokens(title) {
  return escapeQuery(title).toLowerCase().split(/\s+/).filter((t) => t.length >= 3 && !STOPWORDS.has(t) && !/^\d+(st|nd|rd|th)$/.test(t));
}
function buildTitleTokens(titles) {
  const tokens = /* @__PURE__ */ new Set();
  for (const t of titles || []) {
    for (const tok of significantTokens(t)) tokens.add(tok);
  }
  return tokens;
}
function tokenInTitle(tok, lower) {
  return new RegExp("\\b" + tok + "\\b").test(lower);
}
function stripLangCodes(title) {
  return String(title).replace(/\[[A-Z]{2,3}(?:-[A-Z]{2,3})?\]/g, " ");
}
function resultMatchesShow(title, tokens, minHits = 1) {
  if (!tokens.size) return true;
  const lower = stripLangCodes(title).toLowerCase();
  let hits = 0;
  for (const tok of tokens) {
    if (tokenInTitle(tok, lower)) {
      hits++;
      if (hits >= minHits) return true;
    }
  }
  return false;
}
var ROMAN_SEASON = { II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10 };
function detectResultSeason(title) {
  const t = String(title || "");
  let m = t.match(/\bS(\d{1,2})(?:E\d|\b)/i);
  if (m) return parseInt(m[1], 10);
  m = t.match(/\b(?:Season\s+(\d+)|(\d+)(?:st|nd|rd|th)\s+Season)\b/i);
  if (m) return parseInt(m[1] || m[2], 10);
  m = t.match(/\b[A-Za-z]+\s+(II|III|IV|V|VI|VII|VIII|IX|X)(?=\s|:|\.|-|$|\[|\()/);
  if (m) return ROMAN_SEASON[m[1]];
  const digitRE = /\b([2-9])(?=\s*$|\s*[:\-|(\[])/g;
  let dm;
  while ((dm = digitRE.exec(t)) !== null) {
    const before = t.slice(Math.max(0, dm.index - 8), dm.index).toLowerCase();
    if (/\bpart\s+$/.test(before)) continue;
    return parseInt(dm[1], 10);
  }
  return null;
}
function detectShowSeason(titles) {
  let max = 0;
  for (const t of titles || []) {
    const n = detectResultSeason(t);
    if (n && n > max) max = n;
  }
  return max || 1;
}
function resultMatchesSeason(title, showSeason) {
  const rs = detectResultSeason(title);
  if (showSeason > 1) return rs === showSeason;
  return !rs || rs === 1;
}
var YEAR_RE = /(?:^|[\s._\[(\-])(19[3-9]\d|20\d{2})(?=[\s._\])\-]|$)/g;
function detectYears(text) {
  const s = String(text || "");
  const years = /* @__PURE__ */ new Set();
  YEAR_RE.lastIndex = 0;
  let m;
  while ((m = YEAR_RE.exec(s)) !== null) years.add(m[1]);
  return years;
}
function detectShowYears(titles) {
  const years = /* @__PURE__ */ new Set();
  for (const t of titles || []) for (const y of detectYears(t)) years.add(y);
  return years;
}
function resultMatchesYear(title, showYears) {
  if (!showYears || !showYears.size) return true;
  const rYears = detectYears(title);
  if (!rYears.size) return true;
  for (const y of rYears) if (showYears.has(y)) return true;
  return false;
}
function titleHasEpisode(title, ep) {
  if (ep == null) return true;
  const n = String(ep).replace(/^0+/, "") || "0";
  const patterns = [
    new RegExp("\\b(?:e|ep|episode\\s*|s\\d{1,2}e)0*" + n + "\\b(?!\\d)", "i"),
    new RegExp("[\\s._][-~]\\s+0*" + n + "(?:v\\d)?(?=[\\s\\[\\(]|$)", "i"),
    new RegExp("[\\[\\(]0*" + n + "(?:v\\d)?[\\]\\)]", "i")
  ];
  return patterns.some((re) => re.test(title));
}
function looksLikeBatch(title) {
  if (/\bs\d{1,2}e\d{1,3}\s*[-~]\s*(?:s\d{1,2})?e?\d{1,3}\b/i.test(title)) return true;
  if (/\bs\d{1,2}e\d{1,3}\b/i.test(title)) return false;
  if (/\s-\s*\d{1,4}(?:v\d)?\s*(?:\[|\(|$)/.test(title)) return false;
  return BATCH_PATTERNS.some((re) => re.test(title));
}
function tagAccuracy(tier, dateMs, sourceDefault) {
  if (tier === "A") return sourceDefault;
  if (tier === "B") return "low";
  const days = (Date.now() - (dateMs || 0)) / 864e5;
  if (days < 60) return sourceDefault;
  if (days < 180) return "medium";
  return "low";
}
function buildQueries(titles, opts = {}) {
  const limit = opts.limit || 3;
  const bases = [];
  const seen = /* @__PURE__ */ new Set();
  for (const title of rankTitlesForQuery(titles || [])) {
    const q = trimTitleForQuery(title);
    if (!q || seen.has(q)) continue;
    seen.add(q);
    bases.push(q);
    if (bases.length >= limit) break;
  }
  const numbered = opts.episode == null ? [] : bases.map((b) => b + " " + pad(opts.episode));
  return { bases, numbered };
}
async function collectFeed(queries, fetchItems, mapItem, ctx, sourceDefault) {
  const seen = /* @__PURE__ */ new Set();
  const collected = [];
  let shaped = [];
  let lastError = null;
  const phase = async (qs) => {
    const settled = await Promise.allSettled(qs.map((q) => fetchItems(q)));
    for (const s of settled) {
      if (s.status === "rejected") {
        lastError = s.reason;
        continue;
      }
      for (const raw of s.value) {
        const r = mapItem(raw);
        if (!r || seen.has(r.hash)) continue;
        seen.add(r.hash);
        collected.push(r);
      }
    }
    shaped = shapeAll(collected, ctx, sourceDefault);
  };
  await phase(queries.bases);
  if (!collected.length && lastError) throw lastError;
  if (queries.numbered.length && !shaped.some((r) => r._tier === "A")) {
    await phase(queries.numbered);
  }
  return shaped;
}
var ANILIST_API = "https://graphql.anilist.co";
var offsetCache = /* @__PURE__ */ new Map();
async function fetchPrequelChain(anilistId) {
  const seen = /* @__PURE__ */ new Set();
  const counts = [];
  let current = Number(anilistId);
  for (let depth = 0; depth < 12 && current && !seen.has(current); depth++) {
    seen.add(current);
    const body = JSON.stringify({
      query: "query($id:Int){Media(id:$id){episodes format relations{edges{relationType node{id episodes format}}}}}",
      variables: { id: current }
    });
    let media;
    try {
      const res = await fetch(ANILIST_API, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body
      });
      if (!res.ok) break;
      media = (await res.json())?.data?.Media;
    } catch {
      break;
    }
    if (!media) break;
    const prequel = (media.relations?.edges || []).filter((e) => e.relationType === "PREQUEL").map((e) => e.node).filter((n) => n && (n.format === "TV" || n.format === "ONA" || n.format === "TV_SHORT")).sort((a, b) => (b.episodes || 0) - (a.episodes || 0))[0];
    if (!prequel || !prequel.episodes) break;
    counts.push(prequel.episodes);
    current = prequel.id;
  }
  return counts;
}
async function resolveEpisodeCandidates(query) {
  const ep = Number(query.episode);
  if (!Number.isInteger(ep) || !query.anilistId) return null;
  const key = String(query.anilistId);
  if (!offsetCache.has(key)) {
    offsetCache.set(key, fetchPrequelChain(query.anilistId).catch(() => []));
  }
  const counts = await offsetCache.get(key);
  const candidates = /* @__PURE__ */ new Set([ep]);
  let running = 0;
  for (const c of counts || []) {
    running += c;
    if (running >= 10) candidates.add(ep + running);
  }
  return candidates;
}
function searchContext(query, mode) {
  const titles = query.titles || [];
  const primary = rankTitlesForQuery(titles)[0];
  const primaryTokens = primary ? buildTitleTokens([primary]) : /* @__PURE__ */ new Set();
  return {
    mode,
    showTokens: buildTitleTokens(titles),
    showSeason: detectShowSeason(titles),
    showYears: detectShowYears(titles),
    minHits: primaryTokens.size >= 3 ? 2 : 1,
    episode: query.episode,
    episodeCandidates: query.episodeCandidates || null,
    exclusions: query.exclusions || [],
    resolution: query.resolution || ""
  };
}
function shapeResult(r, ctx, sourceDefault) {
  const tier = classifyResult(r.title, ctx);
  if (tier === null) return null;
  const out = { ...r, _tier: tier, accuracy: tagAccuracy(tier, r.date?.getTime?.(), sourceDefault) };
  if (tier === "B") out.type = "batch";
  return out;
}
function shapeAll(items, ctx, sourceDefault) {
  const shape = (c) => {
    const out = [];
    for (const r of items) {
      const s = shapeResult(r, c, sourceDefault);
      if (s) out.push(s);
    }
    return out;
  };
  const exact = shape({ ...ctx, episodeCandidates: null });
  if (ctx.episode != null) ctx.chosenEpisodes = /* @__PURE__ */ new Set([ctx.episode]);
  if (!ctx.episodeCandidates || ctx.episodeCandidates.size <= 1) return exact;
  let best = null;
  for (const n of ctx.episodeCandidates) {
    const shaped = shape({ ...ctx, episodeCandidates: /* @__PURE__ */ new Set([n]) });
    const newest = newestOf(shaped);
    if (newest == null) continue;
    if (!best || newest > best.newest) best = { newest, shaped, episode: n };
  }
  if (!best) return exact;
  ctx.chosenEpisodes = /* @__PURE__ */ new Set([best.episode]);
  return best.shaped;
}
function newestOf(results) {
  let newest = null;
  for (const r of results) {
    if (r._tier !== "A") continue;
    const t = r.date?.getTime?.() || 0;
    if (newest == null || t > newest) newest = t;
  }
  return newest;
}
function sortResults(results, resolution) {
  const hasExact = results.some((r) => r._tier === "A");
  return results.sort((a, b) => {
    if (hasExact && a._tier !== b._tier) return a._tier < b._tier ? -1 : 1;
    const dt = (b.date?.getTime?.() || 0) - (a.date?.getTime?.() || 0);
    if (dt !== 0) return dt;
    if (resolution) {
      const am = matchesResolution(a.title, resolution) ? 1 : 0;
      const bm = matchesResolution(b.title, resolution) ? 1 : 0;
      if (am !== bm) return bm - am;
    }
    return (b.seeders || 0) - (a.seeders || 0);
  });
}
function titleEpisodeMarkers(title) {
  const out = [];
  const push = (a, b) => {
    const lo = parseInt(a, 10);
    const hi = b == null ? lo : parseInt(b, 10);
    if (Number.isInteger(lo)) out.push([lo, Number.isInteger(hi) ? hi : lo]);
  };
  let m;
  const se = /\bs\d{1,2}e(\d{1,4})(?:\s*[-~]\s*(?:s\d{1,2})?e(\d{1,4}))?\b/gi;
  while ((m = se.exec(title)) !== null) push(m[1], m[2]);
  const ep = /\bep(?:isode)?\.?\s*(\d{1,4})\b/gi;
  while ((m = ep.exec(title)) !== null) push(m[1], null);
  const dash = /[\s._]-\s*(\d{1,4})(?:v\d)?\s*(?=[[(]|$)/g;
  while ((m = dash.exec(title)) !== null) push(m[1], null);
  const range = /\b(\d{1,4})\s*[-~]\s*(\d{1,4})\b/g;
  while ((m = range.exec(title)) !== null) {
    const a = parseInt(m[1], 10);
    const b = parseInt(m[2], 10);
    if (b > a && b - a < 400) push(m[1], m[2]);
  }
  return out;
}
function hasConflictingEpisode(title, wanted) {
  if (!wanted || !wanted.size) return false;
  const markers = titleEpisodeMarkers(title);
  if (!markers.length) return false;
  for (const [lo, hi] of markers) {
    for (const w of wanted) if (w >= lo && w <= hi) return false;
  }
  return true;
}
function finalize(results, ctx, limit = 30) {
  const resolution = typeof ctx === "string" ? ctx : ctx && ctx.resolution || "";
  const hasExact = results.some((r) => r._tier === "A");
  let kept;
  if (hasExact) {
    kept = results.filter((r) => r._tier !== "C");
  } else {
    const wanted = typeof ctx === "string" ? null : wantedEpisodes(ctx);
    kept = results.filter((r) => !hasConflictingEpisode(r.title, wanted)).map((r) => ({ ...r, accuracy: "low" }));
  }
  return sortResults(kept, resolution).slice(0, limit).map(({ _tier, ...rest }) => rest);
}
function wantedEpisodes(ctx) {
  if (!ctx || ctx.mode !== "single" || ctx.episode == null) return null;
  return ctx.chosenEpisodes || /* @__PURE__ */ new Set([ctx.episode]);
}
async function withEpisodeCandidates(query) {
  try {
    const episodeCandidates = await resolveEpisodeCandidates(query);
    if (!episodeCandidates || episodeCandidates.size <= 1) return query;
    return { ...query, episodeCandidates };
  } catch {
    return query;
  }
}
var GENERIC_QUERY_WORDS = /* @__PURE__ */ new Set([
  "monster",
  "level",
  "hero",
  "world",
  "girl",
  "boy",
  "demon",
  "devil",
  "dragon",
  "angel",
  "king",
  "queen",
  "story",
  "magic",
  "school",
  "love",
  "life",
  "club",
  "sword",
  "blood",
  "dark",
  "light",
  "night",
  "master",
  "star",
  "moon",
  "witch",
  "ghost",
  "dead",
  "zombie",
  "idol",
  "club"
]);
function trimTitleForQuery(title) {
  const colon = title.indexOf(":");
  const base = colon > 0 ? title.slice(0, colon) : title;
  return significantTokens(base).slice(0, 4).join(" ") || escapeQuery(title);
}
function rankTitlesForQuery(titles) {
  const list = (titles || []).map((t, i) => {
    const stripped = String(t).replace(/\s/g, "");
    const ascii = escapeQuery(t).replace(/\s/g, "");
    const queryToks = trimTitleForQuery(t).split(/\s+/).filter(Boolean);
    return {
      t,
      i,
      tokens: significantTokens(t).length,
      // A query is "degenerate" when it collapses to a single word that is
      // too generic to search: very short ("Orb: ..." -> "orb") or a common
      // word ("Ore dake Level Up na Ken" -> "level", "Monster #8" -> "monster").
      // A specific single token ("bakemonogatari", "noragami", "kaiju") is
      // fine. Degenerate titles get demoted so a better title is queried first.
      degenerate: queryToks.length <= 1 && ((queryToks[0] || "").length < 4 || GENERIC_QUERY_WORDS.has(queryToks[0])),
      asciiRatio: stripped.length ? ascii.length / stripped.length : 0
    };
  }).filter((x) => x.tokens > 0);
  const latin = list.filter((x) => x.asciiRatio >= 0.5);
  const pool = latin.length ? latin : list;
  return pool.sort((a, b) => a.degenerate - b.degenerate || a.i - b.i).map((x) => x.t);
}
function pad(n) {
  const s = String(n);
  return s.length < 2 ? "0" + s : s;
}
function classifyResult(title, opts) {
  const showTokens = opts.showTokens;
  const minHits = opts.minHits != null ? opts.minHits : showTokens && showTokens.size >= 3 ? 2 : 1;
  if (!resultMatchesShow(title, showTokens, minHits)) return null;
  const seasonOk = resultMatchesSeason(title, opts.showSeason);
  const yearOk = resultMatchesYear(title, opts.showYears);
  const isBatch = looksLikeBatch(title);
  if (opts.mode === "batch") {
    return seasonOk && yearOk && isBatch ? "A" : "C";
  }
  if (opts.mode === "movie") {
    return seasonOk && yearOk ? "A" : "C";
  }
  const epOk = opts.episode == null || matchesAnyEpisode(title, opts);
  if (seasonOk && yearOk && epOk) {
    return isBatch ? "B" : "A";
  }
  return "C";
}
function matchesAnyEpisode(title, opts) {
  const candidates = opts.episodeCandidates;
  if (candidates && candidates.size) {
    for (const n of candidates) if (titleHasEpisode(title, n)) return true;
    return false;
  }
  return titleHasEpisode(title, opts.episode);
}
function matchesResolution(title, resolution) {
  if (!resolution) return true;
  return title.includes(resolution + "p") || title.includes(resolution);
}
function hitsExclusion(title, exclusions) {
  if (!exclusions || !exclusions.length) return false;
  const lower = title.toLowerCase();
  return exclusions.some((kw) => kw && lower.includes(String(kw).toLowerCase()));
}
function buildMagnet(hash, name) {
  const trackers = TRACKERS.map((t) => "tr=" + encodeURIComponent(t)).join("&");
  const dn = name ? "&dn=" + encodeURIComponent(name) : "";
  return "magnet:?xt=urn:btih:" + String(hash).toLowerCase() + dn + "&" + trackers;
}
function parseSize(text) {
  if (!text) return 0;
  const m = text.match(/([\d.]+)\s*(KiB|MiB|GiB|TiB|KB|MB|GB|TB|B)/i);
  if (!m) return 0;
  const value = parseFloat(m[1]);
  const unit = m[2].toLowerCase();
  const mult = {
    b: 1,
    kib: 1024,
    kb: 1e3,
    mib: 1024 ** 2,
    mb: 1e3 ** 2,
    gib: 1024 ** 3,
    gb: 1e3 ** 3,
    tib: 1024 ** 4,
    tb: 1e3 ** 4
  }[unit] || 1;
  return Math.round(value * mult);
}
function pickTag(xml, tag) {
  const open = "<" + tag + ">";
  const close = "</" + tag + ">";
  const i = xml.indexOf(open);
  if (i === -1) return "";
  const j = xml.indexOf(close, i + open.length);
  if (j === -1) return "";
  let val = xml.slice(i + open.length, j);
  if (val.startsWith("<![CDATA[") && val.endsWith("]]>")) {
    val = val.slice(9, -3);
  }
  return val.trim();
}
function pickItems(xml) {
  const out = [];
  let cursor = 0;
  while (true) {
    const start = xml.indexOf("<item>", cursor);
    if (start === -1) break;
    const end = xml.indexOf("</item>", start);
    if (end === -1) break;
    out.push(xml.slice(start + 6, end));
    cursor = end + 7;
  }
  return out;
}

// src/toonshub.js
var SOURCE_DEFAULT = "high";
var NYAA_BASE = "https://nyaa.si";
var TITLE_PREFIX = "[ToonsHub]";
var ANIME_CATEGORY = "1_2";
async function rssSearch(query) {
  const q = TITLE_PREFIX + (query ? " " + query : "");
  const url = NYAA_BASE + "/?page=rss&q=" + encodeURIComponent(q) + "&c=" + ANIME_CATEGORY + "&s=id&o=desc";
  let res;
  try {
    res = await httpGet(url);
  } catch (err) {
    throw new Error("Cannot reach nyaa.si. Check your internet connection or try again later.");
  }
  if (res.status === 429) {
    const err = new Error("429");
    err.rateLimited = true;
    throw err;
  }
  if (!res.ok) {
    throw new Error("Nyaa returned HTTP " + res.status + " for the ToonsHub feed. The site may be down or blocked on your network.");
  }
  const text = await res.text();
  if (!text.includes("<rss") && !text.includes("<item>")) {
    throw new Error("Nyaa returned an unexpected response for the ToonsHub feed.");
  }
  return pickItems(text);
}
async function rssSearchWithRetry(query) {
  try {
    return await rssSearch(query);
  } catch (err) {
    if (err.rateLimited) {
      await new Promise((r) => setTimeout(r, 1500));
      try {
        return await rssSearch(query);
      } catch (retryErr) {
        if (retryErr.rateLimited) {
          throw new Error("Nyaa is rate limiting requests for the ToonsHub feed. Wait a moment and try again.");
        }
        throw retryErr;
      }
    }
    throw err;
  }
}
function itemToResult(raw, opts) {
  const title = pickTag(raw, "title");
  const hash = pickTag(raw, "nyaa:infoHash").toLowerCase();
  if (!title || !hash) return null;
  if (!title.includes(TITLE_PREFIX)) return null;
  if (hitsExclusion(title, opts.exclusions)) return null;
  const seeders = parseInt(pickTag(raw, "nyaa:seeders"), 10) || 0;
  const leechers = parseInt(pickTag(raw, "nyaa:leechers"), 10) || 0;
  const downloads = parseInt(pickTag(raw, "nyaa:downloads"), 10) || 0;
  const size = parseSize(pickTag(raw, "nyaa:size"));
  const pubDate = pickTag(raw, "pubDate");
  const date = pubDate ? new Date(pubDate) : /* @__PURE__ */ new Date();
  return {
    title,
    link: buildMagnet(hash, title),
    hash,
    seeders,
    leechers,
    downloads,
    size,
    date,
    accuracy: "high"
  };
}
async function runSearch(query, opts) {
  if (!query.titles || !query.titles.length) return [];
  const mode = opts.batch ? "batch" : opts.movie ? "movie" : "single";
  const ctx = searchContext(query, mode);
  const queries = buildQueries(query.titles, { limit: 2, episode: opts.episode });
  const shaped = await collectFeed(
    queries,
    rssSearchWithRetry,
    (raw) => itemToResult(raw, { exclusions: ctx.exclusions }),
    ctx,
    SOURCE_DEFAULT
  );
  return finalize(shaped, ctx);
}
var toonshub_default = new class ToonsHub {
  async single(query) {
    if (query.episodeCount === 1) return runSearch(query, { movie: true });
    return runSearch(await withEpisodeCandidates(query), { episode: query.episode });
  }
  async batch(query) {
    const results = await runSearch(query, { batch: true });
    return results.filter((r) => looksLikeBatch(r.title)).map((r) => ({ ...r, type: "batch", accuracy: "low" }));
  }
  async movie(query) {
    return runSearch(query, { movie: true });
  }
  async test() {
    return checkNyaaFeed(NYAA_BASE + "/?page=rss&q=" + encodeURIComponent(TITLE_PREFIX) + "&c=" + ANIME_CATEGORY);
  }
}();
export {
  toonshub_default as default
};
