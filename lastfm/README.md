# lastfm

Small, dependency-free CLI that exports a Last.fm user's most played tracks
as CSV. It lives in the `dcforge` repository but is independent of the
`claude-console` CLI.

## Setup

Requires Node.js 20 or later and a Last.fm API key
(create one at https://www.last.fm/api/account/create).

```sh
cd lastfm
npm install
npm run build
export LASTFM_API_KEY="your-lastfm-api-key"
```

## Usage

```sh
node dist/index.js <user> [--limit 100] [--period overall] [--out top.csv]
```

- `--limit`: how many tracks to export (default `100`).
- `--period`: `overall`, `7day`, `1month`, `3month`, `6month` or `12month`
  (default `overall`).
- `--out`: file to write; without it the CSV goes to standard output.

Example:

```sh
node dist/index.js whocasty --limit 100 --out top100.csv
```

The CSV columns are `rank,track,artist,playcount,url`.

## Development

```sh
npm run typecheck
npm test
```
