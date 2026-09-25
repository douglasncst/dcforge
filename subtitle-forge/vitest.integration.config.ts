import { defineConfig } from "vitest/config";

// `npm run test:integration` only: exercises whatever of ffmpeg/ffprobe,
// Ollama, and a Whisper backend are actually installed. Each test detects
// its own capability and reports clearly what it skipped and why — never
// reports "passed" for something it didn't actually run. See
// test/integration/README.md.
export default defineConfig({
  test: {
    include: ["test/integration/**/*.test.ts"],
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
