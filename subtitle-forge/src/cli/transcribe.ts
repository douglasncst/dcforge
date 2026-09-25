import { Command } from "commander";
import { writeFileSync } from "node:fs";
import type { SubtitleFormat } from "../core/types.js";
import { FfmpegSubtitleExtractor } from "../media/ffmpeg.js";
import { SrtWriter } from "../subtitle/srt.js";
import { VttWriter } from "../subtitle/vtt.js";
import { WhisperCppTranscriber } from "../transcription/whisperCppTranscriber.js";
import { cleanupTempDir } from "../util/tempFiles.js";
import { assertSafeToWrite, deriveOutputPath } from "../util/paths.js";
import { dirname } from "node:path";

interface TranscribeOpts {
  model?: string;
  language?: string;
  format: SubtitleFormat;
  output?: string;
  overwrite: boolean;
}

export function registerTranscribeCommand(program: Command): void {
  program
    .command("transcribe")
    .description("extract audio and transcribe it locally with Whisper (original language, no translation)")
    .argument("<input>", "path to the media file")
    .option("-m, --model <path>", "path to a local ggml/gguf Whisper model file")
    .option("-l, --language <code>", "spoken language code (e.g. en); omit to let Whisper detect it")
    .option("-f, --format <format>", "output format: srt or vtt", "srt")
    .option("-o, --output <path>", "output subtitle path")
    .option("--overwrite", "replace the output file if it already exists", false)
    .action(async (input: string, opts: TranscribeOpts) => {
      const extractor = new FfmpegSubtitleExtractor();
      const transcriber = new WhisperCppTranscriber();

      const audioPath = await extractor.extractAudioForTranscription(input);
      let document;
      try {
        document = await transcriber.transcribe(audioPath, { language: opts.language, modelPath: opts.model });
      } finally {
        cleanupTempDir(dirname(audioPath));
      }

      const output = opts.output ?? deriveOutputPath(input, opts.language ?? "orig", opts.format);
      assertSafeToWrite(output, input, opts.overwrite);
      const text = opts.format === "vtt" ? new VttWriter().write(document) : new SrtWriter().write(document);
      writeFileSync(output, text, "utf-8");
      console.log(`Wrote ${output} (${document.segments.length} segment(s))`);
    });
}
