import { describe, expect, it } from "vitest";
import { formatSrtTimestamp, formatVttTimestamp, parseTimestampMs } from "../src/subtitle/timecode.js";

describe("parseTimestampMs", () => {
  it("parses SRT-style comma timestamps", () => {
    expect(parseTimestampMs("00:01:02,500")).toBe(62_500);
  });

  it("parses VTT-style dot timestamps", () => {
    expect(parseTimestampMs("00:01:02.500")).toBe(62_500);
  });

  it("handles hours beyond 99 minutes correctly", () => {
    expect(parseTimestampMs("01:00:00,000")).toBe(3_600_000);
  });

  it("pads a short millisecond field", () => {
    expect(parseTimestampMs("00:00:01,5")).toBe(1_500);
  });

  it("throws on garbage input", () => {
    expect(() => parseTimestampMs("not a timestamp")).toThrow();
  });
});

describe("formatSrtTimestamp / formatVttTimestamp", () => {
  it("round-trips through parse", () => {
    const ms = 3_723_456;
    expect(parseTimestampMs(formatSrtTimestamp(ms))).toBe(ms);
    expect(parseTimestampMs(formatVttTimestamp(ms))).toBe(ms);
  });

  it("uses a comma for SRT and a dot for VTT", () => {
    expect(formatSrtTimestamp(1_500)).toBe("00:00:01,500");
    expect(formatVttTimestamp(1_500)).toBe("00:00:01.500");
  });

  it("clamps negative input to zero instead of producing a negative timestamp", () => {
    expect(formatSrtTimestamp(-500)).toBe("00:00:00,000");
  });
});
