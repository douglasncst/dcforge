# DCForge roadmap

## Repository

- Define release and versioning policy for independently shipped tools.
- Improve contributor onboarding and CI path coverage as packages are added.
- Revisit workspaces only when shared code or multi-package maintenance makes
  their cost worthwhile.

## DCForge Registry

- Run disposable Supabase RLS integration tests in CI.
- Define reviewed secure credential storage before enabling API-key commands.
- Improve authentication and configuration diagnostics.
- Add shell completion and package distribution.
- Document self-hosted Supabase support.

## Subtitle Forge

- Validate long real-world media and multi-batch translations.
- Support embedded subtitle streams and improve Windows/macOS coverage.
- Improve CPU-only whisper.cpp guidance and tool-capability integration tests.

## Proposed

- Last.fm exporter (#10): evaluate product fit, rate-limit handling, and its
  independent CI before integration.
- Health/MCP (#8): redesign from its threat model before implementation;
  storage must remain isolated from credentials and provide deletion lifecycle.
