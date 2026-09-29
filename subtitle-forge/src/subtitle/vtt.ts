import type { SubtitleDocument, SubtitleParser, SubtitleSegment, SubtitleWriter } from "../core/types.js";
import { formatVttTimestamp, parseTimestampMs } from "./timecode.js";

const ARROW = "-->";

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function splitLines(text: string): string[] {
  return stripBom(text).split(/\r\n|\r|\n/);
}

function toBlocks(lines: string[]): string[][] {
  const blocks: string[][] = [];
  let current: string[] = [];
  for (const line of lines) {
    if (line.trim() === "") {
      if (current.length > 0) {
        blocks.push(current);
        current = [];
      }
      continue;
    }
    current.push(line);
  }
  if (current.length > 0) blocks.push(current);
  return blocks;
}

function parseTimestampLine(line: string): { startMs: number; endMs: number } | null {
  const arrowIndex = line.indexOf(ARROW);
  if (arrowIndex === -1) return null;
  const left = line.slice(0, arrowIndex).trim();
  const right = line.slice(arrowIndex + ARROW.length).trim().split(/\s+/)[0];
  try {
    return { startMs: parseTimestampMs(left), endMs: parseTimestampMs(right) };
  } catch {
    return null;
  }
}

/**
 * Covers what claude-console-style consumers actually need: cues with
 * plain text. NOTE/STYLE/REGION blocks and cue settings (position:, align:,
 * ...) are recognized and skipped/ignored, not interpreted — a VTT with
 * styling round-trips as plain text, which is documented as a phase-2 gap
 * in the README rather than silently mishandled.
 */
export class VttParser implements SubtitleParser {
  parse(text: string): SubtitleDocument {
    const blocks = toBlocks(splitLines(text));
    const segments: SubtitleSegment[] = [];

    for (const block of blocks) {
      let lines = block;
      // The WEBVTT header block, and any NOTE/STYLE/REGION block, never
      // contain a timestamp line — skip them by that fact rather than
      // trying to fully parse their own syntax.
      if (/^WEBVTT/i.test(lines[0]) && !parseTimestampLine(lines[0])) {
        lines = lines.slice(1);
        if (lines.length === 0) continue;
      }

      // An optional cue identifier line precedes the timestamp line.
      if (!parseTimestampLine(lines[0]) && lines.length > 1 && parseTimestampLine(lines[1])) {
        lines = lines.slice(1);
      }

      const timing = parseTimestampLine(lines[0]);
      if (!timing) continue; // NOTE/STYLE/REGION block, or unparseable — skip, don't fail the file

      const cueText = lines.slice(1).join("\n").trim();
      segments.push({ id: segments.length + 1, startMs: timing.startMs, endMs: timing.endMs, text: cueText });
    }

    return { segments };
  }
}

export class VttWriter implements SubtitleWriter {
  write(doc: SubtitleDocument): string {
    const cues = doc.segments
      .map((segment) => {
        const start = formatVttTimestamp(segment.startMs);
        const end = formatVttTimestamp(segment.endMs);
        return `${start} ${ARROW} ${end}\n${segment.text}\n`;
      })
      .join("\n");
    return `WEBVTT\n\n${cues}`;
  }
}
