import type { TopTrack } from "./lastfm.js";

function escapeCell(value: string | number): string {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(tracks: TopTrack[]): string {
  const header = ["rank", "track", "artist", "playcount", "url"];
  const rows = tracks.map((t) => [t.rank, t.track, t.artist, t.playcount, t.url]);
  return [header, ...rows].map((row) => row.map(escapeCell).join(",")).join("\n") + "\n";
}
