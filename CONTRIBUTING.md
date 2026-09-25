# Contributing

Open or comment on an issue before making a substantial change. Keep pull
requests focused, explain the user-facing effect, and include tests for changed
behavior.

Never commit credentials, real user data, exported personal data, or Supabase
service-role keys. Use anonymized fixtures for tests.

1. Fork the repository and create a branch from `main`.
2. Use Node.js 22 or later and install dependencies with `npm ci`.
3. Make the smallest coherent change.
4. Run the same checks as CI:

   ```sh
   npm run typecheck
   npm test
   npm run build
   ```

5. Open a pull request against `main` describing the change and how you
   validated it.

Tests must not need network access or a real Supabase project. The CLI tests
in `test/cli.test.ts` run the real binary with `CLAUDE_CONSOLE_HOME` pointed
at a temporary directory; follow that pattern instead of touching
`~/.claude-console`.

AI coding agents should also follow [AGENTS.md](AGENTS.md).

Contributions are licensed under Apache License 2.0.
