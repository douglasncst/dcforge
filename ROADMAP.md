# Roadmap

## Next

- Wire `test/integration/` into CI against a real (ephemeral, per-run)
  Supabase instance — the suite and its RLS coverage exist and are
  documented in [`test/integration/README.md`](test/integration/README.md),
  but no CI job runs it yet.
- Define a reviewed secure credential-storage architecture before enabling API-key commands.
- Publish a reproducible release workflow and versioning policy.

## Later

- Improve configuration and authentication errors.
- Add shell completions and package distribution.
- Document self-hosted Supabase support.
- Repository structure (single package vs. a workspace of independent
  tools): see
  [`docs/decisions/0001-repo-structure.md`](docs/decisions/0001-repo-structure.md)
  — not needed yet.
- Last.fm exporter (#10): see
  [`docs/lastfm-integration-options.md`](docs/lastfm-integration-options.md)
  for how it could be merged, if it is.
- Health-data feature: needs its own threat model and storage design before
  any implementation — see
  [`docs/health-security-design.md`](docs/health-security-design.md). Must
  not share the session state file.

## Done

- Upgraded the test toolchain to Vitest 5 (`npm audit`: 5 findings → 0).
- `npm run typecheck` covers `test/` as well as `src/` (`tsconfig.test.json`).
- Library code no longer calls `process.exit` directly (`CliError`,
  `src/lib/errors.ts`); only the command layer and the top-level handler
  decide the exit code.
- `supabase/schema.sql` is idempotent (`drop policy if exists` before each
  `create policy`), and the integration-test foundation above.
