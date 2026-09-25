import { ForgeError } from "../core/errors.js";
import type { SubtitleDocument, SubtitleSegment, TranslateOptions, Translator } from "../core/types.js";
import { createBatches, DEFAULT_BATCHING_OPTIONS, type BatchingOptions, type TranslationBatch } from "./batching.js";
import { validateTranslationResponse } from "./responseValidation.js";

const DEFAULT_OLLAMA_URL = "http://127.0.0.1:11434";
const REQUEST_TIMEOUT_MS = 120_000;
const MAX_RETRIES = 2;

export interface OllamaTranslatorOptions {
  baseUrl?: string;
  batching?: BatchingOptions;
  fetchImpl?: typeof fetch;
  onDebug?: (message: string) => void;
}

export function buildTranslationPrompt(batch: TranslationBatch, from: string | undefined, to: string): string {
  const contextBlock =
    batch.contextSegments.length > 0
      ? "Context only — already-translated lines that came right before this batch. " +
        "Do NOT translate or re-return these; they're here so pronouns and continuations make sense:\n" +
        batch.contextSegments.map((s) => `- "${s.text.replace(/\n/g, " ")}"`).join("\n") +
        "\n\n"
      : "";

  const segmentsBlock = batch.items
    .map((s) => `{"id": ${s.id}, "text": ${JSON.stringify(s.text)}}`)
    .join(",\n");

  return (
    `You are translating movie/TV subtitles${from ? ` from ${from}` : ""} into ${to}. ` +
    "Produce natural, idiomatic subtitle text a native speaker would actually say on screen — " +
    "not a literal, word-for-word translation. Preserve proper names, preserve meaning, preserve " +
    "each line's tone and register. Keep it as concise as the original — subtitles must stay readable.\n\n" +
    contextBlock +
    "Translate ONLY the segments below, identified by id. Return EVERY id listed, exactly once each, " +
    "no more and no fewer. Do not merge, split, reorder, or renumber segments.\n\n" +
    `Segments to translate:\n[\n${segmentsBlock}\n]\n\n` +
    'Respond with ONLY a JSON object of this exact shape, nothing else — no markdown, no code fences, ' +
    "no explanation, no chatbot preamble or sign-off:\n" +
    '{"segments": [{"id": <number>, "text": "<translation>"}, ...]}'
  );
}

interface OllamaGenerateResponse {
  response?: string;
  error?: string;
}

export class OllamaTranslator implements Translator {
  readonly id = "ollama";
  private readonly baseUrl: string;
  private readonly batching: BatchingOptions;
  private readonly fetchImpl: typeof fetch;
  private readonly onDebug: (message: string) => void;

  constructor(options: OllamaTranslatorOptions = {}) {
    this.baseUrl = (options.baseUrl ?? DEFAULT_OLLAMA_URL).replace(/\/+$/, "");
    this.batching = options.batching ?? DEFAULT_BATCHING_OPTIONS;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.onDebug = options.onDebug ?? (() => {});
    if (!/^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])/i.test(this.baseUrl)) {
      // Not a restriction — the user explicitly configured this endpoint —
      // just an honest heads-up that "local mode" doesn't mean "private"
      // once the endpoint itself isn't loopback.
      this.onDebug(
        `Ollama endpoint ${this.baseUrl} is not loopback: subtitle text will leave this machine to reach it.`,
      );
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await this.fetchImpl(`${this.baseUrl}/api/version`, { signal: AbortSignal.timeout(3_000) });
      return res.ok;
    } catch {
      return false;
    }
  }

  async translate(doc: SubtitleDocument, options: TranslateOptions): Promise<SubtitleDocument> {
    if (!options.model) {
      throw new ForgeError("--model is required for the Ollama translator (e.g. --model llama3.2).");
    }
    if (!(await this.isAvailable())) {
      throw new ForgeError(
        `Could not reach Ollama at ${this.baseUrl}. Is \`ollama serve\` running? ` +
          "Override the address with --ollama-url.",
      );
    }

    const batches = createBatches(doc.segments, this.batching);
    const translated = new Map<number, string>();

    for (const [i, batch] of batches.entries()) {
      const byId = await this.translateBatch(batch, options);
      for (const [id, text] of byId) translated.set(id, text);
      options.onProgress?.(i + 1, batches.length);
    }

    return {
      segments: doc.segments.map((s): SubtitleSegment => ({ ...s, text: translated.get(s.id) ?? s.text })),
    };
  }

  private async translateBatch(batch: TranslationBatch, options: TranslateOptions): Promise<Map<number, string>> {
    const prompt = buildTranslationPrompt(batch, options.from, options.to);
    const expectedIds = batch.items.map((s) => s.id);

    let lastError: unknown;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        this.onDebug(`translate batch: ${expectedIds.length} segment(s), attempt ${attempt + 1}/${MAX_RETRIES + 1}`);
        const raw = await this.callOllama(prompt, options);
        return validateTranslationResponse(raw, expectedIds);
      } catch (err) {
        lastError = err;
        this.onDebug(`batch attempt ${attempt + 1} failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    throw new ForgeError(
      `Ollama returned an unusable response for segments ${expectedIds[0]}-${expectedIds.at(-1)} ` +
        `after ${MAX_RETRIES + 1} attempts. The original subtitle file was not modified.`,
      { detail: lastError instanceof Error ? lastError.message : String(lastError) },
    );
  }

  private async callOllama(prompt: string, options: TranslateOptions): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const onAbort = () => controller.abort();
    options.signal?.addEventListener("abort", onAbort);

    try {
      const res = await this.fetchImpl(`${this.baseUrl}/api/generate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model: options.model, prompt, format: "json", stream: false }),
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new Error(`Ollama returned HTTP ${res.status}`);
      }
      const body = (await res.json()) as OllamaGenerateResponse;
      if (body.error) {
        throw new Error(`Ollama error: ${body.error}`);
      }
      if (typeof body.response !== "string") {
        throw new Error("Ollama response had no \"response\" field.");
      }
      try {
        return JSON.parse(body.response);
      } catch {
        throw new Error("Ollama's \"response\" field was not valid JSON.");
      }
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener("abort", onAbort);
    }
  }
}
