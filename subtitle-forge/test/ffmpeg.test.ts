import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../src/util/processRunner.js", () => ({
  commandExists: vi.fn(),
  run: vi.fn(),
}));

const { commandExists, run } = await import("../src/util/processRunner.js");
const { FfmpegSubtitleExtractor, ffmpegAvailable } = await import("../src/media/ffmpeg.js");

const commandExistsMock = vi.mocked(commandExists);
const runMock = vi.mocked(run);

beforeEach(() => {
  commandExistsMock.mockReset();
  runMock.mockReset();
});

describe("ffmpegAvailable", () => {
  it("reflects commandExists", async () => {
    commandExistsMock.mockResolvedValue(true);
    expect(await ffmpegAvailable()).toBe(true);
  });
});

describe("FfmpegSubtitleExtractor.extractSubtitle", () => {
  it("passes each argument separately, never through a shell", async () => {
    commandExistsMock.mockResolvedValue(true);
    runMock.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });

    const input = "/my videos/Amélie (2001) — 日本語.mkv";
    await new FfmpegSubtitleExtractor().extractSubtitle(input, 3, "/out/amelie.srt");

    expect(runMock).toHaveBeenCalledWith("ffmpeg", ["-y", "-i", input, "-map", "0:3", "-c:s", "srt", "/out/amelie.srt"]);
  });

  it("throws a clear error when ffmpeg is missing", async () => {
    commandExistsMock.mockResolvedValue(false);
    await expect(new FfmpegSubtitleExtractor().extractSubtitle("in.mkv", 0, "out.srt")).rejects.toThrow(
      /ffmpeg was not found/,
    );
  });

  it("throws with ffmpeg's stderr when the command fails", async () => {
    commandExistsMock.mockResolvedValue(true);
    runMock.mockResolvedValue({ stdout: "", stderr: "stream 0:3 not found", exitCode: 1 });
    await expect(new FfmpegSubtitleExtractor().extractSubtitle("in.mkv", 3, "out.srt")).rejects.toThrow(
      /failed to extract subtitle stream 3/,
    );
  });
});

describe("FfmpegSubtitleExtractor.extractAudioForTranscription", () => {
  it("extracts mono 16kHz WAV suitable for speech recognition", async () => {
    commandExistsMock.mockResolvedValue(true);
    runMock.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });

    const audioPath = await new FfmpegSubtitleExtractor().extractAudioForTranscription("in.mkv");

    const [, args] = runMock.mock.calls[0];
    expect(args).toContain("-ac");
    expect(args[args.indexOf("-ac") + 1]).toBe("1");
    expect(args).toContain("-ar");
    expect(args[args.indexOf("-ar") + 1]).toBe("16000");
    expect(audioPath).toMatch(/\.wav$/);
  });

  it("maps a specific audio stream when given one", async () => {
    commandExistsMock.mockResolvedValue(true);
    runMock.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
    await new FfmpegSubtitleExtractor().extractAudioForTranscription("in.mkv", 2);
    const [, args] = runMock.mock.calls[0];
    expect(args[args.indexOf("-map") + 1]).toBe("0:2");
  });

  it("never overwrites the input path itself", async () => {
    commandExistsMock.mockResolvedValue(true);
    runMock.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
    const audioPath = await new FfmpegSubtitleExtractor().extractAudioForTranscription("in.mkv");
    expect(audioPath).not.toBe("in.mkv");
  });
});
