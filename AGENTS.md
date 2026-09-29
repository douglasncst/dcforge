# Agent guidelines

Instructions for AI coding agents (Claude Code, OpenAI Codex and similar)
working in this repository. Human contributors should read
[CONTRIBUTING.md](CONTRIBUTING.md); these rules apply on top of it.

## Scope and branches

- Treat `main` as the base branch and the stable integration branch.
- Never commit or push directly to `main`, and never force-push shared branches.
- Start every task from an up-to-date `main` and use a dedicated branch named
  `<agent>/<short-task-description>` (for example `claude/fix-login-errors`
  or `codex/add-completions`).
- Keep each branch and pull request focused on one task. Do not change files
  unrelated to that task.
- Never merge a pull request without the maintainer's explicit request.

## Validation

- Use Node.js 22.12 or later and install dependencies with `npm ci`.
- Before changing code, run the standard checks and report any pre-existing
  failures separately from failures you introduce:

  ```sh
  npm run typecheck   # tsconfig.test.json: checks src/ AND test/
  npm test
  npm run build
  ```

- After making changes, run all of them again plus any focused checks for the
  code you touched. CI runs the same commands (plus `npm pack --dry-run`) on
  Node 22 and 24.
- Fix failures caused by your change. Never remove, skip or weaken tests to
  make the suite pass.
- `npm test` must not need network access, real credentials or a real
  Supabase project. Point `CLAUDE_CONSOLE_HOME` at a temporary directory;
  never read or write the real `~/.claude-console`. The one exception is
  `npm run test:integration` (`test/integration/`), which is opt-in, never
  runs from `npm test` or CI, and requires
  `SUPABASE_INTEGRATION_URL`/`SUPABASE_INTEGRATION_ANON_KEY` pointed at a
  **disposable** project — see `test/integration/README.md`. Never point it,
  or anything else, at a production or shared Supabase project.

## Error handling

- Library code (`src/lib/**`) throws — plain `Error` or `CliError` from
  `src/lib/errors.ts` when a specific exit code matters — it never calls
  `process.exit` itself. `src/lib/supabase.ts` is the reference example.
- Command files (`src/commands/**`) and `src/index.ts`'s top-level
  `.catch()` are the only places allowed to decide the process exits;
  `src/lib/output.ts`'s `fail()` is a command-layer helper, not something to
  call from `src/lib/**`.

## Security

- Never add, print, commit or expose secrets, tokens, passwords, credentials
  or real user data, including in tests, fixtures, logs and PR descriptions.
- Never accept passwords or tokens as command-line arguments.
- Only the Supabase anon key is used by the CLI; never introduce service-role
  keys, in code, tests, or `test/integration/` env vars.
- Never weaken a row-level security policy in `supabase/schema.sql` to make a
  test pass.
- Do not change credential-handling behavior (auth, `src/lib/local.ts`,
  `src/lib/supabase.ts`, `src/lib/prompt.ts`) unless that is the explicitly
  requested task, and update SECURITY.md when you do.

## Project layout

- `src/index.ts`: CLI entry point; registers the command groups.
- `src/commands/`: one file per command group (`auth`, `config`, `projects`,
  and the disabled `keys` and `usage`).
- `src/lib/local.ts`: local state file (session tokens and config).
- `src/lib/supabase.ts`: Supabase client and session restore/refresh.
- `src/lib/store.ts`: project CRUD against the `projects` table.
- `src/lib/prompt.ts`: hidden password prompt and stdin reading.
- `src/lib/errors.ts`: `CliError`, see Error handling above.
- `supabase/schema.sql`: table and RLS policies; idempotent, safe to re-run.
- `test/`: unit tests plus end-to-end CLI tests (`cli.test.ts`), run by
  `npm test`.
- `test/integration/`: opt-in Supabase RLS tests, run only by
  `npm run test:integration`; see Validation above.

## Git and pull requests

- Make small, descriptive commits using Conventional Commit prefixes
  (`fix:`, `feat:`, `docs:`, `ci:`, `chore:`, `test:`).
- At the end of a completed task, push the task branch and open a pull
  request targeting `main`. Use a draft when work still needs review or
  follow-up.
- In the handoff, list the changed files, the checks you ran and their
  results, any checks that could not run, and the pull request link.
