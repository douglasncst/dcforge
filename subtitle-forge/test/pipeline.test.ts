import { describe, expect, it, afterEach } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { planPipeline, runPipeline, type PipelineDeps, type PipelineOptions } from "../src/pipeline/pipeline.js";
import type { MediaInfo, MediaInspector, SubtitleDocument, SubtitleExtractor, Transcriber, Translator } from "../src/core/types.js";
import { createLogger } from "../src/util/output.js";

function baseMedia(overrides: Partial<MediaInfo> = {}): MediaInfo {
  return { path: "in.mkv", container: "matroska", durationSec: 100, video: [], audio: [], subtitles: [], ...overrides };
}

class FakeInspector implements MediaInspector {
  constructor(private info: MediaInfo) {}
  async inspect() {
    return this.info;
  }
}

class FakeExtractor implements SubtitleExtractor {
  extractedAudio: string[] = [];
  extractedSubtitle: number[] = [];
  constructor(private srtContent = "1\n00:00:00,000 --> 00:00:01,000\noriginal\n") {}
  async extractSubtitle(_input: string, streamIndex: number, outPath: string) {
    this.extractedSubtitle.push(streamIndex);
    writeFileSync(outPath, this.srtContent, "utf-8");
  }
  async extractAudioForTranscription() {
    this.extractedAudio.push("called");
    return "/tmp/fake-audio.wav";
  }
}

class FakeTranscriber implements Transcriber {
  readonly id = "fake";
  async isAvailable() {
    return true;
  }
  async transcribe(): Promise<SubtitleDocument> {
    return { segments: [{ id: 1, startMs: 0, endMs: 1000, text: "transcribed" }] };
  }
}

class FakeTranslator implements Translator {
  readonly id = "fake";
  calls = 0;
  async isAvailable() {
    return true;
  }
  async translate(doc: SubtitleDocument): Promise<SubtitleDocument> {
    this.calls++;
    return { segments: doc.segments.map((s) => ({ ...s, text: `[translated] ${s.text}` })) };
  }
}

let dir: string;
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
});

function makeOptions(overrides: Partial<PipelineOptions> = {}): PipelineOptions {
  dir = mkdtempSync(join(tmpdir(), "subtitle-forge-pipeline-"));
  return {
    input: join(dir, "movie.mkv"),
    toLanguage: "pt-BR",
    format: "srt",
    overwrite: false,
    dryRun: false,
    ...overrides,
  };
}

describe("planPipeline", () => {
  it("plans transcription + translation when there is no usable subtitle and no known source language", async () => {
    const deps: PipelineDeps = {
      inspector: new FakeInspector(baseMedia()),
      extractor: new FakeExtractor(),
      transcriber: new FakeTranscriber(),
      translator: new FakeTranslator(),
    };
    const plan = await planPipeline(makeOptions(), deps);
    expect(plan.willTranscribe).toBe(true);
    expect(plan.hasUsableExistingSubtitle).toBe(false);
    expect(plan.willTranslate).toBe(true);
  });

  it("plans extraction and skips translation when a text subtitle already matches the target language", async () => {
    const media = baseMedia({ subtitles: [{ index: 2, codec: "subrip", language: "pt-BR", title: null, kind: "subtitle", isImageBased: false, default: true, forced: false }] });
    const deps: PipelineDeps = {
      inspector: new FakeInspector(media),
      extractor: new FakeExtractor(),
      transcriber: new FakeTranscriber(),
      translator: new FakeTranslator(),
    };
    const plan = await planPipeline(makeOptions(), deps);
    expect(plan.hasUsableExistingSubtitle).toBe(true);
    expect(plan.willTranslate).toBe(false);
  });

  it("skips an image-based subtitle stream and falls back to transcription", async () => {
    const media = baseMedia({
      subtitles: [{ index: 2, codec: "hdmv_pgs_subtitle", language: "en", title: null, kind: "subtitle", isImageBased: true, default: true, forced: false }],
    });
    const deps: PipelineDeps = {
      inspector: new FakeInspector(media),
      extractor: new FakeExtractor(),
      transcriber: new FakeTranscriber(),
      translator: new FakeTranslator(),
    };
    const plan = await planPipeline(makeOptions(), deps);
    expect(plan.hasUsableExistingSubtitle).toBe(false);
    expect(plan.willTranscribe).toBe(true);
  });
});

