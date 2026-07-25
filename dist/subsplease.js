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
  if (opts.episode == null) return bases;
  const numbered = bases.map((b) => b + " " + pad(opts.episode));
  return [...bases, ...numbered].slice(0, opts.maxQueries || 4);
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
function finalize(results, resolution, limit = 30) {
  return sortResults(results, resolution).slice(0, limit).map(({ _tier, ...rest }) => rest);
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

// src/subsplease.js
var SOURCE_DEFAULT = "high";
var BASE = "https://subsplease.org/api/";
var BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function base32ToHex(b32) {
  let bits = "";
  for (const c of b32.toUpperCase()) {
    const idx = BASE32_ALPHABET.indexOf(c);
    if (idx < 0) continue;
    bits += idx.toString(2).padStart(5, "0");
  }
  let hex = "";
  for (let i = 0; i + 4 <= bits.length; i += 4) {
    hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  }
  return hex;
}
function parseMagnet(magnet) {
  const m = String(magnet || "");
  const hashMatch = m.match(/xt=urn:btih:([A-Z2-7]{32}|[a-fA-F0-9]{40})/i);
  let hash = "";
  if (hashMatch) {
    const raw = hashMatch[1];
    hash = raw.length === 40 ? raw.toLowerCase() : base32ToHex(raw);
  }
  const sizeMatch = m.match(/[?&]xl=(\d+)/i);
  const size = sizeMatch ? parseInt(sizeMatch[1], 10) : 0;
  return { hash, size };
}
function episodeMatches(entryEpisode, wanted) {
  if (wanted == null) return true;
  const e = String(entryEpisode || "").trim();
  if (!e) return false;
  if (e.includes("-") || e.includes("~")) return false;
  const n = parseInt(e, 10);
  return Number.isInteger(n) && n === Number(wanted);
}
function isBatchEntry(entry) {
  const e = String(entry.episode || "");
  if (/\d+\s*[-~]\s*\d+/.test(e)) return true;
  if (/batch/i.test(e)) return true;
  return false;
}
async function searchApi(q) {
  const url = BASE + "?f=search&tz=UTC&s=" + encodeURIComponent(q);
  let res;
  try {
    res = await fetch(url);
  } catch (err) {
    throw new Error("Cannot reach SubsPlease. Check your internet connection or try again later.");
  }
  if (!res.ok) {
    throw new Error("SubsPlease returned HTTP " + res.status + ". The site may be down.");
  }
  let data;
  try {
    data = await res.json();
  } catch (err) {
    throw new Error("SubsPlease returned an unexpected response.");
  }
  if (Array.isArray(data)) return [];
  if (!data || typeof data !== "object") return [];
  return Object.entries(data).map(([key, entry]) => ({ key, ...entry }));
}
function entryToResults(entry, opts) {
  const downloads = Array.isArray(entry.downloads) ? entry.downloads : [];
  const date = entry.release_date ? new Date(entry.release_date) : /* @__PURE__ */ new Date();
  const out = [];
  for (const dl of downloads) {
    if (!dl || !dl.magnet) continue;
    const { hash, size } = parseMagnet(dl.magnet);
    if (!hash) continue;
    const res = dl.res ? dl.res + "p" : "";
    const title = "[SubsPlease] " + entry.key + (res ? " (" + res + ")" : "");
    if (hitsExclusion(title, opts.exclusions)) continue;
    out.push({
      title,
      link: dl.magnet,
      hash,
      seeders: 0,
      leechers: 0,
      downloads: 0,
      size,
      date,
      accuracy: opts.batch ? "low" : tagAccuracy(opts.tier, date.getTime(), SOURCE_DEFAULT),
      type: opts.batch || opts.tier === "B" ? "batch" : void 0
    });
  }
  return out;
}
function episodeMatchesAny(entry, query) {
  const candidates = query.episodeCandidates;
  if (candidates && candidates.size) {
    for (const n of candidates) if (episodeMatches(entry.episode, n)) return true;
    return false;
  }
  return episodeMatches(entry.episode, query.episode);
}
async function runSearch(query, mode) {
  if (!query || !query.titles || !query.titles.length) return [];
  const ctx = searchContext(query, mode);
  const seenHashes = /* @__PURE__ */ new Set();
  const seenKeys = /* @__PURE__ */ new Set();
  const entries = [];
  for (const q of buildQueries(query.titles, { limit: 3 })) {
    let batch;
    try {
      batch = await searchApi(q);
    } catch (err) {
      if (entries.length) break;
      throw err;
    }
    for (const e of batch) {
      if (seenKeys.has(e.key)) continue;
      seenKeys.add(e.key);
      entries.push(e);
    }
    if (entries.length >= 50) break;
  }
  const build = (useCandidates) => {
    const epCtx = useCandidates ? ctx : { ...ctx, episodeCandidates: null };
    const shaped2 = [];
    for (const e of entries) {
      const tier = classifyResult(e.key, epCtx);
      if (tier === null) continue;
      const isBatch = isBatchEntry(e);
      if (mode === "batch" && !isBatch) continue;
      if (mode === "movie" && isBatch) continue;
      let effectiveTier = tier;
      if (mode === "single") {
        if (isBatch) effectiveTier = "B";
        else if (tier === "A" && !episodeMatchesAny(e, epCtx)) effectiveTier = "C";
      }
      shaped2.push({ entry: e, tier: effectiveTier });
    }
    return shaped2;
  };
  let shaped = build(false);
  if (!shaped.some((s) => s.tier === "A") && ctx.episodeCandidates?.size > 1) {
    const relaxed = build(true);
    if (relaxed.some((s) => s.tier === "A")) shaped = relaxed;
  }
  const out = [];
  for (const { entry, tier } of shaped) {
    const opts = { exclusions: ctx.exclusions, batch: mode === "batch", tier };
    for (const r of entryToResults(entry, opts)) {
      if (seenHashes.has(r.hash)) continue;
      seenHashes.add(r.hash);
      out.push({ ...r, _tier: tier });
    }
  }
  return finalize(out, ctx.resolution);
}
var subsplease_default = new class SubsPlease {
  async single(query) {
    if (query.episodeCount === 1) return runSearch(query, "movie");
    return runSearch(await withEpisodeCandidates(query), "single");
  }
  async batch(query) {
    return runSearch(query, "batch");
  }
  async movie(query) {
    return runSearch(query, "movie");
  }
  async test() {
    let res;
    try {
      res = await fetch(BASE + "?f=latest&tz=UTC");
    } catch (err) {
      throw new Error("Cannot reach SubsPlease. Check your internet connection or try again later.");
    }
    if (!res.ok) {
      throw new Error("SubsPlease returned HTTP " + res.status + ". The site may be down.");
    }
    return true;
  }
}();
export {
  subsplease_default as default
};
