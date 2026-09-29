import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { chmodSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadState, saveState, newId } from "../src/lib/local.js";

let tmpHome: string;
let originalHome: string | undefined;

beforeEach(() => {
  tmpHome = mkdtempSync(join(tmpdir(), "claude-console-test-"));
  originalHome = process.env.CLAUDE_CONSOLE_HOME;
  process.env.CLAUDE_CONSOLE_HOME = tmpHome;
});

afterEach(() => {
  if (originalHome === undefined) delete process.env.CLAUDE_CONSOLE_HOME;
  else process.env.CLAUDE_CONSOLE_HOME = originalHome;
  rmSync(tmpHome, { recursive: true, force: true });
  vi.restoreAllMocks();
});

const session = {
  email: "dev@example.com",
  userId: "user-1",
  accessToken: "access-token",
  refreshToken: "refresh-token",
  expiresAt: 1234567890,
};

describe("local state", () => {
  it("returns empty state when nothing is persisted yet", () => {
    const state = loadState();
    expect(state.session).toBeNull();
    expect(state.config).toEqual({});
  });

  it("round-trips saved state", () => {
    const state = loadState();
    state.config.supabase_url = "https://example.supabase.co";
    state.session = { ...session };
    saveState(state);

    const reloaded = loadState();
    expect(reloaded.config.supabase_url).toBe("https://example.supabase.co");
    expect(reloaded.session).toEqual(session);
  });

  it("generates ids with the given prefix", () => {
    expect(newId("proj")).toMatch(/^proj_[a-f0-9]{12}$/);
  });
});

describe.skipIf(process.platform === "win32")("state file permissions", () => {
  it("creates the state directory as 0700 and the file as 0600", () => {
    const home = join(tmpHome, "nested");
    process.env.CLAUDE_CONSOLE_HOME = home;
    saveState({ session: { ...session }, config: {} });

    expect(statSync(home).mode & 0o777).toBe(0o700);
    expect(statSync(join(home, "state.json")).mode & 0o777).toBe(0o600);
  });

  it("tightens a state file that was created with looser permissions", () => {
    const file = join(tmpHome, "state.json");
    writeFileSync(file, JSON.stringify({ session: null, config: {} }));
    chmodSync(file, 0o644);

    saveState({ session: { ...session }, config: {} });
    expect(statSync(file).mode & 0o777).toBe(0o600);
  });

  it("tightens a state directory that already existed with looser permissions", () => {
    // Simulates upgrading from a version of the CLI that created the
    // directory without restrictive permissions (mkdirSync's mode argument
    // only applies when it actually creates the directory).
    chmodSync(tmpHome, 0o755);
    saveState({ session: { ...session }, config: {} });
    expect(statSync(tmpHome).mode & 0o777).toBe(0o700);
  });
});

describe("atomic writes", () => {
  it("leaves no temporary files behind", () => {
    saveState({ session: null, config: { a: "1" } });
    saveState({ session: null, config: { a: "2" } });
    expect(readdirSync(tmpHome)).toEqual(["state.json"]);
    expect(loadState().config.a).toBe("2");
  });

  it("keeps every sequential write fully readable, never a partial one", () => {
    for (let i = 0; i < 10; i++) {
      saveState({ session: null, config: { i: String(i) } });
      expect(loadState().config.i).toBe(String(i));
    }
    expect(readdirSync(tmpHome)).toEqual(["state.json"]);
  });

  it("removes the temporary file and does not touch the previous state when the final rename fails", () => {
    saveState({ session: null, config: { before: "kept" } });

    // Replace the destination with a non-empty directory so the rename in
    // saveState's try block fails with ENOTEMPTY/EISDIR, exercising its
    // catch branch instead of the happy path.
    const file = join(tmpHome, "state.json");
    rmSync(file);
    mkdirSync(file);
    writeFileSync(join(file, "keep.txt"), "x");

    expect(() => saveState({ session: null, config: { before: "clobbered?" } })).toThrow();

    const leftoverTmp = readdirSync(tmpHome).filter((f) => f.includes(".tmp"));
    expect(leftoverTmp).toEqual([]);
    // The half-finished write must not have left a mix of the old and new
    // state anywhere it could be read back.
    expect(readdirSync(file)).toEqual(["keep.txt"]);
  });
});

describe("corrupted state", () => {
  it("moves invalid JSON aside instead of discarding it", () => {
    const warn = vi.spyOn(console, "error").mockImplementation(() => {});
    const file = join(tmpHome, "state.json");
    writeFileSync(file, "{ not json");

    const state = loadState();
    expect(state).toEqual({ session: null, config: {} });

    const backups = readdirSync(tmpHome).filter((f) => f.startsWith("state.json.corrupt-"));
    expect(backups).toHaveLength(1);
    expect(readFileSync(join(tmpHome, backups[0]), "utf-8")).toBe("{ not json");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("is not valid JSON"));
  });

  it("moves a non-object JSON document aside", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    writeFileSync(join(tmpHome, "state.json"), "[]");

    expect(loadState()).toEqual({ session: null, config: {} });
    expect(readdirSync(tmpHome).some((f) => f.startsWith("state.json.corrupt-"))).toBe(true);
  });

  it("drops malformed fields but keeps valid ones", () => {
    writeFileSync(
      join(tmpHome, "state.json"),
      JSON.stringify({ session: { email: "x" }, config: { ok: "yes", bad: 42 } }),
    );
    expect(loadState()).toEqual({ session: null, config: { ok: "yes" } });
  });

  it("refuses to treat an unreadable path as empty state", () => {
    // A directory where the file should be makes the read fail with EISDIR,
    // which must not be mistaken for "no state yet".
    mkdirSync(join(tmpHome, "state.json"));
    expect(() => loadState()).toThrow(/could not read/);
  });
});
