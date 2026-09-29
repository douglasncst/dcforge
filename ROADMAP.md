# Roadmap

## Next

- Define a reviewed secure credential-storage architecture before enabling API-key commands.
- Add integration tests against a disposable Supabase project, including RLS policies.
- Publish a reproducible release workflow and versioning policy.
- Upgrade the test toolchain (Vitest) to clear development-only audit findings.

## Later

- Improve configuration and authentication errors.
- Add shell completions and package distribution.
- Document self-hosted Supabase support.
- Decide whether the repository becomes a workspace of independent tools
  (for example the proposed Last.fm exporter) with shared CI, instead of a
  single CLI package.
- Any health-data feature needs its own threat model and storage design; it
  must not share the session state file.
