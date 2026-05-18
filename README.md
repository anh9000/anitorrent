# anitorrent

Nyaa torrent search extension for [Hayase](https://hayase.watch) and [Shiru](https://github.com/RockinChaos/Shiru).

Queries `nyaa.si` directly via its RSS endpoint. No third-party proxies.

## Install

### Hayase

Settings → Extensions → Repositories → paste this URL → Import Extensions:

```
https://raw.githubusercontent.com/anh9000/anitorrent/main/hayase/index.json
```

### Shiru

Settings → Extensions → paste this URL:

```
https://raw.githubusercontent.com/anh9000/anitorrent/main/shiru/index.json
```

## What it does

- Single-episode search: `<title> <zero-padded episode>`
- Batch search: title only, biased toward results matching batch patterns (`Complete`, `Batch`, `01-12`, `S01`, etc.)
- Movie search: title only
- Falls back across alternative titles if the first one returns nothing
- Honors `resolution` (re-ranks but does not hard-filter)
- Honors `exclusions` (drops results whose title contains any excluded keyword)
- Builds magnet links locally from infohash + standard public trackers (one round trip per query, no `.torrent` file fetch)
- Returns real seeders, leechers, size, and upload date from the nyaa RSS feed

## What it does not do

- ID mapping (anidb / anilist). Results are matched by title string, which is why accuracy is `medium`, not `high`. For high-accuracy mapping, see [AnimeTosho-style extensions](https://github.com/hayase-app/free-torrents).
- NSFW (`sukebei.nyaa.si`). Anime SFW category only.
- Authentication. Public RSS, no API key.

## Develop

```
npm install
npm run build
```

Output: `dist/nyaa.js`. CI rebuilds on every push that touches `src/`, `package.json`, or `tsup.config.js`.

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for the full version history.

## License

GPL-3.0. See [LICENSE](./LICENSE).
