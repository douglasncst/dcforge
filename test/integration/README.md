# Supabase integration tests

`npm run test:integration` runs `test/integration/*.test.ts` against a real
Supabase project's row-level security policies, through the CLI's own code
(`src/lib/local.ts` + `src/lib/supabase.ts` + `src/lib/store.ts`), not
hand-rolled queries.

**Never point this at a production or shared project.** It signs up
throwaway users (`dcforge-integration-<uuid>@example.test`) that are never
deleted (deleting an auth user needs a service-role key, which this project
never uses) and creates and deletes `projects` rows under them.

## One-time setup

Use a **disposable** Supabase project:

- **Local (recommended):** [Supabase CLI](https://supabase.com/docs/guides/local-development)
  — `supabase init && supabase start` runs a full local stack in Docker with
  email confirmation off by default. `supabase status` prints the local API
  URL and anon key.
- **Or a free throwaway hosted project**, with Authentication > Providers >
  Email > "Confirm email" turned **off** (otherwise `signUp` returns no
  session and the tests fail immediately, saying so).

Apply the schema from [`supabase/schema.sql`](../../supabase/schema.sql) — it
is safe to run more than once.

## Running

```sh
export SUPABASE_INTEGRATION_URL="http://127.0.0.1:54321"       # or your disposable project's URL
export SUPABASE_INTEGRATION_ANON_KEY="..."                     # its anon key, never a service-role key
npm run test:integration
```

These are deliberately **not** `SUPABASE_URL`/`SUPABASE_ANON_KEY` (what the
CLI itself reads): having those set for everyday `claude-console` use must
never make this suite silently run against a real project. Without
`SUPABASE_INTEGRATION_URL`/`SUPABASE_INTEGRATION_ANON_KEY` set, the suite
fails immediately with a message naming what's missing — it does not skip
quietly and does not fall back to anything else.

`npm test` (the default suite) never runs these, and no CI workflow in this
repository runs them either — there's no disposable project to point CI at.
Wiring a real one into CI (e.g. `supabase start` in a job, or a project
created and torn down per run) is future work; see the main README's
roadmap.

## What's covered

`rls.integration.test.ts` signs up two users and asserts, through
`src/lib/store.ts`:

- each user can read and list only the projects they created;
- neither user can update or delete the other's project (the RLS-filtered
  write matches zero rows, which `deleteProject` reports as "not found",
  not as a permission error);
- an anonymous client (no session at all) sees no rows.

RLS is never weakened to make a test pass. If a future change to
`supabase/schema.sql` breaks one of these, that is the point of the test.
