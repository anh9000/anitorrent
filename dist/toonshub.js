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
async function collectFeed(queries, fetchItems, mapItem, ctx, sourceDefault, opts = {}) {
  const seen = /* @__PURE__ */ new Set();
  const collected = [];
  let shaped = [];
  let lastError = null;
  const absorb = (items) => {
    for (const raw of items) {
      const r = mapItem(raw);
      if (!r || seen.has(r.hash)) continue;
      seen.add(r.hash);
      collected.push(r);
    }
    shaped = shapeAll(collected, ctx, sourceDefault);
  };
  const foundEpisode = () => shaped.some((r) => r._tier === "A");
  const phase = async (qs, stopWhenFound) => {
    if (opts.parallel) {
      const settled = await Promise.allSettled(qs.map((q) => fetchItems(q)));
      const ok = [];
      for (const s of settled) {
        if (s.status === "rejected") lastError = s.reason;
        else ok.push(s.value);
      }
      for (const items of ok) absorb(items);
      return;
    }
    for (const q of qs) {
      try {
        absorb(await fetchItems(q));
      } catch (err) {
        lastError = err;
        if (err && err.rateLimited) return;
        continue;
      }
      if (stopWhenFound && foundEpisode()) return;
    }
  };
  await phase(queries.bases, false);
  if (!collected.length && lastError) throw lastError;
  if (queries.numbered.length && !foundEpisode()) await phase(queries.numbered, true);
  if (!collected.length && lastError) throw lastError;
  return shaped;
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
function decodeEntities(str) {
  return String(str).replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10))).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
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
  return decodeEntities(val).trim();
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
var RETRY_DELAYS = [1200, 3e3, 6e3];
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
    const ra = parseInt(res.headers && res.headers.get ? res.headers.get("retry-after") : "", 10);
    if (Number.isInteger(ra) && ra > 0 && ra <= 60) err.retryAfter = ra * 1e3;
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
  for (let attempt = 0; ; attempt++) {
    try {
      return await rssSearch(query);
    } catch (err) {
      if (!err.rateLimited || attempt >= RETRY_DELAYS.length) {
        if (err.rateLimited) {
          const fatal = new Error("Nyaa is rate limiting requests for the ToonsHub feed. Wait a moment and try again.");
          fatal.rateLimited = true;
          throw fatal;
        }
        throw err;
      }
      const base = err.retryAfter != null ? err.retryAfter : RETRY_DELAYS[attempt];
      await new Promise((r) => setTimeout(r, base + Math.floor(Math.random() * 400)));
    }
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
  const parsed = pubDate ? new Date(pubDate) : /* @__PURE__ */ new Date();
  const date = Number.isFinite(parsed.getTime()) ? parsed : /* @__PURE__ */ new Date(0);
  const trusted = /^yes$/i.test(pickTag(raw, "nyaa:trusted"));
  const remake = /^yes$/i.test(pickTag(raw, "nyaa:remake"));
  return {
    title,
    link: buildMagnet(hash, title),
    hash,
    seeders,
    leechers,
    downloads,
    size,
    date,
    _trusted: trusted,
    _remake: remake,
    accuracy: "high"
  };
}
async function runSearch(query, opts) {
  if (!query.titles || !query.titles.length) return [];
  if (query.notAired) return [];
  const mode = opts.batch ? "batch" : opts.movie ? "movie" : "single";
  const ctx = searchContext(query, mode);
  const queries = buildQueries(query.titles, { limit: 2, episode: opts.episode, anilistId: query.anilistId, episodeCandidates: query.episodeCandidates });
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
