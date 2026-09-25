import { defineConfig } from "vitest/config";

// The default `npm test` / `vitest run`. Integration tests live under
// test/integration and are never picked up here — see
// vitest.integration.config.ts and `npm run test:integration`. They need a
// disposable Supabase project and must never run just because someone ran
// the ordinary test suite.
export default defineConfig({
  test: {
    exclude: ["**/node_modules/**", "**/dist/**", "test/integration/**"],
  },
});
