import { ForgeError } from "../core/errors.js";
import type {
  AudioStreamInfo,
  MediaInfo,
  MediaInspector,
  SubtitleStreamInfo,
  VideoStreamInfo,
} from "../core/types.js";
import { commandExists, run } from "../util/processRunner.js";

// Codecs ffmpeg reports for image-based subtitle formats — these need OCR,
// not text extraction, and must never be silently treated as text.
const IMAGE_SUBTITLE_CODECS = new Set(["hdmv_pgs_subtitle", "dvd_subtitle", "dvb_subtitle", "xsub"]);

interface FfprobeStream {
  index: number;
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
  channels?: number;
  sample_rate?: string;
  r_frame_rate?: string;
  tags?: Record<string, string>;
  disposition?: Record<string, number>;
}

interface FfprobeOutput {
  format?: { format_name?: string; duration?: string };
  streams?: FfprobeStream[];
}

function parseFrameRate(value: string | undefined): number | null {
  if (!value) return null;
  const [num, den] = value.split("/").map(Number);
  if (!den) return null;
  const fps = num / den;
  return Number.isFinite(fps) ? fps : null;
}

/** Pure parsing, unit-testable without spawning ffprobe. */
export function parseFfprobeJson(raw: string, path: string): MediaInfo {
  let data: FfprobeOutput;
  try {
    data = JSON.parse(raw) as FfprobeOutput;
  } catch (err) {
    throw new ForgeError(`ffprobe did not return valid JSON for ${path}.`, {
      detail: err instanceof Error ? err.message : String(err),
    });
  }

  const video: VideoStreamInfo[] = [];
  const audio: AudioStreamInfo[] = [];
  const subtitles: SubtitleStreamInfo[] = [];

  for (const s of data.streams ?? []) {
    const base = {
      index: s.index,
      codec: s.codec_name ?? "unknown",
      language: s.tags?.language ?? null,
      title: s.tags?.title ?? null,
    };
    if (s.codec_type === "video") {
      video.push({
        ...base,
        kind: "video",
        width: s.width ?? null,
        height: s.height ?? null,
        frameRate: parseFrameRate(s.r_frame_rate),
      });
    } else if (s.codec_type === "audio") {
      audio.push({
        ...base,
        kind: "audio",
        channels: s.channels ?? null,
        sampleRateHz: s.sample_rate ? Number(s.sample_rate) : null,
      });
    } else if (s.codec_type === "subtitle") {
      subtitles.push({
        ...base,
        kind: "subtitle",
        isImageBased: IMAGE_SUBTITLE_CODECS.has(s.codec_name ?? ""),
        default: s.disposition?.default === 1,
        forced: s.disposition?.forced === 1,
      });
    }
  }

  return {
    path,
    container: data.format?.format_name ?? "unknown",
    durationSec: data.format?.duration ? Number(data.format.duration) : null,
    video,
    audio,
    subtitles,
  };
}

export class FfprobeMediaInspector implements MediaInspector {
  async isAvailable(): Promise<boolean> {
    return commandExists("ffprobe");
  }

  async inspect(path: string): Promise<MediaInfo> {
    if (!(await this.isAvailable())) {
      throw new ForgeError("ffprobe was not found. Install FFmpeg (which includes ffprobe) and ensure it is on PATH.");
    }
    const result = await run("ffprobe", [
      "-v",
      "error",
      "-print_format",
      "json",
      "-show_format",
      "-show_streams",
      path,
    ]);
    if (result.exitCode !== 0) {
      throw new ForgeError(`ffprobe failed to inspect ${path}.`, { detail: result.stderr });
    }
    return parseFfprobeJson(result.stdout, path);
  }
}
