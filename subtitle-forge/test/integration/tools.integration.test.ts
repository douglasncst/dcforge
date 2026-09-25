import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { detectCapabilities, reportCapabilities } from "./capabilities.js";
import { FfmpegSubtitleExtractor } from "../../src/media/ffmpeg.js";
import { FfprobeMediaInspector } from "../../src/media/ffprobe.js";
import { WhisperCppTranscriber } from "../../src/transcription/whisperCppTranscriber.js";
import { OllamaTranslator } from "../../src/translation/ollamaTranslator.js";
import { cleanupTempDir, createTempDir, tempFilePath } from "../../src/util/tempFiles.js";
import { run } from "../../src/util/processRunner.js";

/**
 * Exercises whatever of ffmpeg/ffprobe/Whisper/Ollama is actually installed
 * in THIS environment. Never claims a check "passed" for something it
 * skipped — a missing tool means describe.skipIf reports it as skipped in
 * the test output, which is what an honest report looks like.
 *
 * Capability detection has to happen at module scope (top-level await), not
 * inside beforeAll: describe.skipIf's condition is evaluated synchronously
 * while vitest collects tests, before any beforeAll runs.
 */
const caps = await detectCapabilities();
reportCapabilities(caps);

let workDir: string;
beforeAll(() => {
  workDir = createTempDir();
});
afterAll(() => {
  if (workDir) cleanupTempDir(workDir);
});

describe.skipIf(!caps.ffmpeg)("ffmpeg (real binary)", () => {
  let fixture: string;

  beforeAll(async () => {
    // A 2-second synthetic video+tone, generated on the fly rather than
    // versioned, so no media file lives in the repository.
    fixture = tempFilePath(workDir, ".mp4");
    const result = await run("ffmpeg", [
      "-y",
      "-f",
      "lavfi",
      "-i",
      "testsrc=duration=2:size=320x240:rate=10",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440:duration=2",
      "-shortest",
      fixture,
    ]);
    if (result.exitCode !== 0) throw new Error(`could not generate the synthetic fixture: ${result.stderr}`);
  });

  it("extracts mono 16kHz audio from the synthetic fixture", async () => {
    const audioPath = await new FfmpegSubtitleExtractor().extractAudioForTranscription(fixture);
    expect(existsSync(audioPath)).toBe(true);
    cleanupTempDir(audioPath.split("/").slice(0, -1).join("/"));
  });
});

describe.skipIf(!caps.ffprobe || !caps.ffmpeg)("ffprobe (real binary)", () => {
  it("inspects a synthetic fixture and reports its real streams", async () => {
    const fixture = tempFilePath(workDir, ".mp4");
    const gen = await run("ffmpeg", ["-y", "-f", "lavfi", "-i", "testsrc=duration=1:size=160x120:rate=5", fixture]);
    expect(gen.exitCode).toBe(0);

    const info = await new FfprobeMediaInspector().inspect(fixture);
    expect(info.video.length).toBeGreaterThan(0);
    expect(info.video[0].width).toBe(160);
  });
});

describe.skipIf(!caps.whisper)("Whisper backend (real binary)", () => {
  it("responds to --help without hanging", async () => {
    expect(await new WhisperCppTranscriber().isAvailable()).toBe(true);
  });

  const modelPath = process.env.WHISPER_TEST_MODEL_PATH;
  it.skipIf(!modelPath)(
    "transcribes a synthetic silent clip with a real model (set WHISPER_TEST_MODEL_PATH to run)",
    async () => {
      if (!caps.ffmpeg) throw new Error("needs ffmpeg to build the fixture too");
      const audioFixture = tempFilePath(workDir, ".wav");
      await run("ffmpeg", ["-y", "-f", "lavfi", "-i", "anullsrc=r=16000:cl=mono", "-t", "1", audioFixture]);
      const doc = await new WhisperCppTranscriber().transcribe(audioFixture, { modelPath });
      expect(doc.segments).toBeInstanceOf(Array);
    },
  );

  // Regression for passing `-nt`, which made whisper.cpp stamp every segment
  // with its full 30s decoding window. A tone (not silence: models tend to
  // hallucinate a 30s "Thank you." over pure silence regardless of flags)
  // gives a clip whose segments must end at or before the audio does.
  it.skipIf(!modelPath)(
    "keeps segment timestamps within a synthetic 5s clip's real duration (set WHISPER_TEST_MODEL_PATH to run)",
    async () => {
      if (!caps.ffmpeg) throw new Error("needs ffmpeg to build the fixture too");
      const clipMs = 5_000;
      const audioFixture = tempFilePath(workDir, ".wav");
      const gen = await run("ffmpeg", [
        "-y",
        "-f",
        "lavfi",
        "-i",
        "sine=frequency=440:sample_rate=16000",
        "-t",
        String(clipMs / 1000),
        audioFixture,
      ]);
      expect(gen.exitCode).toBe(0);

      const doc = await new WhisperCppTranscriber().transcribe(audioFixture, { modelPath });
      for (const segment of doc.segments) {
        expect(segment.endMs).toBeLessThanOrEqual(clipMs + 500);
      }
    },
  );
});

describe.skipIf(!caps.ollama)("Ollama (real service)", () => {
  it("reports itself available", async () => {
    expect(await new OllamaTranslator().isAvailable()).toBe(true);
  });

  const model = process.env.OLLAMA_TEST_MODEL;
  it.skipIf(!model)("translates one segment with a real pulled model (set OLLAMA_TEST_MODEL to run)", async () => {
    const translator = new OllamaTranslator();
    const result = await translator.translate(
      { segments: [{ id: 1, startMs: 0, endMs: 1000, text: "Hello, world." }] },
      { to: "pt-BR", model },
    );
    expect(result.segments[0].text.length).toBeGreaterThan(0);
  });
});
