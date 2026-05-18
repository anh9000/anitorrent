<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./assets/title-dark.svg">
    <img src="./assets/title-light.svg" alt="anitorrent" width="420">
  </picture>
</p>

Anime torrent search extensions for [Hayase](https://hayase.watch) and [Shiru](https://github.com/RockinChaos/Shiru). One install URL, six toggleable sources.

## Sources

### Core (recommended for everyone)

| Source | Accuracy | Best for |
|---|---|---|
| Nyaa | medium | Raw firehose, full coverage of every anime upload |
| AnimeTosho | high | Anidb-mapped lookups for older / popular shows + batch packs |
| Seadex | high | Community-curated "best release" picks |
| SubsPlease | high | Currently-airing weekly fansubs |

### Curator picks (optional)

These are personal picks that ship enabled by default but are entirely toggleable. Disable them in Settings → Extensions if you don't want them.

| Source | Accuracy | What it adds |
|---|---|---|
| Yameii | high | Single uploader's English dub re-encodes from nyaa. Narrow catalog but consistent quality. IRC: `#Yameii@irc.rizon.net` |
| ToonsHub | high | Releases from the ToonsHub group: dual-audio and multi-sub variants for many currently-airing shows. Telegram: [t.me/thtorrents](https://t.me/thtorrents) |

All six sources declare `media: "both"` in the manifest. Hayase shows Sub + Dub badges regardless. The badge is purely informational, it does not filter results.

## Install

### Hayase (tested, primary target)

Settings → Extensions → Repositories → paste → Import Extensions:

```
https://raw.githubusercontent.com/anh9000/anitorrent/main/hayase/index.json
```

### Shiru (designed for, not yet tested)

The code was written against the lowest-common-denominator API that both Hayase and Shiru accept, and a dedicated Shiru manifest is published, but **this has not been verified in an actual Shiru install**. Results may vary. If you import it in Shiru and hit a problem, please open an issue on the repo with whatever error / behavior you see.

Settings → Extensions → paste:

```
https://raw.githubusercontent.com/anh9000/anitorrent/main/shiru/index.json
```

## ID mapping

`data/anilist-to-anidb.json` is a compact 170 KB map (~13,000 pairs) extracted from the [manami-project anime-offline-database](https://github.com/manami-project/anime-offline-database). The AnimeTosho extension fetches this file on first call (cached in memory for the session) to convert AniList IDs to AniDB IDs when Hayase doesn't provide them, enabling high-accuracy lookups via AnimeTosho's `?aid=<id>` endpoint.

The mapping is regenerated weekly by `.github/workflows/mappings.yml` running `scripts/build-mappings.js`. Manami publishes "Delta Update" commits multiple times per week and tagged weekly releases, so the chain stays fresh automatically with no manual action.

## Develop

```
npm install
npm run build
```

Output: `dist/*.js`. CI rebuilds on every push that touches `src/`, `package.json`, or `tsup.config.js`.

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for the full version history.

## License

GPL-3.0. See [LICENSE](./LICENSE).
