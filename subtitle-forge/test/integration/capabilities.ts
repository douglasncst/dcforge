import { commandExists } from "../../src/util/processRunner.js";
import { WhisperCppTranscriber } from "../../src/transcription/whisperCppTranscriber.js";

export interface Capabilities {
  ffmpeg: boolean;
  ffprobe: boolean;
  whisper: boolean;
  ollama: boolean;
}

async function ollamaReachable(): Promise<boolean> {
  try {
    const res = await fetch("http://127.0.0.1:11434/api/version", { signal: AbortSignal.timeout(3_000) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function detectCapabilities(): Promise<Capabilities> {
  const [ffmpeg, ffprobe, whisper, ollama] = await Promise.all([
    commandExists("ffmpeg"),
    commandExists("ffprobe"),
    new WhisperCppTranscriber().isAvailable(),
    ollamaReachable(),
  ]);
  return { ffmpeg, ffprobe, whisper, ollama };
}

/** Prints exactly what will and won't actually run — never silently. */
export function reportCapabilities(caps: Capabilities): void {
  const line = (name: string, present: boolean) => `  ${name}: ${present ? "available — will run real checks" : "NOT available — those checks are skipped, not passed"}`;
  console.log(
    ["Integration test capabilities:", line("ffmpeg", caps.ffmpeg), line("ffprobe", caps.ffprobe), line("Whisper backend", caps.whisper), line("Ollama", caps.ollama)].join("\n"),
  );
}
