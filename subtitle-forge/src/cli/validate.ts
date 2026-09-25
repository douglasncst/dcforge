import { Command } from "commander";
import { readFileSync } from "node:fs";
import { extname } from "node:path";
import { SrtParser } from "../subtitle/srt.js";
import { VttParser } from "../subtitle/vtt.js";
import { validateSubtitle } from "../subtitle/validator.js";

export function registerValidateCommand(program: Command): void {
  program
    .command("validate")
    .description("check a subtitle file for structural errors and suspicious warnings")
    .argument("<subtitle>", "path to a .srt or .vtt file")
    .option("--json", "print structured results instead of a formatted report")
    .action(async (subtitlePath: string, opts: { json?: boolean }) => {
      const raw = readFileSync(subtitlePath, "utf-8");
      const isVtt = extname(subtitlePath).toLowerCase() === ".vtt";
      const doc = isVtt ? new VttParser().parse(raw) : new SrtParser().parse(raw);
      const result = validateSubtitle(doc);

      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(`${doc.segments.length} segment(s), ${result.errors.length} error(s), ${result.warnings.length} warning(s)`);
        for (const e of result.errors) console.log(`  ERROR   segment ${e.segmentId}: ${e.message}`);
        for (const w of result.warnings) console.log(`  WARNING segment ${w.segmentId}: ${w.message}`);
      }

      process.exitCode = result.valid ? 0 : 1;
    });
}
