import { describe, expect, it } from "vitest";
import { SrtParser, SrtWriter } from "../src/subtitle/srt.js";

const parser = new SrtParser();
const writer = new SrtWriter();

describe("SrtParser", () => {
  it("parses a well-formed file", () => {
    const src = [
      "1",
      "00:00:01,000 --> 00:00:02,500",
      "Hello there.",
      "",
      "2",
      "00:00:03,000 --> 00:00:04,000",
      "General Kenobi.",
      "",
    ].join("\n");
    expect(parser.parse(src).segments).toEqual([
      { id: 1, startMs: 1000, endMs: 2500, text: "Hello there." },
      { id: 2, startMs: 3000, endMs: 4000, text: "General Kenobi." },
    ]);
  });

  it("handles CRLF line endings", () => {
    const src = "1\r\n00:00:01,000 --> 00:00:02,000\r\nHi\r\n\r\n";
    expect(parser.parse(src).segments).toEqual([{ id: 1, startMs: 1000, endMs: 2000, text: "Hi" }]);
  });

  it("strips a UTF-8 BOM", () => {
    const src = "﻿1\n00:00:01,000 --> 00:00:02,000\nHi\n";
    expect(parser.parse(src).segments).toHaveLength(1);
  });

  it("preserves multiline text within one segment", () => {
    const src = "1\n00:00:01,000 --> 00:00:02,000\nLine one\nLine two\n";
    expect(parser.parse(src).segments[0].text).toBe("Line one\nLine two");
  });

  it("tolerates extra blank lines between entries", () => {
    const src = "1\n00:00:01,000 --> 00:00:02,000\nHi\n\n\n\n2\n00:00:03,000 --> 00:00:04,000\nBye\n";
    expect(parser.parse(src).segments).toHaveLength(2);
  });

  it("returns an empty document for an empty file", () => {
    expect(parser.parse("").segments).toEqual([]);
    expect(parser.parse("   \n\n  ").segments).toEqual([]);
  });

  it("drops entries with no recognizable timestamp line instead of throwing", () => {
    const src = "1\nnot a timestamp\nsome text\n\n2\n00:00:01,000 --> 00:00:02,000\nvalid\n";
    const segments = parser.parse(src).segments;
    expect(segments).toHaveLength(1);
    expect(segments[0].text).toBe("valid");
  });

  it("accepts an entry missing its index line", () => {
    const src = "00:00:01,000 --> 00:00:02,000\nNo index here\n";
    expect(parser.parse(src).segments).toEqual([{ id: 1, startMs: 1000, endMs: 2000, text: "No index here" }]);
  });

  it("re-numbers ids by parse order regardless of the source file's index numbers", () => {
    const src = "99\n00:00:01,000 --> 00:00:02,000\nFirst\n\n5\n00:00:03,000 --> 00:00:04,000\nSecond\n";
    const segments = parser.parse(src).segments;
    expect(segments.map((s) => s.id)).toEqual([1, 2]);
  });
});

describe("SrtWriter", () => {
  it("writes sequential 1-based indices and comma timestamps", () => {
    const doc = { segments: [{ id: 7, startMs: 1000, endMs: 2500, text: "Hi" }] };
    expect(writer.write(doc)).toBe("1\n00:00:01,000 --> 00:00:02,500\nHi\n\n");
  });

  it("writes an empty string for an empty document", () => {
    expect(writer.write({ segments: [] })).toBe("");
  });

  it("round-trips through the parser", () => {
    const original = {
      segments: [
        { id: 1, startMs: 0, endMs: 1500, text: "One\nTwo lines" },
        { id: 2, startMs: 2000, endMs: 3000, text: "Three" },
      ],
    };
    expect(parser.parse(writer.write(original)).segments).toEqual(original.segments);
  });
});
