# Contributing

Open or comment on an issue before making a substantial change. Keep pull
requests focused, explain the user-facing effect, and include tests for changed
behavior.

Never commit credentials, real user data, exported personal data, or Supabase
service-role keys. Use anonymized fixtures for tests.

1. Fork the repository and create a branch from `main`.
2. Use Node.js 22.12 or later and install dependencies with `npm ci`.
3. Make the smallest coherent change.
4. Run the same checks as CI (`npm run typecheck` covers both `src/` and
   `test/`):

   ```sh
   npm run typecheck
   npm test
   npm run build
   ```

5. Open a pull request against `main` describing the change and how you
   validated it. The PR template prompts for the same information.

Tests in `npm test` must not need network access or a real Supabase project.
The CLI tests in `test/cli.test.ts` run the real binary with
`CLAUDE_CONSOLE_HOME` pointed at a temporary directory; follow that pattern
instead of touching `~/.claude-console`. Library code (`src/lib/**`) should
throw or return, not call `process.exit` — see `src/lib/errors.ts`'s
`CliError` and how `src/lib/supabase.ts` uses it; only command files
(`src/commands/**`) and `src/index.ts`'s top-level handler decide to end the
process.

Changing `src/lib/store.ts` or `supabase/schema.sql`? Run
[`test/integration/`](test/integration/README.md) against a disposable
Supabase project — it's the only thing that actually exercises the RLS
policies.

AI coding agents should also follow [AGENTS.md](AGENTS.md).

Contributions are licensed under Apache License 2.0.
