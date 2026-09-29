# claude-console

`claude-console` is an open-source TypeScript CLI for experimenting with a
Supabase-backed developer project registry. It provides local configuration,
email-based authentication through Supabase, and project CRUD commands.

The project is independent and is not affiliated with or endorsed by Anthropic,
OpenAI, or Supabase.

## What works today

- Create an account and sign in to a Supabase project you control.
- Create, list, inspect, and delete projects with row-level access controls.
- Keep CLI configuration and the Supabase session in a local file with
  owner-only permissions where supported.

Credential and API-key management are deliberately disabled. The project will
not store raw API keys until it has a reviewed secure-storage design.

## Quick start

Requires Node.js 22.12 or later (required by `@supabase/supabase-js` and by
Vitest).

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
claude-console auth signup you@example.com   # prompts for the password
claude-console projects create "example"
claude-console projects list
```

## Supabase setup

Run [`supabase/schema.sql`](supabase/schema.sql) in the Supabase SQL editor
(or `supabase db execute -f supabase/schema.sql`) before using project
commands. It's safe to run more than once — re-run it after pulling a change
to that file.

## Commands

```text
claude-console auth signup <email> [--password-stdin]
claude-console auth login <email> [--password-stdin]
claude-console auth whoami
claude-console auth logout
claude-console config set <key> <value>
claude-console projects create <name>
claude-console projects list
claude-console projects show <id>
claude-console projects delete <id>
```

Passwords are never accepted as command arguments, where they would be saved
in shell history and visible in process listings. `auth signup` and
`auth login` prompt for the password without echoing it. For scripts, pipe it
in with `--password-stdin`, for example from a password manager:

```sh
pass show supabase/dev | claude-console auth login you@example.com --password-stdin
```

## Development

```sh
npm run typecheck   # checks src/ and test/
npm test
```

`npm test` never touches a real Supabase project. A separate, opt-in suite
exercises the row-level security policies in `supabase/schema.sql` against a
**disposable** Supabase project — see
[`test/integration/README.md`](test/integration/README.md) before running
`npm run test:integration`.

See [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), and
[ROADMAP.md](ROADMAP.md).

## License

Licensed under [Apache-2.0](LICENSE).
