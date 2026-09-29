import { Command } from "commander";
import { formatDoctorReport, runDoctorChecks } from "./doctor.js";

export function registerDoctorCommand(program: Command): void {
  program
    .command("doctor")
    .description("check which external tools subtitle-forge can find (FFmpeg, Whisper, Ollama)")
    .option("--ollama-url <url>", "Ollama endpoint to check", "http://127.0.0.1:11434")
    .option("--model <name>", "also check whether this Ollama model is pulled")
    .action(async (opts: { ollamaUrl: string; model?: string }) => {
      const checks = await runDoctorChecks({ ollamaUrl: opts.ollamaUrl, model: opts.model });
      console.log(formatDoctorReport(checks));
      // No optional dependency being absent should fail the whole command —
      // that's exactly what doctor exists to report without drama. Node
      // missing isn't possible (we're running on it); everything else is
      // optional-per-feature.
    });
}
