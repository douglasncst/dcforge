import { describe, expect, it } from "vitest";
import { VttParser, VttWriter } from "../src/subtitle/vtt.js";
import { SrtParser } from "../src/subtitle/srt.js";
import { SrtWriter } from "../src/subtitle/srt.js";

const parser = new VttParser();
const writer = new VttWriter();

describe("VttParser", () => {
  it("parses a well-formed file with the WEBVTT header", () => {
    const src = "WEBVTT\n\n00:00:01.000 --> 00:00:02.500\nHello there.\n\n00:00:03.000 --> 00:00:04.000\nGeneral Kenobi.\n";
    expect(parser.parse(src).segments).toEqual([
      { id: 1, startMs: 1000, endMs: 2500, text: "Hello there." },
      { id: 2, startMs: 3000, endMs: 4000, text: "General Kenobi." },
    ]);
  });

  it("accepts an optional cue identifier line", () => {
    const src = "WEBVTT\n\ncue-1\n00:00:01.000 --> 00:00:02.000\nHi\n";
    expect(parser.parse(src).segments).toEqual([{ id: 1, startMs: 1000, endMs: 2000, text: "Hi" }]);
  });

  it("ignores a NOTE block", () => {
    const src = "WEBVTT\n\nNOTE this is a comment\nstill part of the note\n\n00:00:01.000 --> 00:00:02.000\nHi\n";
    expect(parser.parse(src).segments).toEqual([{ id: 1, startMs: 1000, endMs: 2000, text: "Hi" }]);
  });

  it("returns an empty document for a header-only file", () => {
    expect(parser.parse("WEBVTT\n\n").segments).toEqual([]);
  });

  it("returns an empty document for an empty file", () => {
    expect(parser.parse("").segments).toEqual([]);
  });
});

describe("VttWriter", () => {
  it("writes the WEBVTT header and dot timestamps", () => {
    const doc = { segments: [{ id: 1, startMs: 1000, endMs: 2500, text: "Hi" }] };
    expect(writer.write(doc)).toBe("WEBVTT\n\n00:00:01.000 --> 00:00:02.500\nHi\n");
  });

  it("round-trips through the parser", () => {
    const original = {
      segments: [
        { id: 1, startMs: 0, endMs: 1500, text: "One" },
        { id: 2, startMs: 2000, endMs: 3000, text: "Two" },
      ],
    };
    expect(parser.parse(writer.write(original)).segments).toEqual(original.segments);
  });
});

describe("cross-format conversion", () => {
  it("SRT -> internal -> VTT -> internal -> SRT preserves content", () => {
    const srt = "1\n00:00:01,000 --> 00:00:02,000\nHello\n\n"; // SrtWriter always trails with a blank line
    const doc = new SrtParser().parse(srt);
    const vtt = writer.write(doc);
    const backToDoc = parser.parse(vtt);
    expect(new SrtWriter().write(backToDoc)).toBe(srt);
  });
});
