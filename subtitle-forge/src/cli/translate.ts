import { Command } from "commander";
import { readFileSync, writeFileSync } from "node:fs";
import { extname } from "node:path";
import { ForgeError } from "../core/errors.js";
import type { SubtitleFormat } from "../core/types.js";
import { SrtParser, SrtWriter } from "../subtitle/srt.js";
import { VttParser, VttWriter } from "../subtitle/vtt.js";
import { OllamaTranslator } from "../translation/ollamaTranslator.js";
import { assertLocalOllamaUrl } from "../util/localMode.js";
import { assertSafeToWrite } from "../util/paths.js";
import { createLogger } from "../util/output.js";

interface TranslateOpts {
  to: string;
  from?: string;
  translator: string;
  model?: string;
  ollamaUrl: string;
  local: boolean;
  output?: string;
  overwrite: boolean;
  verbose: boolean;
}

function detectFormat(path: string): SubtitleFormat {
  return extname(path).toLowerCase() === ".vtt" ? "vtt" : "srt";
}

export function registerTranslateCommand(program: Command): void {
  program
    .command("translate")
    .description("translate a subtitle file, preserving timestamps and segment identity")
    .argument("<subtitle>", "path to a .srt or .vtt file")
    .requiredOption("--to <lang>", "target language tag, e.g. pt-BR")
    .option("--from <lang>", "source language; omit if unknown")
    .option("--translator <id>", "translator backend", "ollama")
    .option("--model <name>", "model name for the translator, e.g. llama3.2")
    .option("--ollama-url <url>", "Ollama endpoint", "http://127.0.0.1:11434")
    .option("--local", "refuse to run unless every step stays on this machine", false)
    .option("-o, --output <path>", "output path; defaults next to the input with the target language tag")
    .option("--overwrite", "replace the output file if it already exists", false)
    .option("--verbose", "print external calls, batches, and timing", false)
    .action(async (subtitlePath: string, opts: TranslateOpts) => {
      if (opts.translator !== "ollama") {
        throw new ForgeError(`unknown translator "${opts.translator}". Only "ollama" is available today.`);
      }
      if (opts.local) {
        assertLocalOllamaUrl(opts.ollamaUrl);
      }

      const format = detectFormat(subtitlePath);
      const raw = readFileSync(subtitlePath, "utf-8");
      const doc = format === "vtt" ? new VttParser().parse(raw) : new SrtParser().parse(raw);

      const logger = createLogger(opts.verbose);
      const translator = new OllamaTranslator({ baseUrl: opts.ollamaUrl, onDebug: logger.debug });
      const translated = await translator.translate(doc, {
        from: opts.from,
        to: opts.to,
        model: opts.model,
        onProgress: (done, total) => logger.progress(`Translating ${done}/${total} batches`),
      });

      const output =
        opts.output ?? subtitlePath.replace(new RegExp(`\\.${format}$`, "i"), `.${opts.to}.${format}`);
      assertSafeToWrite(output, subtitlePath, opts.overwrite);
      const text = format === "vtt" ? new VttWriter().write(translated) : new SrtWriter().write(translated);
      writeFileSync(output, text, "utf-8");
      console.log(`Wrote ${output} (${translated.segments.length} segment(s))`);
    });
}
