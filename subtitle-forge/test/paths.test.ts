import { describe, expect, it, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertSafeToWrite, deriveOutputPath } from "../src/util/paths.js";

describe("deriveOutputPath", () => {
  it("inserts the language tag before the extension", () => {
    expect(deriveOutputPath("/videos/movie.mkv", "pt-BR", "srt")).toBe(join("/videos", "movie.pt-BR.srt"));
  });

  it("handles paths with spaces", () => {
    expect(deriveOutputPath("/my videos/the movie (2024).mkv", "pt-BR", "srt")).toBe(
      join("/my videos", "the movie (2024).pt-BR.srt"),
    );
  });

  it("handles Unicode filenames", () => {
    expect(deriveOutputPath("/videos/fïlmé_日本語.mkv", "pt-BR", "vtt")).toBe(join("/videos", "fïlmé_日本語.pt-BR.vtt"));
  });

  it("handles a filename with no extension", () => {
    expect(deriveOutputPath("/videos/movie", "pt-BR", "srt")).toBe(join("/videos", "movie.pt-BR.srt"));
  });
});

describe("assertSafeToWrite", () => {
  let dir: string;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("never allows writing over the input, even with --overwrite", () => {
    dir = mkdtempSync(join(tmpdir(), "subtitle-forge-paths-"));
    const input = join(dir, "movie.mkv");
    expect(() => assertSafeToWrite(input, input, true)).toThrow(/refusing to write output over the input/);
  });

  it("refuses to replace an existing output file without --overwrite", () => {
    dir = mkdtempSync(join(tmpdir(), "subtitle-forge-paths-"));
    const output = join(dir, "movie.pt-BR.srt");
    writeFileSync(output, "existing");
    expect(() => assertSafeToWrite(output, join(dir, "movie.mkv"), false)).toThrow(/already exists/);
  });

  it("allows replacing an existing output file with --overwrite", () => {
    dir = mkdtempSync(join(tmpdir(), "subtitle-forge-paths-"));
    const output = join(dir, "movie.pt-BR.srt");
    writeFileSync(output, "existing");
    expect(() => assertSafeToWrite(output, join(dir, "movie.mkv"), true)).not.toThrow();
  });

  it("allows a new output path with no --overwrite needed", () => {
    dir = mkdtempSync(join(tmpdir(), "subtitle-forge-paths-"));
    expect(() =>
      assertSafeToWrite(join(dir, "movie.pt-BR.srt"), join(dir, "movie.mkv"), false),
    ).not.toThrow();
  });
});
