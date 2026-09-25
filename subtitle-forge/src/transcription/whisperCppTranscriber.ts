import { readFileSync, rmSync } from "node:fs";
import { ForgeError } from "../core/errors.js";
import type { SubtitleDocument, SubtitleSegment, TranscribeOptions, Transcriber } from "../core/types.js";
import { parseTimestampMs } from "../subtitle/timecode.js";
import { commandExists, run } from "../util/processRunner.js";
import { createTempDir, tempFilePath } from "../util/tempFiles.js";

// whisper.cpp renamed its CLI binary from `main` to `whisper-cli` around
// its 2024 restructuring; both names are still in circulation depending on
// how a user built or packaged it, so detect either.
const BINARY_NAMES = ["whisper-cli", "main"] as const;

interface WhisperCppSegment {
  offsets?: { from?: number; to?: number };
  timestamps?: { from?: string; to?: string };
  text?: string;
}

interface WhisperCppJson {
  transcription?: WhisperCppSegment[];
}

/** Pure parsing of whisper.cpp's `-oj`/`--output-json` file, unit-testable without the binary. */
export function parseWhisperCppJson(raw: string): SubtitleDocument {
  let data: WhisperCppJson;
  try {
    data = JSON.parse(raw) as WhisperCppJson;
  } catch (err) {
    throw new ForgeError("whisper.cpp did not produce valid JSON output.", {
      detail: err instanceof Error ? err.message : String(err),
    });
  }

  const segments: SubtitleSegment[] = [];
  for (const entry of data.transcription ?? []) {
    const text = (entry.text ?? "").trim();
    if (text === "") continue;

    let startMs: number | null = entry.offsets?.from ?? null;
    let endMs: number | null = entry.offsets?.to ?? null;
    if (startMs === null && entry.timestamps?.from) {
      try {
        startMs = parseTimestampMs(entry.timestamps.from);
      } catch {
        continue;
      }
    }
    if (endMs === null && entry.timestamps?.to) {
      try {
        endMs = parseTimestampMs(entry.timestamps.to);
      } catch {
        continue;
      }
    }
    if (startMs === null || endMs === null) continue;

    segments.push({ id: segments.length + 1, startMs, endMs, text });
  }

  return { segments };
}

export class WhisperCppTranscriber implements Transcriber {
  readonly id = "whisper-cpp";
  private resolvedBinary: string | null = null;

  private async resolveBinary(): Promise<string | null> {
    if (this.resolvedBinary) return this.resolvedBinary;
    for (const name of BINARY_NAMES) {
      // whisper.cpp's binaries print version/help info on --help; any
      // response (rather than ENOENT) means the binary exists.
      if (await commandExists(name, ["--help"])) {
        this.resolvedBinary = name;
        return name;
      }
    }
    return null;
  }

  async isAvailable(): Promise<boolean> {
    return (await this.resolveBinary()) !== null;
  }

  async transcribe(audioPath: string, options: TranscribeOptions): Promise<SubtitleDocument> {
    const binary = await this.resolveBinary();
    if (!binary) {
      throw new ForgeError(
        "No local Whisper backend found. Install whisper.cpp (binary `whisper-cli` or `main`) and " +
          "put it on PATH — see subtitle-forge/README.md#whisper.",
      );
    }
    if (!options.modelPath) {
      throw new ForgeError(
        "Transcription needs a local model file: pass --model <path to a ggml/gguf Whisper model>. " +
          "Models are listed at https://github.com/ggml-org/whisper.cpp — none is downloaded automatically.",
      );
    }

    const dir = createTempDir();
    const outBase = tempFilePath(dir, "").replace(/\.$/, "");
    try {
      const args = [
        "-m",
        options.modelPath,
        "-f",
        audioPath,
        "-oj", // write JSON with per-segment offsets
        "-of",
        outBase,
        "-nt", // don't also print timestamps to stdout; we read the JSON file
      ];
      if (options.language) {
        args.push("-l", options.language);
      }

      const result = await run(binary, args, { signal: options.signal });
      if (result.exitCode !== 0) {
        throw new ForgeError(`${binary} failed to transcribe ${audioPath}.`, { detail: result.stderr });
      }

      const jsonPath = `${outBase}.json`;
      let raw: string;
      try {
        raw = readFileSync(jsonPath, "utf-8");
      } catch (err) {
        throw new ForgeError(`${binary} did not produce the expected output file (${jsonPath}).`, {
          detail: err instanceof Error ? err.message : String(err),
        });
      }
      return parseWhisperCppJson(raw);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
}
