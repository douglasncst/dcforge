import { describe, expect, it } from "vitest";
import { createBatches } from "../src/translation/batching.js";
import type { SubtitleSegment } from "../src/core/types.js";

function segments(count: number): SubtitleSegment[] {
  return Array.from({ length: count }, (_, i) => ({ id: i + 1, startMs: i * 1000, endMs: i * 1000 + 900, text: `line ${i + 1}` }));
}

describe("createBatches", () => {
  it("splits into batches of the given size", () => {
    const batches = createBatches(segments(45), { batchSize: 20, contextSize: 3 });
    expect(batches.map((b) => b.items.length)).toEqual([20, 20, 5]);
  });

  it("covers every segment exactly once across batches", () => {
    const batches = createBatches(segments(45), { batchSize: 20, contextSize: 3 });
    const ids = batches.flatMap((b) => b.items.map((s) => s.id));
    expect(ids).toEqual(Array.from({ length: 45 }, (_, i) => i + 1));
  });

  it("gives each batch after the first up to contextSize preceding segments", () => {
    const batches = createBatches(segments(10), { batchSize: 4, contextSize: 3 });
    expect(batches[0].contextSegments).toEqual([]);
    expect(batches[1].contextSegments.map((s) => s.id)).toEqual([2, 3, 4]);
  });

  it("never includes a context segment that is also in items", () => {
    const batches = createBatches(segments(10), { batchSize: 4, contextSize: 3 });
    for (const batch of batches) {
      const itemIds = new Set(batch.items.map((s) => s.id));
      for (const c of batch.contextSegments) {
        expect(itemIds.has(c.id)).toBe(false);
      }
    }
  });

  it("returns one empty batch list for zero segments", () => {
    expect(createBatches([], { batchSize: 20, contextSize: 3 })).toEqual([]);
  });

  it("handles a single segment smaller than the batch size", () => {
    const batches = createBatches(segments(1), { batchSize: 20, contextSize: 3 });
    expect(batches).toHaveLength(1);
    expect(batches[0].items).toHaveLength(1);
  });
});
