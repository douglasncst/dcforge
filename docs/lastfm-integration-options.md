# Options for the Last.fm exporter (#10)

Status: recommendation, not a decision to act on in this round. PR #10 stays
unmerged; this exists to make the eventual choice easier.

## What it is today

`lastfm/` (branch `claude/lastfm`) is a small, standalone CLI: given a
Last.fm username, it exports their top tracks to CSV. Reviewed directly from
the branch:

- **Zero runtime dependencies** — uses the global `fetch`, nothing else.
- **Pagination:** pages through `user.gettoptracks` up to 1000 tracks per
  page, stopping at the requested limit or when the API reports no more
  pages.
- **API errors:** checks the response body's `error`/`message` fields and
  throws a clear message rather than treating a Last.fm-side error as empty
  data.
- **API key:** read only from `LASTFM_API_KEY`; never written to disk,
  never logged, never a command-line argument.
- **Tests:** 5, covering track mapping, the query it sends, pagination
  continuing until the limit or running out of pages, the single-track
  response shape (Last.fm returns an object instead of a one-item array),
  and a Last.fm-side error being surfaced.
- **Gap:** no retry or backoff on HTTP 429 (rate limiting) — a burst of
  requests (e.g. exporting a very active user's full history) can simply
  fail instead of backing off and continuing.
- Its own `package.json`, `tsconfig.json`, lockfile and README, pinned to
  `vitest@^2.1.8` — the same version this round moved the root package off
  of for its 5 `npm audit` findings (§ Vitest 5 in the main changelog); it
  would need the same bump if it starts sharing tooling with the root
  package.

It shares no code, no state, and no Supabase dependency with
`claude-console`. Architecturally it is already independent; the only thing
tying it to this repository is which directory its files happen to sit in.

## Options

### A. Separate repository

Its own `douglasncst/lastfm` (or similar), own issues, own releases, own CI.

- **For:** fully independent versioning and release cadence; no coupling to
  `claude-console`'s CI or `main` branch at all; clearest ownership boundary
  if it's ever handed to someone else or archived independently.
- **Against:** another repository to keep dependabot, templates, LICENSE,
  etc. in sync across; loses the "one place" convenience of the current
  setup; GitHub Actions minutes and repo-list clutter for what's a small
  tool.

### B. Separate npm package, still in this repository (current shape)

Keep `lastfm/` exactly as it is: its own `package.json`/lockfile, add its
own CI workflow file scoped to `lastfm/**` via `paths:`, its own dependabot
entry.

- **For:** no repository-management overhead; matches ADR 0001's
  recommendation not to force a workspace; a contributor working on
  `lastfm/` never touches `claude-console`'s lockfile or vice versa; still
  gets a real, working CI check per PR.
- **Against:** shares a `main` branch and issue tracker with an unrelated
  tool, which can be confusing for outside contributors who came for one and
  not the other; a release of `lastfm` isn't a release of `claude-console`
  or vice versa, and nothing currently expresses that (no per-directory
  tags, no changelog separation).

### C. Formal npm workspace

Fold both into a `workspaces` root, shared lockfile, shared root
`devDependencies` where versions match.

- **For:** one `npm ci` installs everything; shared tooling versions (e.g.
  one Vitest version for both) stay in sync by construction.
- **Against:** per ADR 0001, this is more workspace machinery than two
  small, code-independent packages justify today; a shared lockfile becomes
  a single point every package's install goes through, so an unrelated
  dependency bump for one can require re-resolving the other's tree too.

## Recommendation

**B**, if and when #10 is actually merged: keep `lastfm/` as a sibling
top-level package exactly as it already is, add a `paths: [lastfm/**]`-scoped
CI workflow for it (mirroring `.github/workflows/ci.yml`'s shape: `npm ci`,
typecheck, test, build, run from `lastfm/`), and give it its own
`dependabot.yml` entry (`directory: "/lastfm"`) so its `vitest@2` gets the
same kind of update this round gave the root package. Move to **A** only if
it later needs a release cadence, issue tracker, or audience genuinely
independent of `claude-console`'s — nothing about it today requires that.

This is not an instruction to merge #10 in this round — that remains a
product decision (does a Last.fm exporter belong in a "developer project
registry" CLI's repository at all?) that this document doesn't make for you.
