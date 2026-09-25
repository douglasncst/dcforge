// Timestamp <-> millisecond conversions shared by the SRT and VTT
// parsers/writers. SRT uses a comma before milliseconds; VTT uses a dot.
// Both are accepted on parse (some SRT files in the wild use a dot too);
// each writer emits its own format's convention.

const TIMESTAMP_RE = /^(\d{1,}):(\d{2}):(\d{2})[.,](\d{1,3})$/;

export function parseTimestampMs(value: string): number {
  const match = TIMESTAMP_RE.exec(value.trim());
  if (!match) {
    throw new Error(`invalid timestamp "${value}"`);
  }
  const [, h, m, s, msRaw] = match;
  const ms = Number(msRaw.padEnd(3, "0").slice(0, 3));
  return (
    Number(h) * 3_600_000 +
    Number(m) * 60_000 +
    Number(s) * 1_000 +
    ms
  );
}

function pad(n: number, width: number): string {
  return String(Math.max(0, Math.trunc(n))).padStart(width, "0");
}

function toParts(totalMs: number): { h: number; m: number; s: number; ms: number } {
  const clamped = Math.max(0, Math.round(totalMs));
  const ms = clamped % 1000;
  const totalSec = Math.floor(clamped / 1000);
  const s = totalSec % 60;
  const totalMin = Math.floor(totalSec / 60);
  const m = totalMin % 60;
  const h = Math.floor(totalMin / 60);
  return { h, m, s, ms };
}

export function formatSrtTimestamp(totalMs: number): string {
  const { h, m, s, ms } = toParts(totalMs);
  return `${pad(h, 2)}:${pad(m, 2)}:${pad(s, 2)},${pad(ms, 3)}`;
}

export function formatVttTimestamp(totalMs: number): string {
  const { h, m, s, ms } = toParts(totalMs);
  return `${pad(h, 2)}:${pad(m, 2)}:${pad(s, 2)}.${pad(ms, 3)}`;
}
