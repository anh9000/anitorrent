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
  m = t.match(/(?:^|\s)(?:Part\s+)?([2-9])(?=\s*$|\s*[:\-|(\[])/i);
  if (m) return parseInt(m[1], 10);
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
  if (/\bs\d{1,2}e\d{1,3}\b/i.test(title)) return false;
  if (/\s-\s*\d{1,4}(?:v\d)?\s*(?:\[|\(|$)/.test(title)) return false;
  return BATCH_PATTERNS.some((re) => re.test(title));
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
function rank(results, resolution) {
  return results.sort((a, b) => {
    if (resolution) {
      const am = matchesResolution(a.title, resolution) ? 1 : 0;
      const bm = matchesResolution(b.title, resolution) ? 1 : 0;
      if (am !== bm) return bm - am;
    }
    const dt = (b.date?.getTime?.() || 0) - (a.date?.getTime?.() || 0);
    if (dt !== 0) return dt;
    return b.seeders - a.seeders;
  });
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
async function fetchByText(titles) {
  const seen = /* @__PURE__ */ new Map();
  const ordered = rankTitlesForQuery(titles).slice(0, 3);
  for (const title of ordered) {
    const q = trimTitleForQuery(title);
    if (!q) continue;
    let items;
    try {
      items = await tryFetch(BASE + "?q=" + encodeURIComponent(q));
    } catch (err) {
      if (seen.size) break;
      throw err;
    }
    for (const i of items) {
      const r = toResult(i, "medium");
      if (r && !seen.has(r.hash)) seen.set(r.hash, r);
    }
    if (seen.size >= 30) break;
  }
  return [...seen.values()];
}
function filterAndShape(raw, query, mode, showTokens, exclusions, minHits, showSeason, showYears) {
  let out = dedupe(raw).filter((r) => !hitsExclusion(r.title, exclusions)).filter((r) => resultMatchesShow(r.title, showTokens, minHits)).filter((r) => resultMatchesSeason(r.title, showSeason)).filter((r) => resultMatchesYear(r.title, showYears));
  if (mode === "single" && query.episode != null) {
    out = out.filter((r) => titleHasEpisode(r.title, query.episode));
  }
  if (mode === "batch") {
    out = out.filter((r) => looksLikeBatch(r.title)).map((r) => ({ ...r, type: "batch", accuracy: "low" }));
  }
  return out;
}
async function search(query, mode) {
  if (!query) return [];
  const exclusions = query.exclusions || [];
  const resolution = query.resolution || "";
  const showTokens = buildTitleTokens(query.titles || []);
  const showSeason = detectShowSeason(query.titles || []);
  const showYears = detectShowYears(query.titles || []);
  const minHits = showTokens.size >= 3 ? 2 : 1;
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
  let results = filterAndShape(raw, query, mode, showTokens, exclusions, minHits, showSeason, showYears);
  if (!results.length && (query.titles || []).length) {
    const textRaw = await fetchByText(query.titles);
    results = filterAndShape(textRaw, query, mode, showTokens, exclusions, minHits, showSeason, showYears);
  }
  return rank(results, resolution).slice(0, 30);
}
var animetosho_default = new class AnimeTosho {
  async single(query) {
    if (query.episodeCount === 1) return search(query, "movie");
    return search(query, "single");
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
