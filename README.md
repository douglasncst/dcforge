# DCForge

DCForge is an open-source forge for independent developer tools, local-first
AI utilities, and automation experiments.

Projects in DCForge may integrate with open-source models, Ollama, OpenAI,
Anthropic, Supabase, or other services where appropriate. DCForge itself is
independent and is not affiliated with or endorsed by those providers.

## Projects

### DCForge Registry

The root `dcforge` package is a TypeScript CLI for experimenting with
Supabase-backed developer workflows: local configuration, email-based
authentication, and project registry CRUD with row-level access controls.

It stores configuration and session data in `~/.dcforge/state.json` (or
`$DCFORGE_HOME/state.json`) with owner-only permissions where supported.
Existing state in the former location is copied safely on first use when no
DCForge state exists; the source file is preserved.

Credential and API-key management are deliberately disabled until a reviewed
secure-storage design exists.

### Subtitle Forge

[`subtitle-forge/`](subtitle-forge/) is an experimental local-first CLI for
extracting, transcribing, translating, and validating video/audio subtitles
with FFmpeg, whisper.cpp, and Ollama. It is an independent package with its
own lockfile, tests, and CI workflow.

### Last.fm exporter

[`lastfm/`](lastfm/) is a separate CLI that exports a Last.fm user's most
played tracks as CSV.

### Proposed

- Health/MCP (#8) is not integrated: it requires a dedicated threat model,
  isolated storage, deletion lifecycle, and security review.

## DCForge Registry quick start

Requires Node.js 22.12 or later.

```sh
npm install
npm run build
npm link
```

Create a Supabase project, then set its public URL and anon key. Never use a
service-role key with this CLI.

```sh
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_ANON_KEY="your-anon-key"
dcforge auth signup you@example.com
dcforge projects create "example"
dcforge projects list
```

Run [`supabase/schema.sql`](supabase/schema.sql) in the Supabase SQL editor
(or `supabase db execute -f supabase/schema.sql`) before using project
commands. It is safe to run more than once.

## Commands

```text
dcforge auth signup <email> [--password-stdin]
dcforge auth login <email> [--password-stdin]
dcforge auth whoami
dcforge auth logout
dcforge config set <key> <value>
dcforge projects create <name>
dcforge projects list
dcforge projects show <id>
dcforge projects delete <id>
```

Passwords are never accepted as command arguments. Interactive commands use
a hidden prompt; scripts can use `--password-stdin`:

```sh
pass show supabase/dev | dcforge auth login you@example.com --password-stdin
```

## Development

Root package:

```sh
npm ci
npm run typecheck
npm test
npm run build
npm pack --dry-run
```

Subtitle Forge:

```sh
cd subtitle-forge
npm ci
npm run typecheck
npm test
npm run build
npm pack --dry-run
```

The root unit suite does not access a real Supabase project. Its opt-in RLS
suite is documented in [`test/integration/README.md`](test/integration/README.md).

See [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), and
[ROADMAP.md](ROADMAP.md). Licensed under [Apache-2.0](LICENSE).
