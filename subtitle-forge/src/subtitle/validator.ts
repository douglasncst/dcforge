import type { SubtitleDocument } from "../core/types.js";

export type ValidationSeverity = "error" | "warning";

export interface ValidationIssue {
  severity: ValidationSeverity;
  /** 0 when the issue isn't about one specific segment (e.g. duplicate ids). */
  segmentId: number;
  message: string;
}

export interface ValidationResult {
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  valid: boolean; // true iff errors.length === 0; warnings never block export
}

// Tunable thresholds. Deliberately generous — these catch obviously broken
// data, not stylistic subtitle-timing conventions.
const MAX_REASONABLE_DURATION_MS = 20_000; // a single cue on screen for 20s+ is unusual
const MAX_REASONABLE_TEXT_LENGTH = 300; // characters
const SUSPICIOUS_OVERLAP_MS = 50; // tiny overlaps from rounding are normal; bigger ones aren't

export function validateSubtitle(doc: SubtitleDocument): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const push = (list: ValidationIssue[], segmentId: number, message: string) =>
    list.push({ severity: list === errors ? "error" : "warning", segmentId, message });

  const seenIds = new Map<number, number>();
  for (const s of doc.segments) {
    seenIds.set(s.id, (seenIds.get(s.id) ?? 0) + 1);
  }
  for (const [id, count] of seenIds) {
    if (count > 1) push(errors, id, `segment id ${id} is used ${count} times`);
  }

  let previous: (typeof doc.segments)[number] | null = null;
  for (const s of doc.segments) {
    if (s.startMs < 0 || s.endMs < 0) {
      push(errors, s.id, `negative timestamp (start=${s.startMs}ms, end=${s.endMs}ms)`);
    }
    if (s.startMs >= s.endMs) {
      push(errors, s.id, `start (${s.startMs}ms) is not before end (${s.endMs}ms)`);
    }
    if (s.text.trim() === "") {
      push(errors, s.id, "empty text");
    }

    const duration = s.endMs - s.startMs;
    if (duration > MAX_REASONABLE_DURATION_MS) {
      push(warnings, s.id, `unusually long duration (${duration}ms)`);
    }
    if (s.text.length > MAX_REASONABLE_TEXT_LENGTH) {
      push(warnings, s.id, `unusually long text (${s.text.length} characters)`);
    }

    if (previous) {
      if (s.startMs < previous.startMs) {
        push(errors, s.id, `out of order: starts (${s.startMs}ms) before previous segment ${previous.id} (${previous.startMs}ms)`);
      } else if (s.startMs < previous.endMs - SUSPICIOUS_OVERLAP_MS) {
        push(warnings, s.id, `overlaps previous segment ${previous.id} by ${previous.endMs - s.startMs}ms`);
      }
    }
    previous = s;
  }

  return { errors, warnings, valid: errors.length === 0 };
}
