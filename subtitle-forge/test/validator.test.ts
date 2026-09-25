import { describe, expect, it } from "vitest";
import { validateSubtitle } from "../src/subtitle/validator.js";
import type { SubtitleSegment } from "../src/core/types.js";

function seg(overrides: Partial<SubtitleSegment>): SubtitleSegment {
  return { id: 1, startMs: 0, endMs: 1000, text: "text", ...overrides };
}

describe("validateSubtitle", () => {
  it("passes a well-formed document with no issues", () => {
    const result = validateSubtitle({
      segments: [seg({ id: 1, startMs: 0, endMs: 1000 }), seg({ id: 2, startMs: 1000, endMs: 2000 })],
    });
    expect(result).toEqual({ errors: [], warnings: [], valid: true });
  });

  it("flags start >= end as an error", () => {
    const result = validateSubtitle({ segments: [seg({ startMs: 2000, endMs: 1000 })] });
    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toMatch(/not before end/);
  });

  it("flags negative timestamps as an error", () => {
    const result = validateSubtitle({ segments: [seg({ startMs: -100, endMs: 1000 })] });
    expect(result.errors.some((e) => e.message.includes("negative"))).toBe(true);
  });

  it("flags out-of-order segments as an error", () => {
    const result = validateSubtitle({
      segments: [seg({ id: 1, startMs: 5000, endMs: 6000 }), seg({ id: 2, startMs: 1000, endMs: 2000 })],
    });
    expect(result.errors.some((e) => e.message.includes("out of order"))).toBe(true);
  });

  it("flags duplicate ids as an error", () => {
    const result = validateSubtitle({
      segments: [seg({ id: 1, startMs: 0, endMs: 1000 }), seg({ id: 1, startMs: 1000, endMs: 2000 })],
    });
    expect(result.errors.some((e) => e.message.includes("used 2 times"))).toBe(true);
  });

  it("flags empty text as an error", () => {
    const result = validateSubtitle({ segments: [seg({ text: "" })] });
    expect(result.errors.some((e) => e.message === "empty text")).toBe(true);
  });

  it("warns on a suspicious overlap but does not error", () => {
    const result = validateSubtitle({
      segments: [seg({ id: 1, startMs: 0, endMs: 2000 }), seg({ id: 2, startMs: 1000, endMs: 3000 })],
    });
    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.message.includes("overlaps"))).toBe(true);
  });

  it("warns on an absurdly long duration without erroring", () => {
    const result = validateSubtitle({ segments: [seg({ startMs: 0, endMs: 60_000 })] });
    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.message.includes("duration"))).toBe(true);
  });

  it("warns on excessively long text without erroring", () => {
    const result = validateSubtitle({ segments: [seg({ text: "x".repeat(500) })] });
    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.message.includes("long text"))).toBe(true);
  });

  it("handles an empty document", () => {
    expect(validateSubtitle({ segments: [] })).toEqual({ errors: [], warnings: [], valid: true });
  });
});
