import { ForgeError } from "../core/errors.js";
import type { SubtitleExtractor } from "../core/types.js";
import { commandExists, run } from "../util/processRunner.js";
import { createTempDir, tempFilePath } from "../util/tempFiles.js";

// 16kHz mono 16-bit PCM WAV is the input shape every mainstream speech
// backend (whisper.cpp, faster-whisper) expects; extracting straight to it
// avoids a second conversion step and keeps the temp file small.
const TRANSCRIPTION_SAMPLE_RATE_HZ = 16_000;

export async function ffmpegAvailable(): Promise<boolean> {
  return commandExists("ffmpeg");
}

export class FfmpegSubtitleExtractor implements SubtitleExtractor {
  async extractSubtitle(input: string, streamIndex: number, outPath: string): Promise<void> {
    if (!(await ffmpegAvailable())) {
      throw new ForgeError("ffmpeg was not found. Install FFmpeg and ensure it is on PATH.");
    }
    const result = await run("ffmpeg", [
      "-y",
      "-i",
      input,
      "-map",
      `0:${streamIndex}`,
      "-c:s",
      "srt",
      outPath,
    ]);
    if (result.exitCode !== 0) {
      throw new ForgeError(`ffmpeg failed to extract subtitle stream ${streamIndex} from ${input}.`, {
        detail: result.stderr,
      });
    }
  }

  async extractAudioForTranscription(input: string, streamIndex?: number): Promise<string> {
    if (!(await ffmpegAvailable())) {
      throw new ForgeError("ffmpeg was not found. Install FFmpeg and ensure it is on PATH.");
    }
    const dir = createTempDir();
    const outPath = tempFilePath(dir, ".wav");
    const map = streamIndex !== undefined ? ["-map", `0:${streamIndex}`] : ["-map", "0:a:0"];
    const result = await run("ffmpeg", [
      "-y",
      "-i",
      input,
      ...map,
      "-vn",
      "-ac",
      "1",
      "-ar",
      String(TRANSCRIPTION_SAMPLE_RATE_HZ),
      "-f",
      "wav",
      outPath,
    ]);
    if (result.exitCode !== 0) {
      throw new ForgeError(`ffmpeg failed to extract audio from ${input}.`, { detail: result.stderr });
    }
    return outPath;
  }
}
