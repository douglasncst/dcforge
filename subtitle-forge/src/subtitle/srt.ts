import type { SubtitleDocument, SubtitleParser, SubtitleSegment, SubtitleWriter } from "../core/types.js";
import { formatSrtTimestamp, parseTimestampMs } from "./timecode.js";

const ARROW = "-->";

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function splitLines(text: string): string[] {
  return stripBom(text).split(/\r\n|\r|\n/);
}

/** Groups lines into blocks separated by one or more blank lines. */
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
  // Cue settings (position:, align:, ...) can follow the end timestamp; take
  // only the first whitespace-delimited token.
  const right = line.slice(arrowIndex + ARROW.length).trim().split(/\s+/)[0];
  try {
    return { startMs: parseTimestampMs(left), endMs: parseTimestampMs(right) };
  } catch {
    return null;
  }
}

export class SrtParser implements SubtitleParser {
  /**
   * Lenient by design: a block that isn't a recognizable "[index] timestamp
   * line, then text" entry is dropped rather than failing the whole file.
   * An empty or entry-less file parses to zero segments, not an error.
   * Segment ids are assigned by parse order (1, 2, 3, ...), independent of
   * whatever index numbers (or lack of them) the source file used.
   */
  parse(text: string): SubtitleDocument {
    const blocks = toBlocks(splitLines(text));
    const segments: SubtitleSegment[] = [];

    for (const block of blocks) {
      let lines = block;
      // An index line is optional and, when present, purely positional
      // metadata we don't rely on — skip it if the first line is bare
      // digits and the actual timing is on the next line.
      if (/^\d+$/.test(lines[0].trim()) && lines.length > 1 && parseTimestampLine(lines[1])) {
        lines = lines.slice(1);
      }

      const timing = parseTimestampLine(lines[0]);
      if (!timing) continue;

      const text = lines.slice(1).join("\n").trim();
      segments.push({ id: segments.length + 1, startMs: timing.startMs, endMs: timing.endMs, text });
    }

    return { segments };
  }
}

export class SrtWriter implements SubtitleWriter {
  write(doc: SubtitleDocument): string {
    return (
      doc.segments
        .map((segment, i) => {
          const index = i + 1;
          const start = formatSrtTimestamp(segment.startMs);
          const end = formatSrtTimestamp(segment.endMs);
          return `${index}\n${start} ${ARROW} ${end}\n${segment.text}\n`;
        })
        .join("\n") + (doc.segments.length > 0 ? "\n" : "")
    );
  }
}
