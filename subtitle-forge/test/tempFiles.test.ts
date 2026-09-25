import { describe, expect, it, afterEach } from "vitest";
import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { cleanupTempDir, createTempDir, tempFilePath } from "../src/util/tempFiles.js";

let dir: string | undefined;

afterEach(() => {
  if (dir && existsSync(dir)) cleanupTempDir(dir);
  dir = undefined;
});

describe("createTempDir", () => {
  it("creates a directory that exists", () => {
    dir = createTempDir();
    expect(existsSync(dir)).toBe(true);
  });

  it("creates a different directory on each call (unpredictable name)", () => {
    const a = createTempDir();
    const b = createTempDir();
    expect(a).not.toBe(b);
    cleanupTempDir(a);
    cleanupTempDir(b);
  });

  it("does not add another listener on each additional call (installed once, not per call)", () => {
    // The install-once guard is a module-level singleton, so an earlier
    // test in this run may have already triggered it — this only asserts
    // the count stops growing after that point, not an absolute baseline.
    dir = createTempDir();
    const afterFirst = { exit: process.listenerCount("exit"), sigint: process.listenerCount("SIGINT") };
    const secondDir = createTempDir();
    expect(process.listenerCount("exit")).toBe(afterFirst.exit);
    expect(process.listenerCount("SIGINT")).toBe(afterFirst.sigint);
    cleanupTempDir(secondDir);
  });
});

describe("tempFilePath", () => {
  it("returns a path inside the given directory with the given extension", () => {
    dir = createTempDir();
    const file = tempFilePath(dir, ".wav");
    expect(dirname(file)).toBe(dir);
    expect(file.endsWith(".wav")).toBe(true);
  });

  it("returns a different name on each call", () => {
    dir = createTempDir();
    expect(tempFilePath(dir, ".wav")).not.toBe(tempFilePath(dir, ".wav"));
  });
});

describe("cleanupTempDir", () => {
  it("removes the directory and its contents", () => {
    dir = createTempDir();
    writeFileSync(tempFilePath(dir, ".txt"), "data");
    expect(readdirSync(dir)).toHaveLength(1);

    cleanupTempDir(dir);
    expect(existsSync(dir)).toBe(false);
    dir = undefined;
  });

  it("does not throw when called on an already-removed directory", () => {
    dir = createTempDir();
    cleanupTempDir(dir);
    expect(() => cleanupTempDir(dir!)).not.toThrow();
    dir = undefined;
  });
});