describe("runPipeline", () => {
  it("transcribes and translates when there is no usable subtitle, and writes the output", async () => {
    const options = makeOptions();
    writeFileSync(options.input, "");
    const translator = new FakeTranslator();
    const deps: PipelineDeps = {
      inspector: new FakeInspector(baseMedia()),
      extractor: new FakeExtractor(),
      transcriber: new FakeTranscriber(),
      translator,
    };
    const result = await runPipeline(options, deps, createLogger(false));
    expect(translator.calls).toBe(1);
    expect(result.document.segments[0].text).toBe("[translated] transcribed");
    expect(existsSync(result.outputPath)).toBe(true);
    expect(readFileSync(result.outputPath, "utf-8")).toContain("[translated] transcribed");
  });

  it("extracts and skips translation when the existing subtitle already matches the target language", async () => {
    const media = baseMedia({ subtitles: [{ index: 2, codec: "subrip", language: "pt-BR", title: null, kind: "subtitle", isImageBased: false, default: true, forced: false }] });
    const options = makeOptions();
    writeFileSync(options.input, "");
    const extractor = new FakeExtractor();
    const translator = new FakeTranslator();
    const deps: PipelineDeps = { inspector: new FakeInspector(media), extractor, transcriber: new FakeTranscriber(), translator };

    const result = await runPipeline(options, deps, createLogger(false));
    expect(extractor.extractedSubtitle).toEqual([2]);
    expect(translator.calls).toBe(0);
    expect(result.document.segments[0].text).toBe("original");
  });

  it("never overwrites an existing output without --overwrite", async () => {
    const options = makeOptions();
    writeFileSync(options.input, "");
    const outputPath = options.input.replace(".mkv", ".pt-BR.srt");
    writeFileSync(outputPath, "existing content");
    const deps: PipelineDeps = {
      inspector: new FakeInspector(baseMedia()),
      extractor: new FakeExtractor(),
      transcriber: new FakeTranscriber(),
      translator: new FakeTranslator(),
    };
    await expect(runPipeline(options, deps, createLogger(false))).rejects.toThrow(/already exists/);
    expect(readFileSync(outputPath, "utf-8")).toBe("existing content");
  });

  it("does not run any expensive step in dry-run mode", async () => {
    const extractor = new FakeExtractor();
    const options = makeOptions({ dryRun: true });
    writeFileSync(options.input, "");
    const deps: PipelineDeps = { inspector: new FakeInspector(baseMedia()), extractor, transcriber: new FakeTranscriber(), translator: new FakeTranslator() };
    const plan = await planPipeline(options, deps);
    expect(plan.outputPath).toContain("pt-BR");
    expect(extractor.extractedAudio).toHaveLength(0);
  });

  it("refuses to run if generated segments fail validation", async () => {
    class BadTranscriber implements Transcriber {
      readonly id = "bad";
      async isAvailable() {
        return true;
      }
      async transcribe(): Promise<SubtitleDocument> {
        return { segments: [{ id: 1, startMs: 1000, endMs: 500, text: "broken" }] }; // start >= end
      }
    }
    const options = makeOptions();
    writeFileSync(options.input, "");
    const deps: PipelineDeps = {
      inspector: new FakeInspector(baseMedia()),
      extractor: new FakeExtractor(),
      transcriber: new BadTranscriber(),
      translator: new FakeTranslator(),
    };
    await expect(runPipeline(options, deps, createLogger(false))).rejects.toThrow(/failed validation/);
    expect(existsSync(join(dir, "movie.pt-BR.srt"))).toBe(false);
  });
});
