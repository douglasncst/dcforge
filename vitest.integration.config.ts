import { defineConfig } from "vitest/config";

// `npm run test:integration` only. Exercises src/lib/store.ts and the
// auth flow against a real Supabase project's RLS policies — see
// test/integration/README.md before running this.
export default defineConfig({
  test: {
    include: ["test/integration/**/*.test.ts"],
    // Real network calls (auth sign-up/sign-in, several round trips per
    // test) are slower than the mocked default suite.
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
