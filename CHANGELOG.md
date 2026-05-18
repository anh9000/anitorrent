# Changelog

All notable changes to this repo are tracked here. Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versions follow [SemVer](https://semver.org/) per source.

Per-source versions live in `hayase/index.json` and `shiru/index.json`. Repo-level tags wrap shipping batches.

## [1.5.4] - 2026-05-18 (stable)

Marks the first stable, audited release. Full code audit done across all six sources, manifests, build pipeline, mapping pipeline, and CI workflows. One bug found and fixed (below). Comprehensive smoke test run across six shows × six sources, zero garbage results, zero unexpected failures.

### Fixed

- **nyaa 1.0.9**, **yameii 1.0.6**, **toonshub 1.0.3**. The three nyaa-based sources' `rssSearch()` was calling `await fetch(url)` without a try/catch wrapper. If the user lost connectivity mid-search, they'd see a raw `TypeError` instead of the friendly "Cannot reach nyaa.si" message that animetosho/seadex/subsplease already had. Added consistent network-error wrapping.

### Stable surface

| Source | Version | Accuracy | Catalog |
|---|---|---|---|
| Nyaa | 1.0.9 | medium | Universal firehose, every anime upload |
| AnimeTosho | 1.0.4 | high | Anidb-indexed aggregator, batch packs |
| Seadex | 1.0.1 | high | Community-curated best-release picks |
| SubsPlease | 1.0.2 | high | Currently-airing weekly fansubs |
| Yameii (Dubs) | 1.0.6 | high | English-dub re-encodes from the Yameii uploader |
| ToonsHub | 1.0.3 | high | ToonsHub group dual-audio + multi-sub releases |

All six sources declare `manifestVersion: 2`, `media: "both"`, `languages: ["ALL"]`, and have consistent error handling, rate-limit retry, and result filtering.

## [1.5.3] - 2026-05-18

### Fixed

- **Nyaa rate-limiting (HTTP 429) on parallel searches** (nyaa 1.0.8, yameii 1.0.5, toonshub 1.0.2). When Hayase fires a search to all enabled sources at once, the three nyaa-based extensions (Nyaa, Yameii, ToonsHub) were collectively hammering nyaa.si with up to 18 parallel requests. Nyaa rate-limited some of them with 429, causing user-visible "Yameii encountered an error" splash. Two fixes shipped together:
  - **All three sources now retry once on 429 after a 1.5s backoff.** Transient rate limits resolve automatically. Only if the retry also 429s does the user see an error, with a friendlier message asking them to wait.
  - **Yameii and ToonsHub now use a single query per title** instead of the two-pass (`<title>` + `<title> <episode>`) the nyaa source needs. Yameii is uploader-filtered (`?u=Yameii`) and ToonsHub is title-prefix-filtered (`?q=[ToonsHub]`), both narrow enough that the single-pass query reliably hits the right releases. Cuts their per-search request count in half.
  - Title-attempt cap dropped from 3 to 2 in all three sources. Combined, total parallel nyaa requests per search dropped from ~18 to ~6.

## [1.5.2] - 2026-05-18

### Changed

- **subsplease 1.0.2** and **yameii 1.0.4**. Manifest `languages` field changed from `["US"]` to `["ALL"]` on both sources. They were the only two showing the USA flag while the other four showed the globe icon. Per the same principle behind the `media: "both"` rule (badges are purely informational and should never gate user choice), all six sources now declare `languages: ["ALL"]` consistently.

## [1.5.1] - 2026-05-18

### Changed

- **toonshub 1.0.1**. Manifest description now mentions the group's public Telegram (`t.me/thtorrents`), since the actual uploader on nyaa is Anonymous and users may want to verify or follow the source directly.

### Docs

- README restructured to distinguish core sources (Nyaa, AnimeTosho, Seadex, SubsPlease) from curator picks (Yameii, ToonsHub). The curator picks ship enabled by default but are entirely toggleable in Hayase, included because the maintainer uses those specific uploaders.
- README adds an explicit "Hayase tested, Shiru not yet tested" note in the install section. The Shiru manifest is published and the code was designed against the lowest-common-denominator API both apps accept, but no real-world Shiru install has been verified. Users hitting issues in Shiru are asked to open a repo issue.

## [1.5.0] - 2026-05-18

### Added

- **ToonsHub** (`toonshub 1.0.0`, accuracy: high). Sixth source. Filters nyaa.si to the [ToonsHub] release group via title-prefix search (the group uploads as Anonymous on nyaa, no single user account, so we filter by `?q=[ToonsHub]+<show>` instead of `?u=`). ToonsHub covers many currently-airing shows including Nippon Sangoku, LIAR GAME, Klutzy Class Monitor, Frieren, Witch Hat Atelier, and ships both dual-audio (sub+dub combined) and multi-sub variants per episode. Bridges the gap on shows where SubsPlease and Yameii have no coverage.

### Fixed

- **Search queries with hyphenated tokens were returning 0 results** (`nyaa 1.0.7`, `yameii 1.0.3`, `toonshub 1.0.0`). Nyaa's full-text search rejects tokens like `skirt-take` when there is no uploader (`?u=`) filter on the query. Yameii happened to work because its `?u=Yameii` filter makes nyaa more lenient about token shape, but nyaa.js and toonshub.js were affected. Updated the query builder in all three sources to strip non-word characters (including hyphens) from search terms before sending to nyaa. Tokenized: `Ponkotsu Fuuki Iin to Skirt-take ga Futekisetsu...` is now searched as `ponkotsu fuuki iin skirt take` rather than `ponkotsu fuuki iin skirt-take`.

## [1.4.0] - 2026-05-18

### Added

- **AniList-to-AniDB ID mapping for AnimeTosho** (`animetosho 1.0.4`). New `data/anilist-to-anidb.json` (13,002 pairs, 170 KB) generated by `scripts/build-mappings.js` from the manami-project anime-offline-database (a community-maintained free dataset). New `.github/workflows/mappings.yml` runs every Monday 04:00 UTC to regenerate the mapping and auto-commit any changes. The AnimeTosho extension now fetches the mapping on first call, caches it for the session, and uses it to convert `query.anilistId` to `anidbAid` when Hayase doesn't have its own AniDB mapping. This lets AnimeTosho hit the high-accuracy `?aid=<id>` endpoint for many more shows.

### Fixed

- **AnimeTosho was using the wrong API param all along** (`animetosho 1.0.4`). The code was calling `?show=<id>` which silently returns the global recent-uploads feed for non-AnimeTosho-internal IDs. Switched to `?aid=<id>` (AniDB ID), which is the correct way to query AnimeTosho by show. Previously this would only get caught by post-filters, now it actually returns the right content.
- **Episode regex was matching `10-bit`, `100`, `1080p` and similar false positives** (`nyaa 1.0.6`, `animetosho 1.0.4`, `yameii 1.0.2`). Old pattern allowed an optional episode prefix, which meant any standalone number surrounded by delimiters matched (so searching for episode 10 would match `10-bit` color depth strings inside Blu-ray batch titles). New pattern requires either an explicit E/EP/Episode/SxxE prefix, a `-` dash form with required surrounding spaces and bracket/EOL follower, or a fully bracketed `[NN]` / `(NN)` form. Rejects `10-bit`, `1080p`, `100`, year strings, version markers.

### Changed

- AnimeTosho's search() refactored: high-accuracy ID path runs first, falls through to text search only if the ID path yields zero episode-matched results after filtering. This handles cases like Frieren where the AniDB ID covers only Season 1 (28 episodes), so Season 2 episodes need the text fallback.

## [1.3.1] - 2026-05-18

### Changed

- **subsplease 1.0.1** and **yameii 1.0.1**. Manifest `media` field changed to `both` on both sources. The field is purely informational (the wiki confirms it doesn't filter results) and Anh's standing rule is that every source declares `both` to give users flexibility. All five sources now consistently report `media: both`.

## [1.3.0] - 2026-05-18

### Added

- **Yameii (Dubs)** (`yameii 1.0.0`, accuracy: high). Fifth source. Scopes nyaa.si search to a single uploader: Yameii, who specializes in English-dubbed weekly anime releases (CR WEB-DL, 1080p / 720p variants). Hits `nyaa.si/?u=Yameii&page=rss` so it stays on the nyaa infrastructure but only returns this one uploader's content. Manifest declares `media: "dub"` to flag the source as dub-focused. Two-pass query merge for `S01E07` vs `- 07` notation, strict episode filter, batch detection all carried over from the nyaa source.

## [1.2.0] - 2026-05-18

### Added

- **SubsPlease** (`subsplease 1.0.0`, accuracy: high). Direct API for currently-airing weekly fansubs from SubsPlease. Catches new episodes immediately when SubsPlease releases them, no anidb dependency, no nyaa indexing lag. Limitation: only covers shows in the SubsPlease catalog (popular weeklies like Frieren, One Piece, LIAR GAME). Shows with built-in subs from streaming services (Nippon Sangoku, Hokuto no Ken etc.) are not in their catalog. Includes a base32-to-hex magnet hash decoder since SubsPlease serves base32-encoded info hashes.

## [1.1.4] - 2026-05-18

### Fixed

- **nyaa 1.0.5** and **animetosho 1.0.3**. Batch mode was returning single-episode releases tagged as batches. When a user searched for episode 7, Hayase's batch query would return ep 04, ep 05, ep 06 results from the same show, each shown with a "Batch" pill in the UI. Now both sources filter batch results to only releases whose title actually matches batch patterns (`Complete`, `Batch`, `S01` without specific episode, `01-12` episode ranges, etc.). Single-episode releases no longer leak into batch results.

## [1.1.3] - 2026-05-18

### Fixed

- **animetosho 1.0.2**. Was returning 75 completely unrelated shows (Hokuto no Ken, Tensei Shitara Slime, Classroom of the Elite, etc.) for searches like Nippon Sangoku. Two compounding causes, both fixed:
  - AnimeTosho's API silently returns the global 75-item recent-uploads feed when called with an invalid ID (`?eid=0`, `?eid=null`, `?eid=undefined`, `?show=999999`, etc.) instead of an empty array. The old code trusted whatever truthy value Hayase passed in `query.anidbEid` or `query.anidbAid` and would hand the API a value that triggered this silent fallback. Fix: validate the ID is a positive integer before calling AnimeTosho, fall through to text search otherwise.
  - The result-title token filter only required one show-name token to match, which let occasional garbage results slip through if they happened to share a generic word with the show. Fix: require 2+ token matches when the show has 3 or more significant tokens in its titles, keeps 1-token matches for shows with very short names.

## [1.1.2] - 2026-05-18

### Fixed

- **seadex 1.0.1**. Icon URL changed from `releases.moe/favicon.ico` (308-redirected to a broken path) to `releases.moe/favicon.png` (returns a real 200 PNG). Seadex row in Hayase was showing a broken-image placeholder.

### Changed

- **nyaa 1.0.4**. Manifest `media` field changed from `sub` to `both`. nyaa.si hosts plenty of dubbed releases (Toonami rips, English dubs, etc.), so the Sub-only badge was inaccurate.

## [1.1.1] - 2026-05-18

### Fixed

- **nyaa 1.0.3**. Was returning only 4 of 15+ available episode releases. Two root causes, both fixed:
  - Nyaa's tokenizer treats `S01E07` as a single token, so passing `07` in the search query filtered out every release using `S01E07` notation. Fix: two-pass query per title (once without episode for `S01E07`-style, once with episode for `- 07`-style), merged by infoHash.
  - Query was sorted by `s=seeders&o=desc`, so fresh weekly drops with low seeder counts were pushed off the first 75-item page. Fix: `s=id&o=desc` (newest first), matching the default nyaa.si browse experience.
  - Local ranking key order is now: resolution match desc, then date desc, then seeders desc.

### Changed

- **animetosho 1.0.1**. Same ranking change: resolution match desc, then date desc, then seeders desc. Surfaces freshly indexed releases ahead of older popular ones.

## [1.1.0] - 2026-05-18

### Added

- **AnimeTosho** (`animetosho 1.0.0`, accuracy: high). Uses AnimeTosho's JSON API. Looks up by anidb_eid when Hayase provides one (high accuracy via exact episode-ID mapping). Falls back to anidb_aid for batches/movies. Falls back further to text search if no IDs available.
- **Seadex** (`seadex 1.0.0`, accuracy: high). Queries releases.moe by AniList ID. Returns the community-curated best releases per show, tagged `type: 'best'` for `isBest` entries and `type: 'batch'` for multi-file releases. Cleans episode-specific suffixes from filenames (no more misleading "S01E01" titles on season packs).
- `tsup` multi-entry build: nyaa + animetosho + seadex bundled into separate `dist/` outputs.

### Fixed

- **nyaa 1.0.2**. Strict episode filter in `single` mode. Previously, the episode number was only a ranking hint and nyaa's full-text search would surface ep 06 or ep 01 results when the user asked for ep 7. Now drops any result whose title doesn't contain the requested episode number (with common delimiters: ` 07 `, `-07-`, `E07`, `S01E07`, `.07.`, `[07]`, etc.).

## [1.0.1] - 2026-05-18

### Fixed

- **nyaa 1.0.1**. Stopped returning unrelated shows in search results. Three changes:
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

[1.5.4]: https://github.com/anh9000/anitorrent/releases/tag/v1.5.4
[1.5.3]: https://github.com/anh9000/anitorrent/releases/tag/v1.5.3
[1.5.2]: https://github.com/anh9000/anitorrent/releases/tag/v1.5.2
[1.5.1]: https://github.com/anh9000/anitorrent/releases/tag/v1.5.1
[1.5.0]: https://github.com/anh9000/anitorrent/releases/tag/v1.5.0
[1.4.0]: https://github.com/anh9000/anitorrent/releases/tag/v1.4.0
[1.3.1]: https://github.com/anh9000/anitorrent/releases/tag/v1.3.1
[1.3.0]: https://github.com/anh9000/anitorrent/releases/tag/v1.3.0
[1.2.0]: https://github.com/anh9000/anitorrent/releases/tag/v1.2.0
[1.1.4]: https://github.com/anh9000/anitorrent/releases/tag/v1.1.4
[1.1.3]: https://github.com/anh9000/anitorrent/releases/tag/v1.1.3
[1.1.2]: https://github.com/anh9000/anitorrent/releases/tag/v1.1.2
[1.1.1]: https://github.com/anh9000/anitorrent/releases/tag/v1.1.1
[1.1.0]: https://github.com/anh9000/anitorrent/releases/tag/v1.1.0
[1.0.1]: https://github.com/anh9000/anitorrent/compare/a7cef7d...20beb65
[1.0.0]: https://github.com/anh9000/anitorrent/commit/a7cef7d
