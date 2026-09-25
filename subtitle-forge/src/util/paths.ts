import { existsSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { ForgeError } from "../core/errors.js";
import type { SubtitleFormat } from "../core/types.js";

/** `movie.mkv`, "pt-BR", "srt" -> `movie.pt-BR.srt` (same directory as input). */
export function deriveOutputPath(inputPath: string, languageTag: string, format: SubtitleFormat): string {
  const dir = dirname(inputPath);
  const base = basename(inputPath, extname(inputPath));
  return join(dir, `${base}.${languageTag}.${format}`);
}

/**
 * Refuses to silently overwrite an existing file, and refuses to write over
 * the input file under any circumstances — `--overwrite` only waives the
 * first check.
 */
export function assertSafeToWrite(outputPath: string, inputPath: string, overwrite: boolean): void {
  if (resolve(outputPath) === resolve(inputPath)) {
    throw new ForgeError(`refusing to write output over the input file (${outputPath}).`);
  }
  if (!overwrite && existsSync(outputPath)) {
    throw new ForgeError(
      `${outputPath} already exists. Pass --overwrite to replace it, or choose a different output path.`,
    );
  }
}
