import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import { join, resolve, sep } from "node:path";
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

/**
 * Refuses to remove a handful of paths no legitimate caller should ever
 * pass: the filesystem root, the OS temp directory itself, and the user's
 * home directory. This exists because callers (e.g. the pipeline) derive
 * the directory to clean up from another component's return value
 * (`dirname(audioPath)` from a Transcriber/Extractor) — a bug or a future
 * misbehaving implementation returning a bare tmp-root path must not be
 * able to turn "delete my temp file" into "delete everyone's temp files".
 */
function assertRemovable(dir: string): void {
  const resolved = resolve(dir);
  const guarded = [resolve(tmpdir()), resolve(homedir()), sep];
  if (guarded.includes(resolved)) {
    throw new Error(`refusing to remove ${resolved}: not a directory this module created`);
  }
}

export function cleanupTempDir(dir: string): void {
  assertRemovable(dir);
  rmSync(dir, { recursive: true, force: true });
  activeDirs.delete(dir);
}
