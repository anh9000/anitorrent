<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./.github/assets/title-dark.svg">
    <img src="./.github/assets/title-light.svg" alt="anitorrent" width="420">
  </picture>
</p>

Anime torrent extension built for [Hayase](https://hayase.watch). Six toggleable sources, auto-updating in the background, no manual maintenance.

> **Shiru note:** a [Shiru](https://github.com/RockinChaos/Shiru) manifest is also published, but this has **not been tested in an actual Shiru install**. The code was designed against the lowest-common-denominator API both apps accept, so it should work. If you try it in Shiru and hit a problem, please [open an issue](https://github.com/anh9000/anitorrent/issues) with the details.

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

## Tested on

Built and verified against this Hayase build:

| Component | Version |
|---|---|
| Hayase Interface | `v6.4.366` |
| Hayase Native | `6.4.69` |
| Platform | Windows |
| All six sources online | ✅ verified `2026-05-18` |

Screenshot of the extensions page in Hayase showing all six rows green and current:

<p align="center">
  <img src="./.github/assets/installed-extensions.png" alt="anitorrent extensions live in Hayase" width="720">
</p>

## Install in Hayase

Settings → Extensions → Repositories → paste → Import Extensions:

```
https://raw.githubusercontent.com/anh9000/anitorrent/main/hayase/index.json
```

That's it. One-time action. Hayase auto-polls the manifest on every launch, so any future release flows in automatically without re-importing.

### Shiru install URL (untested, try at your own risk)

```
https://raw.githubusercontent.com/anh9000/anitorrent/main/shiru/index.json
```

Settings → Extensions → paste. See the disclaimer at the top of this README.

## ID mapping

`data/anilist-to-anidb.json` is a compact 170 KB map (~13,000 pairs) extracted from the [manami-project anime-offline-database](https://github.com/manami-project/anime-offline-database). The AnimeTosho extension fetches this file on first call (cached in memory for the session) to convert AniList IDs to AniDB IDs when Hayase doesn't provide them, enabling high-accuracy lookups via AnimeTosho's `?aid=<id>` endpoint.

The mapping is regenerated weekly by `.github/workflows/mappings.yml` running `.github/scripts/build-mappings.js`. Manami publishes "Delta Update" commits multiple times per week and tagged weekly releases, so the chain stays fresh automatically with no manual action.

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
