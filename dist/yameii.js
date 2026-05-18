// src/yameii.js
var NYAA_BASE = "https://nyaa.si";
var UPLOADER = "Yameii";
var ANIME_CATEGORY = "1_2";
var TRACKERS = [
  "udp://tracker.opentrackr.org:1337/announce",
  "udp://open.stealth.si:80/announce",
  "udp://tracker.torrent.eu.org:451/announce",
  "udp://exodus.desync.com:6969/announce",
  "http://nyaa.tracker.wf:7777/announce"
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
  "special"
]);
var BATCH_PATTERNS = [
  /\bbatch\b/i,
  /\bcomplete\b/i,
  /\bseason\s*\d+\b/i,
  /\bs\d{1,2}\b(?!\s*e\d)/i,
  /\b\d{1,3}\s*[-~]\s*\d{1,3}\b/
];
function escapeQuery(str) {
  return String(str || "").replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
}
function significantTokens(title) {
  return escapeQuery(title).toLowerCase().split(/\s+/).filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}
function trimTitleForQuery(title) {
  const colon = title.indexOf(":");
  const base = colon > 0 ? title.slice(0, colon) : title;
  return significantTokens(base).slice(0, 4).join(" ") || escapeQuery(title);
}
function buildTitleTokens(titles) {
  const tokens = /* @__PURE__ */ new Set();
  for (const t of titles) {
    for (const tok of significantTokens(t)) tokens.add(tok);
  }
  return tokens;
}
function resultMatchesShow(title, tokens) {
  if (!tokens.size) return true;
  const lower = title.toLowerCase();
  for (const tok of tokens) {
    if (lower.includes(tok)) return true;
  }
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
  return BATCH_PATTERNS.some((re) => re.test(title));
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
  return "magnet:?xt=urn:btih:" + hash.toLowerCase() + dn + "&" + trackers;
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
async function rssSearch(query) {
  const qs = "?u=" + encodeURIComponent(UPLOADER) + "&page=rss" + (query ? "&q=" + encodeURIComponent(query) : "") + "&c=" + ANIME_CATEGORY + "&s=id&o=desc";
  const url = NYAA_BASE + "/" + qs;
  const res = await fetch(url);
  if (res.status === 429) {
    const err = new Error("429");
    err.rateLimited = true;
    throw err;
  }
  if (!res.ok) {
    throw new Error("Nyaa returned HTTP " + res.status + " for the Yameii feed. The site may be down or blocked on your network.");
  }
  const text = await res.text();
  if (!text.includes("<rss") && !text.includes("<item>")) {
    throw new Error("Nyaa returned an unexpected response for the Yameii feed.");
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
          throw new Error("Nyaa is rate limiting requests for the Yameii feed. Wait a moment and try again.");
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
function rankResults(results, resolution) {
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
function titlesByLengthAsc(titles) {
  return [...titles].sort((a, b) => a.length - b.length);
}
function queryVariantsForTitle(title) {
  const base = trimTitleForQuery(title);
  if (!base) return [];
  return [base];
}
async function runSearch(query, opts) {
  if (!query.titles || !query.titles.length) return [];
  const exclusions = query.exclusions || [];
  const resolution = query.resolution || "";
  const showTokens = buildTitleTokens(query.titles);
  const seen = /* @__PURE__ */ new Set();
  const results = [];
  const titles = titlesByLengthAsc(query.titles).slice(0, 2);
  for (const title of titles) {
    const variants = queryVariantsForTitle(title);
    for (const q of variants) {
      let items;
      try {
        items = await rssSearchWithRetry(q);
      } catch (err) {
        if (results.length) return rankResults(results, resolution).slice(0, 30);
        throw err;
      }
      for (const raw of items) {
        const r = itemToResult(raw, { exclusions });
        if (!r) continue;
        if (seen.has(r.hash)) continue;
        if (!resultMatchesShow(r.title, showTokens)) continue;
        if (opts.episode != null && !opts.batch && !opts.movie && !titleHasEpisode(r.title, opts.episode)) continue;
        seen.add(r.hash);
        results.push(r);
      }
    }
    if (results.length >= 10) break;
  }
  return rankResults(results, resolution).slice(0, 30);
}
var yameii_default = new class Yameii {
  async single(query) {
    return runSearch(query, { episode: query.episode });
  }
  async batch(query) {
    const results = await runSearch(query, { batch: true });
    return results.filter((r) => looksLikeBatch(r.title)).map((r) => ({ ...r, type: "batch" }));
  }
  async movie(query) {
    return runSearch(query, { movie: true });
  }
  async test() {
    const url = NYAA_BASE + "/?u=" + encodeURIComponent(UPLOADER) + "&page=rss&c=" + ANIME_CATEGORY;
    let res;
    try {
      res = await fetch(url);
    } catch (err) {
      throw new Error("Cannot reach nyaa.si. Check your internet connection or try again later.");
    }
    if (!res.ok) {
      throw new Error("Nyaa returned HTTP " + res.status + " for the Yameii feed.");
    }
    return true;
  }
}();
export {
  yameii_default as default
};
