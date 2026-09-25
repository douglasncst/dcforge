import { defineConfig } from "vitest/config";

// Default `npm test`. Never touches ffmpeg, Ollama, or a real Whisper
// backend — those boundaries are mocked. See vitest.integration.config.ts
// for the opt-in suite that talks to real local tools.
export default defineConfig({
  test: {
    exclude: ["**/node_modules/**", "**/dist/**", "test/integration/**"],
  },
});
