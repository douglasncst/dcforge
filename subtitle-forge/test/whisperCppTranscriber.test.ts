import { describe, expect, it } from "vitest";
import { parseWhisperCppJson } from "../src/transcription/whisperCppTranscriber.js";

describe("parseWhisperCppJson", () => {
  it("prefers offsets (already in ms) when present", () => {
    const raw = JSON.stringify({
      transcription: [{ offsets: { from: 0, to: 1500 }, timestamps: { from: "00:00:00,000", to: "00:00:01,500" }, text: " Hello" }],
    });
    expect(parseWhisperCppJson(raw).segments).toEqual([{ id: 1, startMs: 0, endMs: 1500, text: "Hello" }]);
  });

  it("falls back to parsing the timestamps strings when offsets are missing", () => {
    const raw = JSON.stringify({
      transcription: [{ timestamps: { from: "00:00:02,000", to: "00:00:03,000" }, text: " Hi" }],
    });
    expect(parseWhisperCppJson(raw).segments).toEqual([{ id: 1, startMs: 2000, endMs: 3000, text: "Hi" }]);
  });

  it("trims segment text", () => {
    const raw = JSON.stringify({ transcription: [{ offsets: { from: 0, to: 1000 }, text: "  padded  " }] });
    expect(parseWhisperCppJson(raw).segments[0].text).toBe("padded");
  });

  it("skips empty-text segments", () => {
    const raw = JSON.stringify({
      transcription: [
        { offsets: { from: 0, to: 500 }, text: "   " },
        { offsets: { from: 500, to: 1000 }, text: "real" },
      ],
    });
    expect(parseWhisperCppJson(raw).segments).toEqual([{ id: 1, startMs: 500, endMs: 1000, text: "real" }]);
  });

  it("assigns sequential ids", () => {
    const raw = JSON.stringify({
      transcription: [
        { offsets: { from: 0, to: 500 }, text: "a" },
        { offsets: { from: 500, to: 1000 }, text: "b" },
      ],
    });
    expect(parseWhisperCppJson(raw).segments.map((s) => s.id)).toEqual([1, 2]);
  });

  it("handles an empty transcription array", () => {
    expect(parseWhisperCppJson(JSON.stringify({ transcription: [] })).segments).toEqual([]);
  });

  it("throws a clear error on invalid JSON", () => {
    expect(() => parseWhisperCppJson("not json")).toThrow(/valid JSON/);
  });
});
