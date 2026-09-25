import { closeSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, writeSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

export interface Session {
  email: string;
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number | null;
}

export interface State {
  session: Session | null;
  config: Record<string, string>;
}

function stateDir(): string {
  return process.env.CLAUDE_CONSOLE_HOME ?? join(homedir(), ".claude-console");
}

function stateFile(): string {
  return join(stateDir(), "state.json");
}

function emptyState(): State {
  return { session: null, config: {} };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeSession(value: unknown): Session | null {
  if (!isRecord(value)) return null;
  const { email, userId, accessToken, refreshToken, expiresAt } = value;
  if (
    typeof email !== "string" ||
    typeof userId !== "string" ||
    typeof accessToken !== "string" ||
    typeof refreshToken !== "string"
  ) {
    return null;
  }
  return { email, userId, accessToken, refreshToken, expiresAt: typeof expiresAt === "number" ? expiresAt : null };
}

function normalizeConfig(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
}

/**
 * Moves an unreadable state file aside instead of letting the next save
 * overwrite it, so a corrupted file never silently destroys data.
 */
function quarantine(file: string, reason: string): void {
  const backup = `${file}.corrupt-${Date.now()}`;
  renameSync(file, backup);
  console.error(`Warning: ${reason} Moved it to ${backup} and started with empty state.`);
}

export function loadState(): State {
  const file = stateFile();
  let raw: string;
  try {
    raw = readFileSync(file, "utf-8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return emptyState();
    }
    // Returning empty state here would let the next save overwrite a file we
    // merely failed to read, so surface the problem instead.
    throw new Error(`could not read ${file}: ${(err as Error).message}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    quarantine(file, `${file} is not valid JSON.`);
    return emptyState();
  }
  if (!isRecord(parsed)) {
    quarantine(file, `${file} does not contain a JSON object.`);
    return emptyState();
  }
  return { session: normalizeSession(parsed.session), config: normalizeConfig(parsed.config) };
}

/**
 * Writes the state atomically: the data goes to a private (0600) temporary
 * file in the same directory, is flushed to disk, and then renamed over the
 * old file. A crash mid-write leaves the previous file intact, and the final
 * file is always owner-only even if an older version was created with looser
 * permissions.
 */
export function saveState(state: State): void {
  const dir = stateDir();
  mkdirSync(dir, { recursive: true, mode: 0o700 });

  const file = stateFile();
  const tmp = `${file}.${process.pid}.${randomUUID()}.tmp`;
  const fd = openSync(tmp, "wx", 0o600);
  try {
    writeSync(fd, JSON.stringify(state, null, 2));
    fsyncSync(fd);
    closeSync(fd);
    renameSync(tmp, file);
  } catch (err) {
    try {
      closeSync(fd);
    } catch {
      // already closed
    }
    rmSync(tmp, { force: true });
    throw err;
  }
}

export function newId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

export function stateFilePath(): string {
  return stateFile();
}
