import { run, commandExists } from "../util/processRunner.js";
import { WhisperCppTranscriber } from "../transcription/whisperCppTranscriber.js";

export type DoctorStatus = "ok" | "not-found" | "unreachable";

export interface DoctorCheck {
  name: string;
  status: DoctorStatus;
  detail: string;
}

export interface DoctorOptions {
  ollamaUrl?: string;
  /** If given, doctor also reports whether this specific model is pulled. */
  model?: string;
  fetchImpl?: typeof fetch;
}

async function firstLine(text: string): Promise<string> {
  return text.split(/\r?\n/, 1)[0]?.trim() ?? "";
}

async function checkFfmpegLike(command: string, name: string): Promise<DoctorCheck> {
  if (!(await commandExists(command))) {
    return { name, status: "not-found", detail: "not found on PATH" };
  }
  const result = await run(command, ["-version"]);
  return { name, status: "ok", detail: await firstLine(result.stdout) };
}

async function checkWhisper(): Promise<DoctorCheck> {
  const transcriber = new WhisperCppTranscriber();
  const available = await transcriber.isAvailable();
  return available
    ? { name: "Whisper (whisper.cpp)", status: "ok", detail: "found on PATH" }
    : {
        name: "Whisper (whisper.cpp)",
        status: "not-found",
        detail: "not found — install whisper.cpp and ensure `whisper-cli` (or `main`) is on PATH",
      };
}

async function checkOllama(options: DoctorOptions): Promise<{ service: DoctorCheck; model: DoctorCheck | null }> {
  const baseUrl = (options.ollamaUrl ?? "http://127.0.0.1:11434").replace(/\/+$/, "");
  const fetchImpl = options.fetchImpl ?? fetch;

  let versionOk = false;
  try {
    const res = await fetchImpl(`${baseUrl}/api/version`, { signal: AbortSignal.timeout(3_000) });
    versionOk = res.ok;
  } catch {
    versionOk = false;
  }
  if (!versionOk) {
    return {
      service: { name: "Ollama", status: "unreachable", detail: `could not reach ${baseUrl} — is \`ollama serve\` running?` },
      model: null,
    };
  }

  const service: DoctorCheck = { name: "Ollama", status: "ok", detail: baseUrl };
  if (!options.model) return { service, model: null };

  try {
    const res = await fetchImpl(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(5_000) });
    const body = (await res.json()) as { models?: { name: string }[] };
    const names = (body.models ?? []).map((m) => m.name);
    const found = names.some((n) => n === options.model || n.startsWith(`${options.model}:`));
    return {
      service,
      model: found
        ? { name: `Model (${options.model})`, status: "ok", detail: "found" }
        : {
            name: `Model (${options.model})`,
            status: "not-found",
            detail: `not pulled — run \`ollama pull ${options.model}\``,
          },
    };
  } catch (err) {
    return {
      service,
      model: {
        name: `Model (${options.model})`,
        status: "unreachable",
        detail: err instanceof Error ? err.message : String(err),
      },
    };
  }
}

export async function runDoctorChecks(options: DoctorOptions = {}): Promise<DoctorCheck[]> {
  const checks: DoctorCheck[] = [
    { name: "Node.js", status: "ok", detail: process.version },
  ];
  checks.push(await checkFfmpegLike("ffmpeg", "FFmpeg"));
  checks.push(await checkFfmpegLike("ffprobe", "FFprobe"));
  checks.push(await checkWhisper());

  const { service, model } = await checkOllama(options);
  checks.push(service);
  if (model) checks.push(model);

  return checks;
}

const STATUS_LABEL: Record<DoctorStatus, string> = {
  ok: "OK",
  "not-found": "NOT FOUND",
  unreachable: "UNREACHABLE",
};

export function formatDoctorReport(checks: DoctorCheck[]): string {
  const nameWidth = Math.max(...checks.map((c) => c.name.length));
  const statusWidth = Math.max(...checks.map((c) => STATUS_LABEL[c.status].length));
  return checks
    .map((c) => `${c.name.padEnd(nameWidth)}  ${STATUS_LABEL[c.status].padEnd(statusWidth)}  ${c.detail}`)
    .join("\n");
}
