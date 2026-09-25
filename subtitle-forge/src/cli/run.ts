import { Command } from "commander";
import { ForgeError } from "../core/errors.js";
import type { SubtitleFormat } from "../core/types.js";
import { FfmpegSubtitleExtractor } from "../media/ffmpeg.js";
import { FfprobeMediaInspector } from "../media/ffprobe.js";
import { WhisperCppTranscriber } from "../transcription/whisperCppTranscriber.js";
import { OllamaTranslator } from "../translation/ollamaTranslator.js";
import { planPipeline, runPipeline, type PipelineDeps, type PipelineOptions } from "../pipeline/pipeline.js";
import { createLogger } from "../util/output.js";
import { assertLocalOllamaUrl } from "../util/localMode.js";

interface RunOpts {
  to: string;
  from?: string;
  transcriber: string;
  translator: string;
  model?: string;
  whisperModel?: string;
  ollamaUrl: string;
  local: boolean;
  format: SubtitleFormat;
  output?: string;
  overwrite: boolean;
  dryRun: boolean;
  verbose: boolean;
}

export function registerRunCommand(program: Command): void {
  program
    .command("run")
    .description("full pipeline: inspect -> extract/transcribe -> translate -> validate -> write")
    .argument("<input>", "path to the media file")
    .requiredOption("--to <lang>", "target language tag, e.g. pt-BR")
    .option("--from <lang>", "source language; auto-detected from an existing subtitle stream when omitted")
    .option("--transcriber <id>", "transcription backend", "whisper")
    .option("--translator <id>", "translation backend", "ollama")
    .option("--model <name>", "translator model name, e.g. llama3.2")
    .option("--whisper-model <path>", "path to a local ggml/gguf Whisper model file")
    .option("--ollama-url <url>", "Ollama endpoint", "http://127.0.0.1:11434")
    .option("--local", "refuse to run unless every step stays on this machine", false)
    .option("-f, --format <format>", "output format: srt or vtt", "srt")
    .option("-o, --output <path>", "output path; defaults next to the input with the target language tag")
    .option("--overwrite", "replace the output file if it already exists", false)
    .option("--dry-run", "show the plan without running any expensive step", false)
    .option("--verbose", "print external calls, batches, and timing", false)
    .action(async (input: string, opts: RunOpts) => {
      if (opts.transcriber !== "whisper") {
        throw new ForgeError(`unknown transcriber "${opts.transcriber}". Only "whisper" is available today.`);
      }
      if (opts.translator !== "ollama") {
        throw new ForgeError(`unknown translator "${opts.translator}". Only "ollama" is available today.`);
      }
      if (opts.local) {
        assertLocalOllamaUrl(opts.ollamaUrl);
      }

      const logger = createLogger(opts.verbose);
      const deps: PipelineDeps = {
        inspector: new FfprobeMediaInspector(),
        extractor: new FfmpegSubtitleExtractor(),
        transcriber: new WhisperCppTranscriber(),
        translator: new OllamaTranslator({ baseUrl: opts.ollamaUrl, onDebug: logger.debug }),
        transcribeModelPath: opts.whisperModel,
      };
      const pipelineOptions: PipelineOptions = {
        input,
        toLanguage: opts.to,
        fromLanguage: opts.from,
        format: opts.format,
        overwrite: opts.overwrite,
        outputPath: opts.output,
        translatorModel: opts.model,
        dryRun: opts.dryRun,
      };

      if (opts.dryRun) {
        const plan = await planPipeline(pipelineOptions, deps);
        console.log(`input:              ${input}`);
        console.log(`source language:    ${plan.sourceLanguage ?? "unknown (will detect during transcription)"}`);
        console.log(`target language:    ${opts.to}`);
        console.log(`strategy:           ${plan.hasUsableExistingSubtitle ? "extract existing subtitle" : "extract audio + transcribe"}`);
        console.log(`transcriber:        ${plan.willTranscribe ? opts.transcriber : "(not needed)"}`);
        console.log(`translator:         ${plan.willTranslate ? opts.translator : "(not needed — already target language)"}`);
        if (plan.willTranslate) console.log(`translator model:   ${opts.model ?? "(none given — will fail)"}`);
        console.log(`output:             ${plan.outputPath}`);
        return;
      }

      const result = await runPipeline(pipelineOptions, deps, logger);
      console.log(
        `Wrote ${result.outputPath} (${result.document.segments.length} segment(s), ` +
          `${result.validation.warnings.length} warning(s))`,
      );
    });
}
