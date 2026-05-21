// src/lib/shared.js
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
  "shi"
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
function trimTitleForQuery(title) {
  const colon = title.indexOf(":");
  const base = colon > 0 ? title.slice(0, colon) : title;
  return significantTokens(base).slice(0, 4).join(" ") || escapeQuery(title);
}
function rankTitlesForQuery(titles) {
  const list = (titles || []).map((t) => {
    const stripped = String(t).replace(/\s/g, "");
    const ascii = escapeQuery(t).replace(/\s/g, "");
    const toks = significantTokens(t);
    const maxTok = toks.reduce((m, s) => Math.max(m, s.length), 0);
    return {
      t,
      tokens: toks.length,
      maxTok,
      signature: maxTok >= 4 ? toks.find((s) => s.length === maxTok) : "",
      despaced: escapeQuery(t).toLowerCase().replace(/\s/g, ""),
      asciiRatio: stripped.length ? ascii.length / stripped.length : 0
    };
  }).filter((x) => x.tokens > 0);
  for (const x of list) {
    x.recur = x.signature ? list.reduce((n, y) => {
      if (y === x || !y.signature) return n;
      const related = y.despaced.includes(x.signature) || x.despaced.includes(y.signature);
      return n + (related ? 1 : 0);
    }, 0) : 0;
  }
  const latin = list.filter((x) => x.asciiRatio >= 0.5);
  const pool = latin.length ? latin : list;
  return pool.sort((a, b) => (b.recur > 0) - (a.recur > 0) || b.maxTok - a.maxTok || b.tokens - a.tokens || b.asciiRatio - a.asciiRatio).map((x) => x.t);
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
      accuracy: "high",
      type: opts.batch ? "batch" : void 0
    });
  }
  return out;
}
async function runSearch(query, mode) {
  if (!query || !query.titles || !query.titles.length) return [];
  const showTokens = buildTitleTokens(query.titles);
  const exclusions = query.exclusions || [];
  const resolution = query.resolution || "";
  const ordered = rankTitlesForQuery(query.titles).slice(0, 3);
  const seenHashes = /* @__PURE__ */ new Set();
  const seenKeys = /* @__PURE__ */ new Set();
  const entries = [];
  for (const title of ordered) {
    const q = trimTitleForQuery(title);
    if (!q) continue;
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
  let filtered = entries.filter((e) => resultMatchesShow(e.key, showTokens, showTokens.size >= 3 ? 2 : 1));
  if (mode === "single") {
    filtered = filtered.filter((e) => !isBatchEntry(e) && episodeMatches(e.episode, query.episode));
  } else if (mode === "batch") {
    filtered = filtered.filter((e) => isBatchEntry(e));
  } else if (mode === "movie") {
    filtered = filtered.filter((e) => !isBatchEntry(e));
  }
  const opts = { exclusions, batch: mode === "batch" };
  const out = [];
  for (const e of filtered) {
    for (const r of entryToResults(e, opts)) {
      if (seenHashes.has(r.hash)) continue;
      seenHashes.add(r.hash);
      out.push(r);
    }
  }
  return out.sort((a, b) => {
    if (resolution) {
      const am = matchesResolution(a.title, resolution) ? 1 : 0;
      const bm = matchesResolution(b.title, resolution) ? 1 : 0;
      if (am !== bm) return bm - am;
    }
    const dt = (b.date?.getTime?.() || 0) - (a.date?.getTime?.() || 0);
    if (dt !== 0) return dt;
    return b.size - a.size;
  }).slice(0, 30);
}
var subsplease_default = new class SubsPlease {
  async single(query) {
    return runSearch(query, "single");
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
