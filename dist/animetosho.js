// src/lib/shared.js
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

// src/animetosho.js
var SOURCE_DEFAULT = "high";
var BASE = "https://feed.animetosho.org/json";
var MAPPING_URL = "https://raw.githubusercontent.com/anh9000/anitorrent/main/data/anilist-to-anidb.json";
var mappingCache = null;
var mappingPromise = null;
function validId(v) {
  const n = Number(v);
  return Number.isInteger(n) && n > 0;
}
async function getMapping() {
  if (mappingCache) return mappingCache;
  if (!mappingPromise) {
    mappingPromise = (async () => {
      try {
        const r = await fetch(MAPPING_URL);
        if (!r.ok) return {};
        const data = await r.json();
        mappingCache = data && typeof data === "object" ? data : {};
        return mappingCache;
      } catch {
        return {};
      }
    })();
  }
  return mappingPromise;
}
async function resolveAnidbAid(query) {
  if (validId(query.anidbAid)) return Number(query.anidbAid);
  if (!validId(query.anilistId)) return null;
  const map = await getMapping();
  const aid = map[String(query.anilistId)];
  return validId(aid) ? Number(aid) : null;
}
async function tryFetch(url) {
  let res;
  try {
    res = await fetch(url);
  } catch (err) {
    throw new Error("Cannot reach AnimeTosho. Check your internet connection or try again later.");
  }
  if (!res.ok) {
    throw new Error("AnimeTosho returned HTTP " + res.status + ". The site may be down or rate limiting your IP.");
  }
  let data;
  try {
    data = await res.json();
  } catch (err) {
    throw new Error("AnimeTosho returned an unexpected response. The API may have changed.");
  }
  if (!Array.isArray(data)) return [];
  return data;
}
function toResult(item, accuracy) {
  const hash = String(item.info_hash || "").toLowerCase();
  if (!hash) return null;
  return {
    title: item.title || item.torrent_name || "",
    link: item.magnet_uri || hash,
    hash,
    seeders: Number(item.seeders) || 0,
    leechers: Number(item.leechers) || 0,
    downloads: Number(item.torrent_downloaded_count) || 0,
    size: Number(item.total_size) || 0,
    date: item.timestamp ? new Date(item.timestamp * 1e3) : /* @__PURE__ */ new Date(),
    accuracy
  };
}
function dedupe(items) {
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const r of items) {
    if (!r || seen.has(r.hash)) continue;
    seen.add(r.hash);
    out.push(r);
  }
  return out;
}
async function fetchByEid(eid) {
  const items = await tryFetch(BASE + "?eid=" + encodeURIComponent(eid));
  return items.map((i) => toResult(i, "high")).filter(Boolean);
}
async function fetchByAid(aid) {
  const items = await tryFetch(BASE + "?aid=" + encodeURIComponent(aid));
  return items.map((i) => toResult(i, "high")).filter(Boolean);
}
async function fetchByText(titles, episode, foundEpisode) {
  const { bases, numbered } = buildQueries(titles, { limit: 2, episode });
  const seen = /* @__PURE__ */ new Map();
  const run = async (qs) => {
    const settled = await Promise.allSettled(qs.map((q) => tryFetch(BASE + "?q=" + encodeURIComponent(q))));
    for (const s of settled) {
      if (s.status !== "fulfilled") continue;
      for (const i of s.value) {
        const r = toResult(i, "medium");
        if (r && !seen.has(r.hash)) seen.set(r.hash, r);
      }
    }
  };
  await run(bases);
  if (numbered.length && !foundEpisode([...seen.values()])) await run(numbered);
  return [...seen.values()];
}
function classifyAndTag(raw, ctx) {
  const items = dedupe(raw).filter((r) => !hitsExclusion(r.title, ctx.exclusions));
  const out = shapeAll(items, ctx, SOURCE_DEFAULT);
  if (ctx.mode === "batch") {
    return out.filter((r) => looksLikeBatch(r.title)).map((r) => ({ ...r, type: "batch", accuracy: "low" }));
  }
  return out;
}
async function search(query, mode) {
  if (!query) return [];
  const ctx = searchContext(query, mode);
  const resolvedAid = await resolveAnidbAid(query);
  let raw = [];
  if (mode === "single" && validId(query.anidbEid)) {
    try {
      raw = await fetchByEid(query.anidbEid);
    } catch (_) {
      raw = [];
    }
  } else if (resolvedAid) {
    try {
      raw = await fetchByAid(resolvedAid);
    } catch (_) {
      raw = [];
    }
  }
  const results = classifyAndTag(raw, ctx);
  if (!results.some((r) => r._tier === "A") && (query.titles || []).length) {
    const seen = new Set(results.map((r) => r.hash));
    const foundEpisode = (items) => classifyAndTag(items, ctx).some((r) => r._tier === "A");
    for (const r of classifyAndTag(await fetchByText(query.titles, query.episode, foundEpisode), ctx)) {
      if (seen.has(r.hash)) continue;
      seen.add(r.hash);
      results.push(r);
    }
  }
  return finalize(results, ctx);
}
var animetosho_default = new class AnimeTosho {
  async single(query) {
    if (query.episodeCount === 1) return search(query, "movie");
    return search(await withEpisodeCandidates(query), "single");
  }
  async batch(query) {
    return search(query, "batch");
  }
  async movie(query) {
    return search(query, "movie");
  }
  async test() {
    let res;
    try {
      res = await fetch(BASE + "?q=test");
    } catch (err) {
      throw new Error("Cannot reach AnimeTosho. Check your internet connection or try again later.");
    }
    if (!res.ok) {
      throw new Error("AnimeTosho returned HTTP " + res.status + ". The site may be down.");
    }
    return true;
  }
}();
export {
  animetosho_default as default
};
