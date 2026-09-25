import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const activeDirs = new Set<string>();
let cleanupHooksInstalled = false;

function cleanupAll(): void {
  for (const dir of activeDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  activeDirs.clear();
}

/**
 * Registers process-level cleanup once. Covers normal exit, an uncaught
 * exception, and Ctrl-C (SIGINT) / SIGTERM — a Whisper transcription or
 * Ollama translation left running when the user interrupts must not leave
 * a temporary audio file behind.
 */
function ensureCleanupHooks(): void {
  if (cleanupHooksInstalled) return;
  cleanupHooksInstalled = true;
  process.on("exit", cleanupAll);
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => {
      cleanupAll();
      process.exit(130);
    });
  }
}

/**
 * Creates a private temporary directory with an unpredictable name and
 * tracks it for cleanup. Callers should remove it explicitly with
 * `cleanupTempDir` when done (success or failure) — the process-exit hooks
 * are a safety net for early termination, not the primary cleanup path.
 */
export function createTempDir(prefix = "subtitle-forge-"): string {
  ensureCleanupHooks();
  const dir = mkdtempSync(join(tmpdir(), prefix));
  activeDirs.add(dir);
  return dir;
}

export function tempFilePath(dir: string, extension: string): string {
  return join(dir, `${randomUUID()}${extension}`);
}

export function cleanupTempDir(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
  activeDirs.delete(dir);
}
