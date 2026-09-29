# ADR 0001: single package for now, not a workspace/monorepo

Status: accepted. Revisit when the trigger conditions below are met.

## Context

`dcforge` today holds one shipped package: `claude-console`, a Supabase-backed
CLI (`src/`, `test/`, one `package.json`, one lockfile, one CI workflow).

Two more tools have been proposed as pull requests, not yet merged, and they
are not architecturally alike:

- **Last.fm exporter (#10, branch `claude/lastfm`):** a small,
  dependency-free CLI already isolated in its own `lastfm/` directory, with
  its own `package.json`, `tsconfig.json`, lockfile, tests and README. It
  shares nothing at runtime with `claude-console` — no imports, no state
  file, no Supabase. It is, structurally, already an independent package
  that merely happens to live in this repository's working tree.
- **Health/MCP connector (#8, branch `claude/conector-saude-tp8crw`):** the
  opposite shape. It adds a mostly-independent `health-mcp-server/`
  subpackage (its own `package.json`, depending on
  `@modelcontextprotocol/sdk`), **but also** reaches into the core package —
  new commands under `src/commands/health.ts`, a new `src/lib/health.ts`,
  and an extended `State` in `src/lib/store.ts` — and both the CLI and the
  MCP server read and write the **same** `~/.claude-console/state.json` the
  session tokens live in. It is not cleanly separable from `claude-console`
  as submitted, independent of whichever repository layout is chosen (see
  [ADR-adjacent health design notes](../health-security-design.md) for why
  that specific sharing is a problem on its own).

So the honest count of "tools that are actually independent today" is one
(Last.fm), not several, and the second candidate (Health) needs a redesign
that is orthogonal to this decision.

## Options considered

**A. Single package (current state).** Everything under `src/`, one
`package.json`, one CI workflow.

**B. npm workspace / monorepo.** A root `package.json` with a `workspaces`
field, per-package directories (e.g. `packages/claude-console`,
`packages/lastfm`), a shared lockfile, and CI that understands which
packages changed.

## Decision

**Stay with A for now.** Do not introduce npm workspace tooling in this
round.

Reasoning, from the evidence above rather than a general preference:

- A workspace earns its cost (shared lockfile as a single point every
  package's install goes through, workspace-aware CI path filtering, a
  cross-package versioning and release policy, contributors having to learn
  the workspace layout) when there are **multiple** independent packages
  **and/or** code they need to share. Right now there is exactly one clean
  candidate (Last.fm) and it shares no code with `claude-console` — nothing
  is being duplicated or awkwardly copy-pasted between them today that a
  shared internal package would fix.
- Health is not ready to be anyone's second workspace member: its design
  needs to change regardless (see the linked security notes), and folding
  it into a workspace now would just formalize its current state-sharing
  problem instead of fixing it.
- A workspace is easy to adopt later and hard to cleanly un-adopt; starting
  without one keeps the option open without committing to it speculatively.

If Last.fm (or a similarly independent future tool) is actually merged
before this is revisited, host it as a **sibling top-level directory with
its own `package.json` and lockfile** (as it already is on its branch) and
give it its own CI workflow file scoped with `paths:` — not a shared
workspace lockfile — since nothing yet requires them to share dependency
resolution.

## Revisit this decision when

- A second tool is proposed that is *also* fully independent (no shared
  state file, no imports into `src/`) — i.e. there would be two or more
  packages with nothing architecturally requiring them to be separate repos
  either.
- Any two packages need to **share code** (a common internal library),
  which a plain sibling-directory layout can't do without publishing an
  internal package or resorting to relative imports across package
  boundaries.
- Maintaining N independent `package.json`/lockfile/CI-workflow sets becomes
  a real, felt maintenance burden rather than a hypothetical one.
