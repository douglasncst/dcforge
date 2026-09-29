#!/usr/bin/env node
import { Command } from "commander";
import { registerInspectCommand } from "./cli/inspect.js";
import { registerExtractCommand } from "./cli/extract.js";
import { registerTranscribeCommand } from "./cli/transcribe.js";
import { registerTranslateCommand } from "./cli/translate.js";
import { registerValidateCommand } from "./cli/validate.js";
import { registerRunCommand } from "./cli/run.js";
import { registerDoctorCommand } from "./cli/doctorCommand.js";
import { ForgeError } from "./core/errors.js";

const VERBOSE = process.argv.includes("--verbose");

const program = new Command();

program
  .name("subtitle-forge")
  .description(
    "Experimental local-first CLI to extract, transcribe, translate and export video/audio subtitles.",
  )
  .version("0.1.0");

registerInspectCommand(program);
registerExtractCommand(program);
registerTranscribeCommand(program);
registerTranslateCommand(program);
registerValidateCommand(program);
registerRunCommand(program);
registerDoctorCommand(program);

program.parseAsync(process.argv).catch((err) => {
  if (err instanceof ForgeError) {
    console.error(`Error: ${err.message}`);
    if (VERBOSE && err.detail) {
      console.error(err.detail);
    }
    process.exitCode = err.exitCode;
    return;
  }
  console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
  if (VERBOSE && err instanceof Error && err.stack) {
    console.error(err.stack);
  }
  process.exitCode = 1;
});
