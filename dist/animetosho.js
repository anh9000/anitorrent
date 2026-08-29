// src/lib/aliases.js
var TITLE_ALIASES = {
  185874: ["bleach sennen kessen", "bleach thousand year blood war"],
  108632: ["re zero kara hajimeru", "rezero starting life"],
  21: ["one piece"],
  235: ["detective conan", "meitantei conan"]
};
function aliasTitles(anilistId) {
  const n = Number(anilistId);
  if (!Number.isInteger(n)) return [];
  const list = TITLE_ALIASES[n];
  return Array.isArray(list) ? list.slice() : [];
}

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
function showNamePart(title) {
  let t = String(title || "").replace(/^\s*[[(\u3010][^\])\u3011]*[\])\u3011]\s*/, "");
  const m = t.match(/^(.*?)(?=(?:[\s._][-~]\s*\d{1,4}(?:v\d)?(?:[\s[(]|$))|(?:\s*\bS\d{1,2}E\d{1,4}\b)|(?:\s*\bEP\s*\d{1,4}\b))(?![\s\S]*(?:[\s._][-~]\s*\d{1,4}(?:v\d)?(?:[\s[(]|$)|\s*\bS\d{1,2}E\d{1,4}\b|\s*\bEP\s*\d{1,4}\b))/i);
  if (m && m[1].trim()) return m[1].trim();
  const simple = t.split(/[[(]/)[0];
  return (simple || t).trim();
}
function nameIntroducesForeignWord(title, tokens) {
  for (const tok of significantTokens(showNamePart(title))) {
    if (/^\d+$/.test(tok)) continue;
    if (!tokens.has(tok)) return true;
  }
  return false;
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
var ROMAN_SEASON = { II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9 };
function detectResultSeason(title) {
  const t = String(title || "");
  let m = t.match(/\bS(\d{1,2})(?:E\d|\b)/i);
  if (m) return parseInt(m[1], 10);
  m = t.match(/\b(?:Season\s+(\d+)|(\d+)(?:st|nd|rd|th)\s+Season)\b/i);
  if (m) return parseInt(m[1] || m[2], 10);
  m = t.match(/\b[A-Za-z0-9]+\s+(II|III|IV|V|VI|VII|VIII|IX)(?=\s|:|\.|-|$|\[|\()/);
  if (m) return ROMAN_SEASON[m[1]];
  const digitRE = /\b([2-9])(?=\s*$|\s*[:\-|(\[])/g;
  let dm;
  while ((dm = digitRE.exec(t)) !== null) {
    const before = t.slice(Math.max(0, dm.index - 8), dm.index).toLowerCase();
    if (/\bpart\s+$/.test(before)) continue;
    if (/^-[A-Za-z]/.test(t.slice(dm.index + 1))) continue;
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
function seasonMarkerTokens(titles) {
  const list = titles || [];
  const franchise = /* @__PURE__ */ new Set();
  for (const t of list) {
    const raw = String(t);
    const colon = raw.indexOf(":");
    for (const tok of significantTokens(colon > 0 ? raw.slice(0, colon) : raw)) franchise.add(tok);
  }
  const marks = /* @__PURE__ */ new Set();
  for (const t of list) {
    const raw = String(t);
    if (detectResultSeason(raw) != null) continue;
    const colon = raw.indexOf(":");
    if (colon <= 0) continue;
    if (!significantTokens(raw.slice(0, colon)).length) continue;
    for (const tok of significantTokens(raw.slice(colon + 1))) {
      if (!franchise.has(tok)) marks.add(tok);
    }
  }
  return marks;
}
function resultMatchesSeason(title, showSeason, markerTokens) {
  const rs = detectResultSeason(title);
  if (showSeason > 1) {
    if (rs === showSeason) return true;
    if (rs != null) return false;
    if (markerTokens && markerTokens.size && resultMatchesShow(title, markerTokens, 1)) return true;
    return false;
  }
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
    if (bases.length >= limit) break;
    const q = trimTitleForQuery(title);
    if (!q || seen.has(q)) continue;
    seen.add(q);
    bases.push(q);
    if (bases.length >= limit) break;
  }
  const rescue = [];
  for (const alias of aliasTitles(opts.anilistId)) {
    const a = String(alias).trim();
    if (!a || seen.has(a)) continue;
    seen.add(a);
    rescue.push(a);
  }
  const epNumbers = [];
  if (opts.episodeCandidates && opts.episodeCandidates.size) {
    for (const n of opts.episodeCandidates) epNumbers.push(n);
  } else if (opts.episode != null) {
    epNumbers.push(opts.episode);
  }
  const withEp = (q) => epNumbers.map((n) => q + " " + pad(n));
  const numbered = [
    ...bases.flatMap(withEp),
    ...rescue,
    ...rescue.flatMap(withEp)
  ];
  return { bases, numbered };
}
var ANILIST_API = "https://graphql.anilist.co";
var offsetCache = /* @__PURE__ */ new Map();
async function fetchPrequelChain(anilistId) {
  const seen = /* @__PURE__ */ new Set();
  const counts = [];
  let nextAiring = null;
  let current = Number(anilistId);
  for (let depth = 0; depth < 12 && current && !seen.has(current); depth++) {
    seen.add(current);
    const body = JSON.stringify({
      query: "query($id:Int){Media(id:$id){episodes format status nextAiringEpisode{episode} relations{edges{relationType node{id episodes format title{romaji english}}}}}}",
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
    if (depth === 0 && media.status === "RELEASING" && media.nextAiringEpisode) {
      const n = Number(media.nextAiringEpisode.episode);
      if (Number.isInteger(n) && n > 0) nextAiring = n;
    }
    const prequel = (media.relations?.edges || []).filter((e) => e.relationType === "PREQUEL").map((e) => e.node).filter((n) => n && (n.format === "TV" || n.format === "ONA" || n.format === "TV_SHORT")).sort((a, b) => (b.episodes || 0) - (a.episodes || 0))[0];
    if (!prequel || !prequel.episodes) break;
    counts.push({
      episodes: prequel.episodes,
      tokens: buildTitleTokens([prequel.title?.romaji, prequel.title?.english].filter(Boolean))
    });
    current = prequel.id;
  }
  return { counts, nextAiring };
}
function sharesSubSeries(showTokens, prequelTokens) {
  if (!showTokens || !showTokens.size || !prequelTokens || !prequelTokens.size) return true;
  let shared = 0;
  for (const t of prequelTokens) if (showTokens.has(t)) shared++;
  return shared / showTokens.size >= 0.5;
}
async function episodeNotAired(query) {
  const ep = Number(query.episode);
  if (!Number.isInteger(ep) || !query.anilistId) return false;
  const key = String(query.anilistId);
  if (!offsetCache.has(key)) {
    offsetCache.set(key, fetchPrequelChain(query.anilistId).catch(() => ({ counts: [], nextAiring: null })));
  }
  const chain = await offsetCache.get(key);
  const next = chain && chain.nextAiring;
  return Number.isInteger(next) && ep >= next;
}
async function resolveEpisodeCandidates(query) {
  const ep = Number(query.episode);
  if (!Number.isInteger(ep) || !query.anilistId) return null;
  const key = String(query.anilistId);
  if (!offsetCache.has(key)) {
    offsetCache.set(key, fetchPrequelChain(query.anilistId).catch(() => ({ counts: [], nextAiring: null })));
  }
  const chain = await offsetCache.get(key);
  const candidates = /* @__PURE__ */ new Set([ep]);
  const showTokens = buildTitleTokens(query.titles || []);
  let running = 0;
  const list = chain && chain.counts || [];
  for (let i = 0; i < list.length; i++) {
    const entry = list[i];
    const count = typeof entry === "number" ? entry : entry.episodes;
    const tokens = typeof entry === "number" ? null : entry.tokens;
    if (!count) continue;
    const crossesRoot = !sharesSubSeries(showTokens, tokens);
    if (crossesRoot && running >= 10) candidates.add(ep + running);
    running += count;
  }
  if (running >= 10) candidates.add(ep + running);
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
    seasonMarks: seasonMarkerTokens(titles),
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
  if (tier === "B" || looksLikeBatch(r.title)) out.type = "batch";
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
  const scored = [];
  for (const n of ctx.episodeCandidates) {
    const shaped = shape({ ...ctx, episodeCandidates: /* @__PURE__ */ new Set([n]) });
    const newest = newestOf(shaped);
    if (newest == null) continue;
    scored.push({ newest, shaped, episode: n });
  }
  if (!scored.length) return exact;
  let best = scored[0];
  for (const c of scored) if (c.newest > best.newest) best = c;
  const kept = scored.filter((c) => best.newest - c.newest <= CANDIDATE_WINDOW_MS);
  const chosen = new Set(kept.map((c) => c.episode));
  ctx.chosenEpisodes = chosen;
  ctx.offsetResolved = !chosen.has(ctx.episode);
  if (kept.length === 1) return best.shaped;
  const merged = /* @__PURE__ */ new Map();
  for (const c of kept) {
    for (const r of c.shaped) {
      const prev = merged.get(r.hash);
      if (!prev || r._tier < prev._tier) merged.set(r.hash, r);
    }
  }
  return [...merged.values()];
}
var CANDIDATE_WINDOW_MS = 7 * 24 * 60 * 60 * 1e3;
function newestOf(results) {
  let newest = null;
  for (const r of results) {
    if (r._tier !== "A") continue;
    const t = r.date?.getTime?.() || 0;
    if (newest == null || t > newest) newest = t;
  }
  return newest;
}
function timeOf(r) {
  const t = r.date && typeof r.date.getTime === "function" ? r.date.getTime() : 0;
  return Number.isFinite(t) ? t : 0;
}
function qualityRank(r) {
  if (r._remake) return 2;
  if (r._trusted) return 0;
  return 1;
}
function sortResults(results, resolution) {
  const hasExact = results.some((r) => r._tier === "A");
  const sorted = results.slice();
  return sorted.sort((a, b) => {
    if (hasExact && a._tier !== b._tier) return a._tier < b._tier ? -1 : 1;
    if (resolution) {
      const am = matchesResolution(a.title, resolution) ? 1 : 0;
      const bm = matchesResolution(b.title, resolution) ? 1 : 0;
      if (am !== bm) return bm - am;
    }
    if (!hasExact) {
      const dt = timeOf(b) - timeOf(a);
      if (dt !== 0) return dt;
    }
    const qr = qualityRank(a) - qualityRank(b);
    if (qr !== 0) return qr;
    const sd = (b.seeders || 0) - (a.seeders || 0);
    if (sd !== 0) return sd;
    return timeOf(b) - timeOf(a);
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
    const showSeason = typeof ctx === "string" || ctx && ctx.offsetResolved ? null : ctx.showSeason;
    kept = results.filter((r) => !hasConflictingEpisode(r.title, wanted)).filter((r) => resultMatchesSeason(r.title, showSeason, typeof ctx === "string" ? null : ctx.seasonMarks)).map((r) => ({ ...r, accuracy: "low" }));
  }
  return sortResults(kept, resolution).slice(0, limit).map(stripInternal);
}
function stripInternal(r) {
  const out = {};
  for (const k of Object.keys(r)) {
    if (k.charCodeAt(0) === 95) continue;
    out[k] = r[k];
  }
  return out;
}
function wantedEpisodes(ctx) {
  if (!ctx || ctx.mode !== "single" || ctx.episode == null) return null;
  return ctx.chosenEpisodes || /* @__PURE__ */ new Set([ctx.episode]);
}
async function withEpisodeCandidates(query) {
  try {
    const episodeCandidates = await resolveEpisodeCandidates(query);
    const notAired = await episodeNotAired(query);
    const out = notAired ? { ...query, notAired: true } : query;
    if (!episodeCandidates || episodeCandidates.size <= 1) return out;
    return { ...out, episodeCandidates };
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
  const raw = String(title || "");
  const colon = raw.indexOf(":");
  const base = colon > 0 ? raw.slice(0, colon) : raw;
  const fromBase = significantTokens(base).slice(0, 4).join(" ");
  if (fromBase) return fromBase;
  const baseWords = escapeQuery(base).split(/\s+/).filter(Boolean);
  const usePreColon = baseWords.length >= 2;
  const source = usePreColon ? baseWords : escapeQuery(raw).split(/\s+/).filter(Boolean);
  const trimmed = source.slice(0, 4);
  if (!usePreColon) {
    while (trimmed.length > 1 && STOPWORDS.has(trimmed[trimmed.length - 1].toLowerCase())) trimmed.pop();
  }
  const words = trimmed.join(" ");
  return words || escapeQuery(raw);
}
function rankTitlesForQuery(titles) {
  const list = (titles || []).filter((t) => typeof t === "string" && t.trim()).map((t, i) => {
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
function usesOffsetEpisode(opts) {
  const c = opts && opts.episodeCandidates;
  return !!(c && c.size === 1 && opts.episode != null && !c.has(opts.episode));
}
function batchCoversEpisode(title, opts) {
  const wanted = [];
  const c = opts.episodeCandidates;
  if (c && c.size) for (const n of c) wanted.push(n);
  else if (opts.episode != null) wanted.push(opts.episode);
  if (!wanted.length) return false;
  const markers = titleEpisodeMarkers(title);
  for (const [lo, hi] of markers) {
    if (hi <= lo) continue;
    for (const w of wanted) if (w >= lo && w <= hi) return true;
  }
  return false;
}
function classifyResult(title, opts) {
  const showTokens = opts.showTokens;
  const minHits = opts.minHits != null ? opts.minHits : showTokens && showTokens.size >= 3 ? 2 : 1;
  if (!resultMatchesShow(title, showTokens, minHits)) return null;
  if (showTokens && showTokens.size === 1 && nameIntroducesForeignWord(title, showTokens)) return null;
  const offset = usesOffsetEpisode(opts);
  const seasonOk = offset || resultMatchesSeason(title, opts.showSeason, opts.seasonMarks);
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
  if (seasonOk && yearOk && isBatch && batchCoversEpisode(title, opts)) return "B";
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
async function fetchByText(titles, episode, foundEpisode, anilistId) {
  const { bases, numbered } = buildQueries(titles, { limit: 2, episode, anilistId });
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
  if (query.notAired) return [];
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
    for (const r of classifyAndTag(await fetchByText(query.titles, query.episode, foundEpisode, query.anilistId), ctx)) {
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
