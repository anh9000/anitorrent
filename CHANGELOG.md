# Changelog

All notable changes to this repo are tracked here. Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versions follow [SemVer](https://semver.org/) per source.

Per-source versions live in `hayase/index.json` and `shiru/index.json`. Repo-level tags wrap shipping batches.

## [1.6.8] - 2026-07-19 (stable)

Per-source bumps: `nyaa 1.0.20`, `animetosho 1.0.13`, `subsplease 1.0.11`, `yameii 1.0.17`, `toonshub 1.0.14`. Seadex unchanged.

### Fixed

- **Season 2 releases were still leaking into Season 1 searches when release groups used the space-separated marker.** The season detector's regex only caught the combined `SxxExx` form (like `S02E01`) and missed the more common release-group convention `S2 - 08` (season and episode as separate parts). So a search for Mushoku Tensei S1 episode 8 was surfacing 3 Mushoku Tensei S2 episode 8 releases from SubsPlease and ASW alongside the S1 results. Regex now catches both forms: `S<num>E<num>` combined AND `S<num>` standalone at a word boundary. Verified across Mushoku Tensei (S2 leaks dropped 3 -> 0), Kimetsu no Yaiba `S02E01`, Bleach `S17E01`, and Attack on Titan `Season 3`. All detect correctly. No regressions on the offline 297-show suite.

## [1.6.7] - 2026-07-19 (stable)

Per-source bumps: `nyaa 1.0.19`, `animetosho 1.0.12`, `subsplease 1.0.10`, `yameii 1.0.16`, `toonshub 1.0.13`. Seadex unchanged.

### Fixed

- **Franchise-sibling leaks with different release years.** After v1.6.6 fixed movies to actually return results, wrong-franchise leaks became visible: a Vampire Hunter D: Bloodlust (2000) search would return the 1985 original Vampire Hunter D and the 1997 Vampire Hunter: Night Warriors (Darkstalkers) OVA releases too, because they share the `vampire` and `hunter` tokens. Cleanly fixable when AniList carries the year in the show's own title (which is common: "Vampire Hunter D (2000)", "Hunter x Hunter (2011)"). Each source now detects any 4-digit year in the show's title set and rejects results whose filename carries a *different* year. Results with no year at all still pass (movie releases often omit year in the filename). Shows with no year in any of their titles get no year check at all, so this doesn't touch typical series matching. For VHD: Bloodlust the wrong-franchise leak dropped from 18 results to 2 (the 2 remaining are Night Warriors releases with no year info anywhere, a distinctive-token problem beyond year filtering). Zero regressions across curated + offline suites (0 self-match failures, 0.215% contamination, 6 movies + 6 series all clean).

## [1.6.6] - 2026-07-11 (stable)

Per-source bumps: `nyaa 1.0.18`, `animetosho 1.0.11`, `subsplease 1.0.9`, `yameii 1.0.15`, `toonshub 1.0.12`. Seadex unchanged.

### Fixed

- **Movies and single-episode OVAs now actually return results.** For a title like Vampire Hunter D: Bloodlust (a 1-episode movie), Hayase calls `single({episode: 1})` and the picker was showing at most 2-3 results (only whatever Seadex's curated ID lookup happened to have). The reason: our `single()` was running `titleHasEpisode()` against every result, and release-group filenames for movies almost never contain an episode marker like `- 01` or `S01E01` (they're just titled "[Group] Vampire Hunter D: Bloodlust (2000)"). Every real movie release was silently rejected. Each source's `single()` now checks `query.episodeCount === 1` (Hayase passes the total episode count for the show) and, if so, dispatches to `movie` mode which skips the episode filter. Verified across Vampire Hunter D: Bloodlust, Your Name, Spirited Away, Princess Mononoke, Weathering With You, and Howl's Moving Castle: each went from near-zero to 30 real results. Multi-episode series (One Piece ep 1100, Frieren ep 8, Attack on Titan, Demon Slayer, JJK S2, Dandadan) continue to episode-filter correctly with zero regression.

### Known limitation

- Movie/OVA searches can now surface releases from related shows that share the franchise name but are different AniList entries. Example: a Vampire Hunter D: Bloodlust (2000) search will also return the Vampire Hunter D (1985) original and Vampire Hunter: Night Warriors (Darkstalkers) releases because they share the tokens "vampire" and "hunter". This was already the case for series in some scenarios (like the earlier Dandadan / Circus-dan collision), and it's more noticeable now that movies actually return results. Requires a distinctive-token detection layer beyond simple token overlap. Deferred to a future release.

## [1.6.5] - 2026-07-08 (stable)

Per-source bumps: `nyaa 1.0.17`, `animetosho 1.0.10`, `subsplease 1.0.8`, `yameii 1.0.14`, `toonshub 1.0.11`. Seadex unchanged.

### Fixed

- **Season 1 releases no longer leak into a Season 2+ search.** When a user opened the torrent picker for a sequel show like "Youjo Senki II", the extension used to return every Season 1 release ("[Erai-raws] Youjo Senki - 01 ~ 12", "[HorribleSubs] Youjo Senki - 01", etc.) because the token filter kept them (both S1 and S2 titles share the tokens `youjo` and `senki`) and the "II" got dropped by the tokenizer as too short. So a fresh S2E1 with nothing on nyaa yet would still show a picker full of unrelated old S1 episodes instead of nothing. Each source now detects the season number from the show's own titles (Roman numeral `II`/`III`, "Season 2", "2nd Season", trailing digit) and requires result titles for S2+ to carry a matching season marker (`S02E`, "Season 2", "II", "2nd", etc.). S1 shows also reject results explicitly claiming a higher season, so "Foo Season 2 - 01" no longer leaks into a plain "Foo" search either. When there really is no matching release, the picker now shows empty instead of a wall of wrong-season episodes. Verified against Youjo Senki II, Re:Zero S4, Attack on Titan Season 3, Kaguya-sama Season 3, Youkoso Jitsuryoku 4th Season, and Ginga Eiyuu Densetsu Die Neue These IV.
- **"Dan" no longer leaks unrelated shows into Dandadan searches.** The Japanese word "dan" (meaning "troupe/group") appears at the end of many show titles (e.g. "Grow Up Show: Himawari no Circus-dan" started airing this week and immediately began flooding every Dandadan search). Word-boundary matching on the token `dan` treated the `-dan` suffix as its own word and passed those results. Added `dan` to the Japanese-romanization noise stopwords alongside `hen`, `ken`, `sama`, etc. Dandadan self-match is unaffected because its tokens include `dandadan` (14 chars, kept), and release groups almost universally use the concatenated form. Cut Dandadan off-show contamination from 13/28 to 0/9 in the curated live suite.



Per-source bumps: `nyaa 1.0.16`, `yameii 1.0.13`, `toonshub 1.0.10`. Seadex, AnimeTosho, and SubsPlease are unchanged.

### Changed

- **Friendlier extension-check messages when nyaa.si is slow or down.** The Nyaa, Yameii, and ToonsHub extensions run a health check on Hayase launch. When nyaa.si is briefly unreachable, rate-limiting, or serving a ddos-guard challenge, Hayase used to show a generic "Extension check timed out" toast that reads like the extension itself is broken, when in fact the extension is fine and searches still work. These three extensions now run their health check with their own 6-second timeout (a bit shorter than Hayase's internal limit) and throw specific error messages depending on what actually failed. The toast now says something like "nyaa.si is slow to respond right now. This is temporary and usually clears in a minute. Searches will still work; the extension is fine, no reinstall needed." instead of the generic timeout text. Different messages for rate-limiting, connection errors, HTTP 5xx, and ddos-guard challenge pages so the user has a real idea of what is going on. The extension logic itself did not change; only the health-check UX. Toggling the extension off and on reruns the check.



Per-source bumps: `nyaa 1.0.15`, `animetosho 1.0.9`, `subsplease 1.0.7`, `yameii 1.0.12`, `toonshub 1.0.9`. Seadex unchanged. Relaunch Hayase to update.

### The problem this release fixes

After v1.6.1 shipped, the Nyaa source returned nothing for some shows in the app (Witch Hat Atelier was the report) while SubsPlease still worked. This was a regression I introduced in v1.6.1, not a network or environment problem. Running a show's REAL, full AniList title set (the v1.6.1 work was validated against title sets that were missing some foreign synonyms) reproduced it exactly: Witch Hat Atelier returned 0 results.

The cause was the v1.6.1 query-selection rewrite. AniList and Hayase hand the titles over in a deliberate order: the canonical romaji and english titles first, then the native title, then foreign-language synonyms. The pre-v1.6.1 ranking happened to preserve that order, so it searched the romaji or english title, which is what release groups name files after. The v1.6.1 rewrite actively reordered titles by a token-recurrence-and-length score, and for Witch Hat Atelier that promoted the Polish synonym "Atelier spiczastych kapeluszy" and the French "L'Atelier des Sorciers" to the top. Searching nyaa.si for a Polish title returns nothing, so the source came up empty. The v1.6.2 release guessed the cause was a network/ddos-guard block and added browser headers; that was treating a symptom and was not the actual problem.

### Changed

- **Query selection now respects the title order AniList/Hayase provide instead of reordering it.** It keeps mostly-Latin titles (dropping native and heavily transliterated foreign synonyms), preserves the original order so the canonical romaji and english titles are searched first, and only demotes a title whose query collapses to a single generic word ("Ore dake Level Up na Ken" stripping to "level", "Orb: ..." stripping to "orb", "Monster #8" to "monster") so a more specific title is tried first. This replaces the v1.6.1 recurrence-and-length scoring, which was clever but wrong: it could rank a foreign synonym above the real title. Verified against the real full AniList title sets for Witch Hat Atelier, Hunter x Hunter, Bakemonogatari, Noragami, Toradora, Kaiju No. 8, Solo Leveling, and Orb; all now search their canonical title. Witch Hat Atelier goes from 0 results to 22 on the exact title set that was failing.
- The browser headers added in v1.6.2 are kept (they are harmless and a reasonable safety measure for ddos-guard), but they were not the fix.

### Lesson

- The relevance tests were validating against an artificial title order (native and synonyms first) on the assumption that title order could not be trusted. That assumption is what motivated the fragile v1.6.1 ranking and hid this bug. The tests now use the real order (romaji and english first), which is what the app actually passes.

## [1.6.2] - 2026-05-22 (stable)

Per-source bumps: `nyaa 1.0.14`, `yameii 1.0.11`, `toonshub 1.0.8`. The three other sources are unchanged. Relaunch Hayase to pick this up.

### Fixed

- **The three nyaa.si-based sources (Nyaa, Yameii, ToonsHub) could return nothing while the others worked.** nyaa.si sits behind ddos-guard, which serves a challenge page instead of the RSS feed to clients that do not look like a browser. Our request sent no `User-Agent`, so in some host environments ddos-guard challenged it, the response had no torrent items, and the source surfaced zero results. The symptom: a current-season show returned only SubsPlease results (SubsPlease, AnimeTosho, and Seadex each hit a different server that is not behind ddos-guard, so they were unaffected). Requests to nyaa.si now send browser-like headers (`User-Agent` + `Accept`) via a shared `httpGet` helper, which gets past the challenge. In a real browser or worker, `User-Agent` is a forbidden header and is silently ignored, so the change is safe in every environment. Only the bundles that actually call nyaa.si carry the change; the others are byte-identical and were not bumped.

Per-source bumps: `nyaa 1.0.13`, `animetosho 1.0.8`, `yameii 1.0.10`, `toonshub 1.0.7`, `subsplease 1.0.6`. Seadex is unchanged (it only uses the magnet builder, not the matching logic). Already-installed users get the update on next Hayase launch.

### The problem this release fixes

v1.6.0 carried over a fix from v1.5.6 that dropped any token contained inside a longer token (so "dan" was removed when "dandadan" was present, to stop "dan" matching "Danganronpa"). Running the new offline matching suite over roughly 300 real AniList shows exposed two problems with that approach:

1. **Shows stopped matching their own releases.** Some AniList synonyms are the title with spaces removed (for example Marriage Toxin ships the synonym "marriagetoxin"). The substring rule then dropped the real words "marriage" and "toxin" because each is contained in "marriagetoxin", leaving the show with no usable tokens for the words release groups actually put in filenames. The suite caught 24 shows that could no longer match their own episodes.
2. **The rule was never needed for the case it was added for.** Word-boundary matching (already in place since v1.5.6) does not match "dan" inside "Danganronpa" anyway, because there is no word boundary there. The substring drop was solving a problem that the word boundary had already solved, while creating the self-match failures above.

### Changed

- **Search query now prefers the canonical title, not loose synonyms.** This is the biggest fix in this release. AniList provides each show a pile of titles including short acronyms ("HxH") and generic descriptive translations ("Monster Tale", "Stray God", "Tiger X Dragon", "Monster #8" for Kaiju No. 8). The old query builder ranked titles only by how much Latin text survived, so a clean acronym or a generic translation could win and become the actual search term. Searching "HxH" returned an unrelated ecchi show (Masou Gakuen HxH), "Stray God" returned The God of High School, "Tiger X Dragon" returned a Bakugan episode subtitled "Tiger and Dragon", and those then slipped past token matching because the synonym contributed permissive tokens like "god" or "dragon". Query selection now identifies the canonical name by signature-token recurrence: the canonical title's main word recurs across the show's other titles (romaji, english, and transliterations, matched as a substring so it survives spacing and romanization differences), while a one-off descriptive synonym matches nothing else. Among the titles whose signature recurs, the longest is chosen; shows whose titles share nothing fall back to the longest token, still the canonical name over a short synonym. This is what stops the search itself from dragging in unrelated shows, and it correctly separates the canonical from the synonym in every conflict case found (HxH, Bakemonogatari, Noragami, Toradora, Kaiju No. 8, Solo Leveling). It cut live off-show contamination across roughly 280 real shows from 13 shows to 0.
- **Removed the substring token-drop entirely.** Tokens are now kept as-is; word-boundary matching prevents the fragment-inside-a-word false positives on its own. This fixes the self-match failures for concatenated-synonym shows (Marriage Toxin and similar).
- **Strip bracketed language and region codes before matching.** Multi-sub release groups (Erai-raws and others) append a long run of bracketed codes to filenames: `[ENG][POR-BR][SPA-LA][DAN][CHI]...`. These are metadata, not part of the show name, but `[DAN]` (Danish) was matching the token "dan" from "DAN DA DAN" via word boundaries, pulling Ranma, Ao no Hako, and others into Dandadan results. All-caps 2-3 letter bracket codes are now stripped from a title before tokens are tested against it. This is what the substring drop was really meant to prevent, fixed at the actual source.
- **Added Japanese romanization noise to the stopword list.** Grammatical particles, pronouns, honorifics, the copula, common verbs, and the "-hen" arc/chapter suffix (hen, boku, ore, kimi, sama, san, kun, chan, suru, naru, nani, desu, dake, made, demo, inai, koi, ken, shi) romanize to short tokens that appear across unrelated shows and are never show-identifying. "-hen" alone accounted for the largest single share of cross-show matches (arc titles like Kanketsu-hen, Tamashii-hen). Dropping these cut measured cross-franchise contamination from 1.46% to 0.22%.

### Added

- **Offline matching test suite** (`test/matching.test.mjs`, run via `npm run test:matching`). Runs the title-selection and show-matching logic against roughly 300 real AniList shows (trending, most-popular, and highest-scored, fetched via `npm run fetch:fixture` into `test/fixtures/anime.json`) with no network, deterministically. Per show it verifies a usable query is produced, a non-empty token set is built, and the show matches releases named after its own canonical titles. It then measures cross-franchise contamination across all show pairs (excluding same-franchise season and arc variants) and fails the build if self-match failures occur, too many shows produce no query, or contamination exceeds 0.5%. This is the gate that caught the v1.6.0 regression before it shipped. Current results: 0 self-match failures, 0.22% contamination across about 87,000 pairs.
- **Bulk live relevance test** (`test/relevance-bulk.test.mjs`). Runs the full roughly-300-show fixture against the live nyaa source with each show's complete real title set, the at-scale companion to the 15-case `npm test`. It judges off-show contamination independently of the source filter (against each show's strong canonical title words, not the permissive full token set, so it is not circular) and is paced with retry to respect rate limits. This is the test that exposed the synonym-as-query problem fixed above. Current results: 0 off-show contamination across the roughly 280 shows that return results. The offline suite proves the logic at scale without the network; this proves the real end-to-end path on live data.

### Known limitation

- A show whose only distinctive word is short and common can still surface the occasional unrelated release containing that word. The clearest example is Orb, whose English title "Orb: On the Movements of the Earth" trims to the bare three-letter query "orb", which matches words like "Dark Orb" in unrelated titles. This is the same class as Oshi no Ko (sole token "oshi"): tightening it further would risk dropping legitimate releases, so it is left as-is. In practice it affects a single-digit number of shows out of several hundred.

## [1.6.0] - 2026-05-20 (stable)

### The problem this release fixes

Across v1.5.x a series of search bugs kept recurring: shows with non-English titles returning zero results, unrelated shows leaking into results, single episodes being mislabeled as batches, and wrong-season cross-matches. Each was patched, but they kept coming back in slightly different forms. The root cause was structural: the matching logic (how a torrent title is judged to belong to the searched show) was **copy-pasted into all six source files**. Every fix had to be made in six places, and in practice a fix would land in some sources but not others, or the copies would drift out of sync. That drift is what reintroduced the bugs.

### Changed

- **All matching logic consolidated into one shared module** (`src/lib/shared.js`). Every source now imports the same code for query building, show-name matching, episode detection, and batch detection. There is now exactly one copy. A fix applies to all sources at once and they can no longer drift apart. This removed roughly 400 lines of duplicated code. All six per-source bundles stay standalone (the shared module is inlined into each at build time, so Hayase still loads single self-contained files).
- **Folded in every individual matching fix from v1.5.x as the single canonical implementation**, so the following are now guaranteed consistent across all six sources rather than present in some and missing in others:
  - Title selection prefers the English/romaji titles instead of the shortest title (which was often the Japanese native or a foreign synonym that searched for nothing). This is what made shows like Witch Hat Atelier return zero results.
  - Show-name matching is word-boundary based, not substring, so "dan" no longer matches "Danganronpa".
  - Fragment tokens contained inside a longer title token are dropped ("dan" removed when "dandadan" is present).
  - Ordinal season tokens (1st, 2nd, 3rd, 4th) are ignored, so a "4th Season" show no longer cross-matches other "4th Season" shows.
  - Batch detection ignores titles carrying a specific single-episode marker (SxxExx or "- NN"), so single episodes are no longer tagged as batches.
- **AnimeTosho and SubsPlease now strip hyphens from search queries** like the nyaa-based sources already did, so hyphenated titles search correctly on those sources too (previously they did not, because their copy of the query builder predated that fix).
- **Seadex magnets now carry the full 7-tracker list** (was 5), matching the other sources for better peer discovery.

### Added

- **Committed relevance test suite** (`test/relevance.test.mjs`, run via `npm test`). Runs 15 diverse anime with their real, full AniList title sets (native title + foreign-language synonyms, ordered native-first to stress the title-selection path) against the live source, and asserts each returns non-zero results with zero off-show contamination. Coverage spans sequels, currently-airing weeklies, long-running shows, single-word titles, and heavily-foreign-titled shows (Witch Hat Atelier, Frieren, One Piece, Re:Zero S4, LIAR GAME, Dandadan, Bleach TYBW, Apothecary Diaries, Jujutsu Kaisen, Demon Slayer, Attack on Titan, Chainsaw Man, Mushoku Tensei, Solo Leveling, Kaiju No. 8). This is the regression gate that catches the title/relevance class of bugs before a release ships, instead of in production. All 15 pass on this release.

## [1.5.6] - 2026-05-20 (stable)

### Fixed

- **Zero results for shows with non-English titles** (`nyaa 1.0.11`, `animetosho 1.0.6`, `yameii 1.0.8`, `toonshub 1.0.5`, `subsplease 1.0.4`). The query builder picked the two shortest titles AniList provides. For many shows the shortest titles are the Japanese native title and short foreign synonyms (Vietnamese, Thai, etc.), which strip down to nothing usable, so the actual English and romaji titles were never searched. Witch Hat Atelier returned nothing despite nyaa.si being full of episodes. The builder now ranks titles by how much survives as searchable Latin text and prefers the English/romaji titles, skipping titles that produce no usable search terms.
- **Unrelated shows leaking into results via partial-word matches**. Show-name matching used substring checks, so the token "dan" (from "DAN DA DAN") matched "Danganronpa". Matching is now word-boundary based, and fragment tokens that are contained inside a longer title token are dropped (so "dan" is removed when "dandadan" is present). Stress-tested across 10 diverse anime including sequels, movies, and foreign-titled shows.

### Known limitation

- Shows whose only distinctive English word is very short and common (for example "Oshi no Ko", whose lone usable token is "oshi") can still surface the occasional unrelated release that happens to contain that word. Tightening this further would risk dropping legitimate releases, so it is left as-is.

## [1.5.5] - 2026-05-20 (stable)

### Fixed

- **Single episodes wrongly tagged as batches** (`nyaa 1.0.10`, `animetosho 1.0.5`, `yameii 1.0.7`, `toonshub 1.0.4`). The batch detector matched the bare phrase "Season N" in a title. Shows whose official name contains the season (e.g. "Re:Zero ... Season 4") had every single episode flagged as a batch, flooding batch-mode search results with individual episodes. Batch detection now ignores any title that carries a specific single-episode marker (`SxxExx` or `- NN`), so only real season packs and complete-batch releases are tagged.
- **Cross-show contamination from ordinal season tokens** (`nyaa 1.0.10`, `animetosho 1.0.5`, `yameii 1.0.7`, `toonshub 1.0.4`, `subsplease 1.0.3`). The title tokenizer treated ordinals like "4th" as show-identifying words. A search for a "4th Season" show (Re:Zero) would match unrelated "4th Season" shows (That Time I Got Reincarnated as a Slime), surfacing the wrong series in results. Ordinal tokens (`1st`, `2nd`, `3rd`, `4th`, etc.) are now dropped from match tokens.

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

[1.6.0]: https://github.com/anh9000/anitorrent/releases/tag/v1.6.0
[1.5.6]: https://github.com/anh9000/anitorrent/releases/tag/v1.5.6
[1.5.5]: https://github.com/anh9000/anitorrent/releases/tag/v1.5.5
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
