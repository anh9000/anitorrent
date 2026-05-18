// src/seadex.js
var BASE = "https://releases.moe/api/collections/entries/records";
var TRACKERS = [
  "udp://tracker.opentrackr.org:1337/announce",
  "udp://open.stealth.si:80/announce",
  "udp://tracker.torrent.eu.org:451/announce",
  "udp://exodus.desync.com:6969/announce",
  "http://nyaa.tracker.wf:7777/announce"
];
function buildMagnet(hash, name) {
  const trackers = TRACKERS.map((t) => "tr=" + encodeURIComponent(t)).join("&");
  const dn = name ? "&dn=" + encodeURIComponent(name) : "";
  return "magnet:?xt=urn:btih:" + hash.toLowerCase() + dn + "&" + trackers;
}
function totalSize(files) {
  if (!Array.isArray(files)) return 0;
  let s = 0;
  for (const f of files) {
    const len = Number(f && f.length);
    if (Number.isFinite(len)) s += len;
  }
  return s;
}
function firstFilename(files) {
  if (!Array.isArray(files) || !files.length) return "";
  const f = files.find((x) => x && x.name);
  return f ? f.name : "";
}
function cleanReleaseTitle(filename) {
  if (!filename) return "";
  return filename.replace(/\s*-?\s*S\d{1,2}E\d{1,3}(?:v\d)?\b/gi, "").replace(/\s+-\s+\d{1,4}(?:v\d)?\b/g, "").replace(/\.(mkv|mp4|avi|m2ts|webm)$/i, "").replace(/\s+/g, " ").trim();
}
function isBatchRelease(files) {
  if (!Array.isArray(files)) return false;
  const videoFiles = files.filter((f) => f && f.name && /\.(mkv|mp4|avi|m2ts|webm)$/i.test(f.name));
  if (videoFiles.length > 1) return true;
  return totalSize(files) > 10 * 1024 ** 3;
}
async function fetchByAnilist(anilistId) {
  const url = BASE + "?expand=trs&perPage=10&filter=" + encodeURIComponent("(alID=" + Number(anilistId) + ")");
  let res;
  try {
    res = await fetch(url);
  } catch (err) {
    throw new Error("Cannot reach Seadex. Check your internet connection or try again later.");
  }
  if (!res.ok) {
    throw new Error("Seadex returned HTTP " + res.status + ". The service may be down.");
  }
  let data;
  try {
    data = await res.json();
  } catch (err) {
    throw new Error("Seadex returned an unexpected response.");
  }
  if (!data || !Array.isArray(data.items)) return [];
  return data.items;
}
function flattenTrs(items) {
  const out = [];
  for (const entry of items) {
    const trs = entry && entry.expand && entry.expand.trs;
    if (!Array.isArray(trs)) continue;
    for (const tr of trs) {
      if (!tr || !tr.infoHash) continue;
      out.push(tr);
    }
  }
  return out;
}
function toResult(tr) {
  const hash = String(tr.infoHash || "").toLowerCase();
  if (!hash) return null;
  const cleanName = cleanReleaseTitle(firstFilename(tr.files));
  const group = tr.releaseGroup ? "[" + tr.releaseGroup + "] " : "";
  const dual = tr.dualAudio ? " (Dual Audio)" : "";
  const title = group + (cleanName || tr.releaseGroup || "release") + dual;
  const batch = isBatchRelease(tr.files);
  return {
    title,
    link: buildMagnet(hash, cleanName),
    hash,
    seeders: 0,
    leechers: 0,
    downloads: 0,
    size: totalSize(tr.files),
    date: tr.created ? new Date(tr.created) : /* @__PURE__ */ new Date(),
    accuracy: "high",
    type: tr.isBest ? "best" : batch ? "batch" : "alt"
  };
}
async function search(query) {
  if (!query || !query.anilistId) return [];
  const items = await fetchByAnilist(query.anilistId);
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const tr of flattenTrs(items)) {
    const r = toResult(tr);
    if (!r || seen.has(r.hash)) continue;
    seen.add(r.hash);
    out.push(r);
  }
  return out;
}
var seadex_default = new class Seadex {
  async single(query) {
    return search(query);
  }
  async batch(query) {
    return search(query);
  }
  async movie(query) {
    return search(query);
  }
  async test() {
    let res;
    try {
      res = await fetch(BASE + "?perPage=1");
    } catch (err) {
      throw new Error("Cannot reach Seadex. Check your internet connection or try again later.");
    }
    if (!res.ok) {
      throw new Error("Seadex returned HTTP " + res.status + ". The service may be down.");
    }
    return true;
  }
}();
export {
  seadex_default as default
};
