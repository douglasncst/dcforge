import type { SubtitleSegment } from "../core/types.js";

export interface TranslationBatch {
  /** Segments the model must translate, identified by id. */
  items: SubtitleSegment[];
  /**
   * A few immediately preceding segments' original text, for context only
   * ("I got it." depends on what came before it) — never sent for
   * translation themselves, and never re-requested.
   */
  contextSegments: SubtitleSegment[];
}

export interface BatchingOptions {
  /** Segments translated per model call. Large enough for context, small enough to keep the model's output reliable. */
  batchSize: number;
  /** How many preceding segments' original text to include as read-only context. */
  contextSize: number;
}

export const DEFAULT_BATCHING_OPTIONS: BatchingOptions = { batchSize: 20, contextSize: 3 };

export function createBatches(
  segments: SubtitleSegment[],
  options: BatchingOptions = DEFAULT_BATCHING_OPTIONS,
): TranslationBatch[] {
  const batches: TranslationBatch[] = [];
  for (let i = 0; i < segments.length; i += options.batchSize) {
    const items = segments.slice(i, i + options.batchSize);
    const contextStart = Math.max(0, i - options.contextSize);
    const contextSegments = segments.slice(contextStart, i);
    batches.push({ items, contextSegments });
  }
  return batches;
}
