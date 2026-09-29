import { Command } from "commander";
import { FfprobeMediaInspector } from "../media/ffprobe.js";
import type { MediaInfo } from "../core/types.js";

function formatStream(label: string, index: number, codec: string, language: string | null, extra: string): string {
  return `  [${index}] ${label}  codec=${codec}  lang=${language ?? "?"}${extra ? `  ${extra}` : ""}`;
}

export function formatMediaInfo(info: MediaInfo): string {
  const lines: string[] = [];
  lines.push(`${info.path}`);
  lines.push(`  container: ${info.container}`);
  lines.push(`  duration:  ${info.durationSec !== null ? `${info.durationSec.toFixed(1)}s` : "unknown"}`);

  lines.push(`  video streams (${info.video.length}):`);
  for (const v of info.video) {
    lines.push(
      formatStream("video", v.index, v.codec, v.language, `${v.width ?? "?"}x${v.height ?? "?"} @ ${v.frameRate?.toFixed(2) ?? "?"}fps`),
    );
  }

  lines.push(`  audio streams (${info.audio.length}):`);
  for (const a of info.audio) {
    lines.push(formatStream("audio", a.index, a.codec, a.language, `${a.channels ?? "?"}ch @ ${a.sampleRateHz ?? "?"}Hz`));
  }

  lines.push(`  subtitle streams (${info.subtitles.length}):`);
  for (const s of info.subtitles) {
    const flags = [s.default ? "default" : null, s.forced ? "forced" : null, s.isImageBased ? "IMAGE-BASED (needs OCR)" : "text"]
      .filter(Boolean)
      .join(", ");
    lines.push(formatStream("subtitle", s.index, s.codec, s.language, flags));
  }

  return lines.join("\n");
}

export function registerInspectCommand(program: Command): void {
  program
    .command("inspect")
    .description("show container, video/audio/subtitle streams for a media file")
    .argument("<input>", "path to the media file")
    .option("--json", "print raw structured data instead of a formatted report")
    .action(async (input: string, opts: { json?: boolean }) => {
      const info = await new FfprobeMediaInspector().inspect(input);
      if (opts.json) {
        console.log(JSON.stringify(info, null, 2));
      } else {
        console.log(formatMediaInfo(info));
      }
    });
}
