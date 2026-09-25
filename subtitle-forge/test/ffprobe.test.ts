import { describe, expect, it } from "vitest";
import { parseFfprobeJson } from "../src/media/ffprobe.js";

const SAMPLE = {
  format: { format_name: "matroska,webm", duration: "125.400000" },
  streams: [
    { index: 0, codec_type: "video", codec_name: "h264", width: 1920, height: 1080, r_frame_rate: "24000/1001", tags: { language: "eng" } },
    { index: 1, codec_type: "audio", codec_name: "aac", channels: 2, sample_rate: "48000", tags: { language: "eng" } },
    { index: 2, codec_type: "audio", codec_name: "ac3", channels: 6, sample_rate: "48000", tags: { language: "jpn" } },
    { index: 3, codec_type: "subtitle", codec_name: "subrip", tags: { language: "eng" }, disposition: { default: 1, forced: 0 } },
    { index: 4, codec_type: "subtitle", codec_name: "hdmv_pgs_subtitle", tags: { language: "por" }, disposition: { default: 0, forced: 0 } },
  ],
};

describe("parseFfprobeJson", () => {
  it("extracts container and duration", () => {
    const info = parseFfprobeJson(JSON.stringify(SAMPLE), "movie.mkv");
    expect(info.container).toBe("matroska,webm");
    expect(info.durationSec).toBeCloseTo(125.4);
    expect(info.path).toBe("movie.mkv");
  });

  it("separates streams by kind", () => {
    const info = parseFfprobeJson(JSON.stringify(SAMPLE), "movie.mkv");
    expect(info.video).toHaveLength(1);
    expect(info.audio).toHaveLength(2);
    expect(info.subtitles).toHaveLength(2);
  });

  it("computes frame rate from a fraction", () => {
    const info = parseFfprobeJson(JSON.stringify(SAMPLE), "movie.mkv");
    expect(info.video[0].frameRate).toBeCloseTo(23.976, 2);
  });

  it("flags an image-based subtitle codec but not a text one", () => {
    const info = parseFfprobeJson(JSON.stringify(SAMPLE), "movie.mkv");
    const [srt, pgs] = info.subtitles;
    expect(srt.isImageBased).toBe(false);
    expect(pgs.isImageBased).toBe(true);
  });

  it("reads default/forced disposition flags", () => {
    const info = parseFfprobeJson(JSON.stringify(SAMPLE), "movie.mkv");
    expect(info.subtitles[0].default).toBe(true);
    expect(info.subtitles[1].default).toBe(false);
  });

  it("handles a file with no streams gracefully", () => {
    const info = parseFfprobeJson(JSON.stringify({ format: {} }), "empty.mkv");
    expect(info).toMatchObject({ video: [], audio: [], subtitles: [] });
  });

  it("throws a clear error on invalid JSON", () => {
    expect(() => parseFfprobeJson("not json", "movie.mkv")).toThrow(/valid JSON/);
  });
});
