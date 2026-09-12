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
var RELATION_NODE = "id episodes format title{romaji english}";
function nestedRelations(depth) {
  let inner = RELATION_NODE;
  for (let i = 0; i < depth; i++) {
    inner = RELATION_NODE + " relations{edges{relationType node{" + inner + "}}}";
  }
  return inner;
}
var CHAIN_QUERY = "query($id:Int){Media(id:$id){episodes status nextAiringEpisode{episode} relations{edges{relationType node{" + nestedRelations(2) + "}}}}}";
var STEP_QUERY = "query($id:Int){Media(id:$id){episodes format status nextAiringEpisode{episode} relations{edges{relationType node{" + RELATION_NODE + "}}}}}";
async function anilistQuery(query, id) {
  const body = JSON.stringify({ query, variables: { id } });
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 600 * attempt + Math.floor(Math.random() * 300)));
    let res;
    try {
      res = await fetch(ANILIST_API, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body
      });
    } catch {
      continue;
    }
    if (res.status === 429) return void 0;
    if (!res.ok) continue;
    let parsed;
    try {
      parsed = JSON.parse(await res.text());
    } catch {
      continue;
    }
    if (parsed && parsed.errors && !parsed.data) return void 0;
    const media = parsed && parsed.data && parsed.data.Media;
    return media || null;
  }
  return void 0;
}
function pickPrequel(node) {
  const edges = node && node.relations && node.relations.edges || [];
  return edges.filter((e) => e.relationType === "PREQUEL").map((e) => e.node).filter((n) => n && (n.format === "TV" || n.format === "ONA" || n.format === "TV_SHORT")).sort((a, b) => (b.episodes || 0) - (a.episodes || 0))[0];
}
function prequelEntry(node) {
  return {
    episodes: node.episodes,
    tokens: buildTitleTokens([node.title && node.title.romaji, node.title && node.title.english].filter(Boolean))
  };
}
function airingOf(media) {
  if (media && media.status === "RELEASING" && media.nextAiringEpisode) {
    const n = Number(media.nextAiringEpisode.episode);
    if (Number.isInteger(n) && n > 0) return n;
  }
  return null;
}
async function fetchPrequelChain(anilistId) {
  const root = await anilistQuery(CHAIN_QUERY, Number(anilistId));
  if (root === void 0) return walkFrom(Number(anilistId), [], null, /* @__PURE__ */ new Set());
  if (!root) return { counts: [], nextAiring: null, ok: true };
  const nextAiring = airingOf(root);
  const counts = [];
  const seen = /* @__PURE__ */ new Set([Number(anilistId)]);
  let node = root;
  let lastId = Number(anilistId);
  while (counts.length < 12) {
    const prequel = pickPrequel(node);
    if (!prequel || !prequel.episodes || seen.has(prequel.id)) break;
    counts.push(prequelEntry(prequel));
    seen.add(prequel.id);
    lastId = prequel.id;
    if (prequel.relations === void 0) break;
    node = prequel;
  }
  if (!counts.length) return { counts, nextAiring, ok: true };
  const rest = await walkFrom(lastId, counts, nextAiring, seen);
  return rest;
}
async function walkFrom(startId, counts, nextAiring, seen) {
  let ok = true;
  let current = startId;
  for (let depth = 0; depth < 12 && current; depth++) {
    const media = await anilistQuery(STEP_QUERY, current);
    if (media === void 0) {
      ok = false;
      break;
    }
    if (!media) break;
    if (depth === 0 && nextAiring == null) nextAiring = airingOf(media);
    const prequel = pickPrequel(media);
    if (!prequel || !prequel.episodes || seen.has(prequel.id)) break;
    counts.push(prequelEntry(prequel));
    seen.add(prequel.id);
    current = prequel.id;
  }
  return { counts, nextAiring, ok };
}
async function getChain(anilistId) {
  const key = String(anilistId);
  if (!offsetCache.has(key)) {
    offsetCache.set(key, fetchPrequelChain(anilistId).catch(() => ({ counts: [], nextAiring: null, ok: false })));
  }
  let chain;
  try {
    chain = await offsetCache.get(key);
  } catch {
    chain = null;
  }
  if (!chain || chain.ok === false) {
    offsetCache.delete(key);
    return { counts: [], nextAiring: null, ok: false };
  }
  return chain;
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
  const chain = await getChain(query.anilistId);
  const next = chain && chain.nextAiring;
  return Number.isInteger(next) && ep >= next;
}
async function resolveEpisodeCandidates(query) {
  const ep = Number(query.episode);
  if (!Number.isInteger(ep) || !query.anilistId) return null;
  const chain = await getChain(query.anilistId);
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
var CANDIDATE_WINDOW_MS = 7 * 24 * 60 * 60 * 1e3;
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
function toEntries(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return [];
  return Object.entries(data).map(([key, entry]) => ({ key, ...entry }));
}
async function fetchApi(url) {
  let res;
  try {
    res = await fetch(url);
  } catch (err) {
    throw new Error("Cannot reach SubsPlease. Check your internet connection or try again later.");
  }
  if (!res.ok) {
    throw new Error("SubsPlease returned HTTP " + res.status + ". The site may be down.");
  }
  const text = (await res.text()).trim();
  if (!text) return null;
  try {
    return toEntries(JSON.parse(text));
  } catch (err) {
    return null;
  }
}
async function searchApi(q) {
  const found = await fetchApi(BASE + "?f=search&tz=UTC&s=" + encodeURIComponent(q));
  return found || [];
}
var latestCache = null;
async function latestApi() {
  if (!latestCache) {
    latestCache = fetchApi(BASE + "?f=latest&tz=UTC").catch(() => null);
  }
  const entries = await latestCache;
  if (!entries) latestCache = null;
  return entries || [];
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
  if (query.notAired) return [];
  const ctx = searchContext(query, mode);
  const seenHashes = /* @__PURE__ */ new Set();
  const seenKeys = /* @__PURE__ */ new Set();
  const entries = [];
  const settled = await Promise.allSettled(
    buildQueries(query.titles, { limit: 3, anilistId: query.anilistId }).bases.map((q) => searchApi(q))
  );
  let lastError = null;
  for (const s of settled) {
    if (s.status === "rejected") {
      lastError = s.reason;
      continue;
    }
    for (const e of s.value) {
      if (seenKeys.has(e.key)) continue;
      seenKeys.add(e.key);
      entries.push(e);
    }
  }
  if (!entries.length && lastError) throw lastError;
  if (!entries.length) {
    for (const e of await latestApi()) {
      if (seenKeys.has(e.key)) continue;
      seenKeys.add(e.key);
      entries.push(e);
    }
  }
  const build = (candidateSet) => {
    const epCtx = candidateSet ? { ...ctx, episodeCandidates: candidateSet } : { ...ctx, episodeCandidates: null };
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
  let shaped = build(null);
  if (!shaped.some((s) => s.tier === "A") && ctx.episodeCandidates && ctx.episodeCandidates.size) {
    let best = null;
    for (const n of ctx.episodeCandidates) {
      const cand = build(/* @__PURE__ */ new Set([n]));
      const hits = cand.filter((x) => x.tier === "A");
      if (!hits.length) continue;
      let newest = 0;
      for (const h of hits) {
        const t = new Date(h.entry.release_date || 0).getTime();
        if (Number.isFinite(t) && t > newest) newest = t;
      }
      if (!best || newest > best.newest) best = { newest, shaped: cand, episode: n };
    }
    if (best) {
      shaped = best.shaped;
      ctx.chosenEpisodes = /* @__PURE__ */ new Set([best.episode]);
      ctx.offsetResolved = best.episode !== ctx.episode;
    }
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
  return finalize(out, ctx);
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
