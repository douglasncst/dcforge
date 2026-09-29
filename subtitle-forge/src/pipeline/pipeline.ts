import { readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { ForgeError } from "../core/errors.js";
import type {
  MediaInspector,
  SubtitleDocument,
  SubtitleExtractor,
  SubtitleFormat,
  SubtitleWriter,
  Transcriber,
  Translator,
} from "../core/types.js";
import { SrtParser, SrtWriter } from "../subtitle/srt.js";
import { VttWriter } from "../subtitle/vtt.js";
import { validateSubtitle, type ValidationResult } from "../subtitle/validator.js";
import { cleanupTempDir, createTempDir, tempFilePath } from "../util/tempFiles.js";
import type { Logger } from "../util/output.js";
import { assertSafeToWrite, deriveOutputPath } from "../util/paths.js";

const TOTAL_STEPS = 6;

export interface PipelineOptions {
  input: string;
  toLanguage: string;
  fromLanguage?: string;
  format: SubtitleFormat;
  overwrite: boolean;
  outputPath?: string;
  translatorModel?: string;
  dryRun: boolean;
}

export interface PipelineDeps {
  inspector: MediaInspector;
  extractor: SubtitleExtractor;
  transcriber: Transcriber;
  translator: Translator;
  transcribeModelPath?: string;
}

export interface PipelineResult {
  outputPath: string;
  document: SubtitleDocument;
  validation: ValidationResult;
  usedExistingSubtitle: boolean;
}

export interface PipelinePlan {
  outputPath: string;
  hasUsableExistingSubtitle: boolean;
  willTranscribe: boolean;
  willTranslate: boolean;
  sourceLanguage: string | undefined;
}

function writerFor(format: SubtitleFormat): SubtitleWriter {
  return format === "vtt" ? new VttWriter() : new SrtWriter();
}

/** Resolves what the pipeline WOULD do, without running any expensive step — shared by --dry-run and the real run. */
export async function planPipeline(options: PipelineOptions, deps: PipelineDeps): Promise<PipelinePlan> {
  const media = await deps.inspector.inspect(options.input);
  const textSubtitle = media.subtitles.find((s) => !s.isImageBased);
  const sourceLanguage = options.fromLanguage ?? textSubtitle?.language ?? undefined;
  const willTranslate = sourceLanguage === undefined || sourceLanguage !== options.toLanguage;

  return {
    outputPath: options.outputPath ?? deriveOutputPath(options.input, options.toLanguage, options.format),
    hasUsableExistingSubtitle: textSubtitle !== undefined,
    willTranscribe: textSubtitle === undefined,
    willTranslate,
    sourceLanguage,
  };
}

/**
 * INPUT -> inspect -> (usable subtitle? extract : extract audio -> transcribe)
 * -> translate (if needed) -> validate -> write.
 *
 * Local-only guarantees are enforced by wiring, not by a runtime check here:
 * the CLI layer only ever constructs a local Transcriber/Translator to pass
 * in when --local is set, and this function never substitutes or falls back
 * to a different implementation on its own.
 */
export async function runPipeline(
  options: PipelineOptions,
  deps: PipelineDeps,
  logger: Logger,
): Promise<PipelineResult> {
  logger.step(1, TOTAL_STEPS, "Inspecting media");
  const plan = await planPipeline(options, deps);

  let original: SubtitleDocument;
  if (plan.hasUsableExistingSubtitle) {
    logger.step(2, TOTAL_STEPS, "Extracting existing subtitle");
    const media = await deps.inspector.inspect(options.input);
    const textSubtitle = media.subtitles.find((s) => !s.isImageBased)!;
    const tempDir = createTempDir();
    try {
      const srtPath = tempFilePath(tempDir, ".srt");
      await deps.extractor.extractSubtitle(options.input, textSubtitle.index, srtPath);
      original = new SrtParser().parse(readFileSync(srtPath, "utf-8"));
    } finally {
      cleanupTempDir(tempDir);
    }
    logger.step(3, TOTAL_STEPS, "Transcribing (skipped — reused existing subtitle)");
  } else {
    logger.step(2, TOTAL_STEPS, "Extracting audio");
    const audioPath = await deps.extractor.extractAudioForTranscription(options.input);
    try {
      logger.step(3, TOTAL_STEPS, "Transcribing");
      original = await deps.transcriber.transcribe(audioPath, {
        language: options.fromLanguage,
        modelPath: deps.transcribeModelPath,
      });
    } finally {
      cleanupTempDir(dirname(audioPath));
    }
  }

  let translated: SubtitleDocument;
  if (plan.willTranslate) {
    logger.step(4, TOTAL_STEPS, "Translating");
    translated = await deps.translator.translate(original, {
      from: plan.sourceLanguage,
      to: options.toLanguage,
      model: options.translatorModel,
      onProgress: (done, total) => logger.progress(`Translating ${done}/${total} batches`),
    });
  } else {
    logger.step(4, TOTAL_STEPS, "Translating (skipped — already in the target language)");
    translated = original;
  }

  logger.step(5, TOTAL_STEPS, "Validating");
  const validation = validateSubtitle(translated);
  for (const w of validation.warnings) {
    logger.warn(`segment ${w.segmentId}: ${w.message}`);
  }
  if (!validation.valid) {
    throw new ForgeError(
      `Generated subtitle failed validation (${validation.errors.length} error(s)): ` +
        validation.errors.map((e) => `segment ${e.segmentId}: ${e.message}`).join("; "),
    );
  }

  logger.step(6, TOTAL_STEPS, "Writing subtitle");
  assertSafeToWrite(plan.outputPath, options.input, options.overwrite);
  writeFileSync(plan.outputPath, writerFor(options.format).write(translated), "utf-8");

  return { outputPath: plan.outputPath, document: translated, validation, usedExistingSubtitle: plan.hasUsableExistingSubtitle };
}
