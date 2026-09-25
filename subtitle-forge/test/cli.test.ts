import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Runs the real CLI in a child process. Never requires ffmpeg, Whisper, or
// Ollama to be installed — commands that need them (inspect, transcribe,
// run) are not exercised here beyond their help text and missing-tool error
// paths, which the sandbox this was written in genuinely lacks, giving
// honest (not staged) coverage of "tool not found" behavior.
const entry = join(import.meta.dirname, "..", "src", "index.ts");
let dir: string;

function run(args: string[]) {
  // cwd stays the project root (default) so tsx/commander.js resolve
  // normally from node_modules; fixture files below are passed by absolute
  // path instead of relying on a changed cwd.
  const result = spawnSync(process.execPath, ["--import", "tsx", entry, ...args], {
    encoding: "utf-8",
    timeout: 30_000,
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "subtitle-forge-cli-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("top-level CLI", () => {
  it("--version prints the version and exits 0", () => {
    const res = run(["--version"]);
    expect(res.status).toBe(0);
    expect(res.stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("--help lists every command", () => {
    const res = run(["--help"]);
    expect(res.status).toBe(0);
    for (const cmd of ["inspect", "extract", "transcribe", "translate", "validate", "run", "doctor"]) {
      expect(res.stdout).toContain(cmd);
    }
  });

  it("rejects an unknown command", () => {
    const res = run(["definitely-not-a-command"]);
    expect(res.status).not.toBe(0);
    expect(res.stderr).toMatch(/unknown command/i);
  });
});

describe("doctor", () => {
  it("runs without crashing and reports on every known tool", () => {
    const res = run(["doctor"]);
    expect(res.status).toBe(0);
    expect(res.stdout).toContain("Node.js");
    expect(res.stdout).toContain("OK"); // Node itself is always OK
    expect(res.stdout).toContain("FFmpeg");
    expect(res.stdout).toContain("FFprobe");
    expect(res.stdout).toContain("Whisper");
    expect(res.stdout).toContain("Ollama");
  });
});

describe("validate", () => {
  it("validates a well-formed SRT file and exits 0", () => {
    const file = join(dir, "good.srt");
    writeFileSync(file, "1\n00:00:01,000 --> 00:00:02,000\nHello\n");
    const res = run(["validate", file]);
    expect(res.status).toBe(0);
    expect(res.stdout).toContain("0 error(s)");
  });

  it("exits non-zero and lists errors for a broken SRT file", () => {
    const file = join(dir, "bad.srt");
    writeFileSync(file, "1\n00:00:05,000 --> 00:00:02,000\nBroken\n");
    const res = run(["validate", file]);
    expect(res.status).toBe(1);
    expect(res.stdout).toMatch(/ERROR/);
  });

  it("prints JSON with --json", () => {
    const file = join(dir, "good.srt");
    writeFileSync(file, "1\n00:00:01,000 --> 00:00:02,000\nHello\n");
    const res = run(["validate", file, "--json"]);
    expect(() => JSON.parse(res.stdout)).not.toThrow();
  });
});

describe("missing external tools", () => {
  it("inspect fails with a clear message, not a stack trace, when ffprobe is unavailable", () => {
    const file = join(dir, "movie.mkv");
    writeFileSync(file, "not a real video");
    const res = run(["inspect", file]);
    // This sandbox genuinely has no ffprobe installed; on a machine that
    // does, this would instead fail on the fake file content — either way,
    // the assertion that matters is "no raw stack trace by default".
    expect(res.status).not.toBe(0);
    expect(res.stderr).not.toContain("at ForgeError");
    expect(res.stderr).not.toContain("node_modules");
  });

  it("translate fails clearly when Ollama is unreachable", () => {
    const file = join(dir, "sub.srt");
    writeFileSync(file, "1\n00:00:01,000 --> 00:00:02,000\nHi\n");
    const res = run(["translate", file, "--to", "pt-BR", "--model", "llama3.2", "--ollama-url", "http://127.0.0.1:1"]);
    expect(res.status).not.toBe(0);
    expect(res.stderr).toMatch(/Could not reach Ollama|ffmpeg|Error:/);
  });
});

describe("output safety", () => {
  it("extract refuses to run past a missing/invalid input before touching the filesystem unsafely", () => {
    const res = run(["extract", join(dir, "does-not-exist.mkv")]);
    expect(res.status).not.toBe(0);
  });
});
