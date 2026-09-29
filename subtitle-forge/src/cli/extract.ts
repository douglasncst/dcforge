import { Command } from "commander";
import { ForgeError } from "../core/errors.js";
import { FfmpegSubtitleExtractor } from "../media/ffmpeg.js";
import { FfprobeMediaInspector } from "../media/ffprobe.js";
import { assertSafeToWrite, deriveOutputPath } from "../util/paths.js";

export function registerExtractCommand(program: Command): void {
  program
    .command("extract")
    .description("extract an existing subtitle stream from a media file as SRT")
    .argument("<input>", "path to the media file")
    .option("-s, --subtitle <index>", "subtitle stream index to extract (see `inspect`); defaults to the first text-based one")
    .option("-o, --output <path>", "output .srt path")
    .option("--overwrite", "replace the output file if it already exists", false)
    .action(async (input: string, opts: { subtitle?: string; output?: string; overwrite: boolean }) => {
      const info = await new FfprobeMediaInspector().inspect(input);

      const stream =
        opts.subtitle !== undefined
          ? info.subtitles.find((s) => s.index === Number(opts.subtitle))
          : info.subtitles.find((s) => !s.isImageBased);
      if (!stream) {
        throw new ForgeError(
          opts.subtitle !== undefined
            ? `no subtitle stream with index ${opts.subtitle} in ${input}.`
            : `${input} has no text-based subtitle stream. Run \`subtitle-forge inspect ${input}\` to see what it has.`,
        );
      }
      if (stream.isImageBased) {
        throw new ForgeError(
          `subtitle stream ${stream.index} is image-based (${stream.codec}) and needs OCR, not text extraction. ` +
            "OCR support is on the roadmap; see subtitle-forge/README.md.",
        );
      }

      const output = opts.output ?? deriveOutputPath(input, stream.language ?? "und", "srt");
      assertSafeToWrite(output, input, opts.overwrite);
      await new FfmpegSubtitleExtractor().extractSubtitle(input, stream.index, output);
      console.log(`Wrote ${output}`);
    });
}
