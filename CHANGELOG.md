# Changelog

All notable changes to this repo are tracked here. Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versions follow [SemVer](https://semver.org/) per source.

Per-source versions live in `hayase/index.json` and `shiru/index.json`. Repo-level tags wrap shipping batches.

## [1.1.1] - 2026-05-18

### Fixed

- **nyaa 1.0.3** — Was returning only 4 of 15+ available episode releases. Two root causes, both fixed:
  - Nyaa's tokenizer treats `S01E07` as a single token, so passing `07` in the search query filtered out every release using `S01E07` notation. Fix: two-pass query per title (once without episode for `S01E07`-style, once with episode for `- 07`-style), merged by infoHash.
  - Query was sorted by `s=seeders&o=desc`, so fresh weekly drops with low seeder counts were pushed off the first 75-item page. Fix: `s=id&o=desc` (newest first), matching the default nyaa.si browse experience.
  - Local ranking key order is now: resolution match desc, then date desc, then seeders desc.

### Changed

- **animetosho 1.0.1** — Same ranking change: resolution match desc, then date desc, then seeders desc. Surfaces freshly indexed releases ahead of older popular ones.

## [1.1.0] - 2026-05-18

### Added

- **AnimeTosho** (`animetosho 1.0.0`, accuracy: high). Uses AnimeTosho's JSON API. Looks up by anidb_eid when Hayase provides one (high accuracy via exact episode-ID mapping). Falls back to anidb_aid for batches/movies. Falls back further to text search if no IDs available.
- **Seadex** (`seadex 1.0.0`, accuracy: high). Queries releases.moe by AniList ID. Returns the community-curated best releases per show, tagged `type: 'best'` for `isBest` entries and `type: 'batch'` for multi-file releases. Cleans episode-specific suffixes from filenames (no more misleading "S01E01" titles on season packs).
- `tsup` multi-entry build: nyaa + animetosho + seadex bundled into separate `dist/` outputs.

### Fixed

- **nyaa 1.0.2** — Strict episode filter in `single` mode. Previously, the episode number was only a ranking hint and nyaa's full-text search would surface ep 06 or ep 01 results when the user asked for ep 7. Now drops any result whose title doesn't contain the requested episode number (with common delimiters: ` 07 `, `-07-`, `E07`, `S01E07`, `.07.`, `[07]`, etc.).

## [1.0.1] - 2026-05-18

### Fixed

- **nyaa 1.0.1** — Stopped returning unrelated shows in search results. Three changes:
  - Trim long titles at the first colon and cap at 4 significant words before querying nyaa (so "Nippon Sangoku: The Three Nations of the Crimson Sun" becomes `nippon sangoku`, not an 11-token soup).
  - Drop resolution from the query string. It only diluted nyaa's full-text match. Still used for ranking.
  - Post-filter: every result title must contain at least one significant ≥3-char non-stopword from one of the show's titles. Drops anything that snuck in on episode/resolution token alone.
  - Try the shortest title first since fansub release groups use short names.

### Changed

- License switched from MIT to GPL-3.0.

## [1.0.0] - 2026-05-18

### Added

- Initial release. **nyaa 1.0.0** (accuracy: medium). Searches `nyaa.si` directly via its RSS endpoint (no third-party proxies). Builds magnet links locally from infohash + 7 standard public trackers. Honors `exclusions` and ranks by `resolution`. Supports `single`, `batch`, `movie`, and `test`.
- Dual-manifest layout: `hayase/index.json` declares `manifestVersion: 2` for Hayase; `shiru/index.json` uses the Shiru manifest format. One shared `dist/nyaa.js` works in both apps.
- GitHub Actions workflow rebuilds `dist/` automatically on every push that touches `src/`, `package.json`, or `tsup.config.js`.

[1.1.1]: https://github.com/anh9000/anitorrent/releases/tag/v1.1.1
[1.1.0]: https://github.com/anh9000/anitorrent/releases/tag/v1.1.0
[1.0.1]: https://github.com/anh9000/anitorrent/compare/a7cef7d...20beb65
[1.0.0]: https://github.com/anh9000/anitorrent/commit/a7cef7d
