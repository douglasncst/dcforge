import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// End-to-end tests that run the real CLI in a child process with its state
// directory pointed at a temporary folder. They never reach a real Supabase
// project: SUPABASE_URL points at a closed local port.
const entry = join(import.meta.dirname, "..", "src", "index.ts");
let home: string;

function run(args: string[], input = "") {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    CLAUDE_CONSOLE_HOME: home,
    SUPABASE_URL: "http://127.0.0.1:9",
    SUPABASE_ANON_KEY: "test-anon-key",
  };
  const result = spawnSync(process.execPath, ["--import", "tsx", entry, ...args], {
    env,
    input,
    encoding: "utf-8",
    timeout: 30_000,
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "claude-console-cli-"));
});

afterEach(() => {
  rmSync(home, { recursive: true, force: true });
});

describe("auth password handling", () => {
  it.each(["login", "signup"])("rejects a password passed as an argument to %s", (cmd) => {
    const res = run(["auth", cmd, "dev@example.com", "hunter2"]);
    expect(res.status).not.toBe(0);
    expect(res.stderr).toMatch(/too many arguments/);
  });

  it("does not list a password argument in help", () => {
    const res = run(["auth", "login", "--help"]);
    expect(res.status).toBe(0);
    expect(res.stdout).toContain("--password-stdin");
    expect(res.stdout).not.toMatch(/<password>/);
  });

  it("refuses to prompt without a terminal", () => {
    const res = run(["auth", "login", "dev@example.com"]);
    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(/--password-stdin/);
  });

  it("rejects an empty password from stdin", () => {
    const res = run(["auth", "login", "dev@example.com", "--password-stdin"], "\n");
    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(/must not be empty/);
  });

  it("reads the password from stdin and never prints it", () => {
    const res = run(["auth", "login", "dev@example.com", "--password-stdin"], "hunter2-secret\n");
    // The login itself fails because no Supabase server is listening.
    expect(res.status).toBe(1);
    expect(res.stdout + res.stderr).not.toContain("hunter2-secret");
    expect(readdirSync(home)).toEqual([]);
  });
});

describe("config commands", () => {
  it("persists values in a private state file", () => {
    expect(run(["config", "set", "supabase_url", "https://example.supabase.co"]).status).toBe(0);
    const get = run(["config", "get", "supabase_url"]);
    expect(get.status).toBe(0);
    expect(get.stdout.trim()).toBe("https://example.supabase.co");
    if (process.platform !== "win32") {
      expect(statSync(join(home, "state.json")).mode & 0o777).toBe(0o600);
    }
  });

  it("fails for a missing key", () => {
    const res = run(["config", "get", "nope"]);
    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(/no config value set/);
  });
});

describe("session guard", () => {
  it("requires login before project commands", () => {
    const res = run(["projects", "list"]);
    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(/not logged in/);
  });

  it("whoami fails when logged out", () => {
    const res = run(["auth", "whoami"]);
    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(/not logged in/);
  });
});

describe("errors thrown from library code", () => {
  // resolveSupabaseConfig() and getAuthedClient() (src/lib/supabase.ts) throw
  // CliError instead of calling process.exit directly. These confirm the
  // error still reaches the user and the process with the right exit code
  // when it crosses an async commander action and the top-level handler.
  function runWithoutSupabaseConfig(args: string[]) {
    const env: NodeJS.ProcessEnv = { ...process.env, CLAUDE_CONSOLE_HOME: home };
    delete env.SUPABASE_URL;
    delete env.SUPABASE_ANON_KEY;
    const result = spawnSync(process.execPath, ["--import", "tsx", entry, ...args], {
      env,
      encoding: "utf-8",
      timeout: 30_000,
    });
    return { status: result.status, stdout: result.stdout, stderr: result.stderr };
  }

  it("reports missing Supabase configuration with a clean exit, not a stack trace", () => {
    const res = runWithoutSupabaseConfig(["projects", "list"]);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("Supabase is not configured");
    expect(res.stderr).not.toContain("at CliError");
    expect(res.stderr).not.toContain("node_modules");
  });

  it("takes the same path through an async command action (auth login)", () => {
    const res = runWithoutSupabaseConfig(["auth", "login", "dev@example.com", "--password-stdin"]);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("Supabase is not configured");
  });
});
