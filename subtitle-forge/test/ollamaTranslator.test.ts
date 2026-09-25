import { describe, expect, it, vi } from "vitest";
import { OllamaTranslator, buildTranslationPrompt } from "../src/translation/ollamaTranslator.js";
import type { SubtitleDocument } from "../src/core/types.js";

function ollamaResponse(json: unknown): Response {
  return new Response(JSON.stringify({ response: JSON.stringify(json) }), { status: 200 });
}

function doc(count: number): SubtitleDocument {
  return {
    segments: Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      startMs: i * 1000,
      endMs: i * 1000 + 900,
      text: `line ${i + 1}`,
    })),
  };
}

describe("buildTranslationPrompt", () => {
  it("includes only the requested ids to translate, and marks context as context", () => {
    const batch = {
      items: [{ id: 4, startMs: 0, endMs: 100, text: "current" }],
      contextSegments: [{ id: 3, startMs: 0, endMs: 100, text: "previous line" }],
    };
    const prompt = buildTranslationPrompt(batch, "en", "pt-BR");
    expect(prompt).toContain('"id": 4');
    expect(prompt).toContain("previous line");
    expect(prompt).toContain("Context only");
    expect(prompt).not.toMatch(/"id": 3\b/);
  });

  it("never asks the model for markdown or explanations", () => {
    const batch = { items: [{ id: 1, startMs: 0, endMs: 100, text: "hi" }], contextSegments: [] };
    const prompt = buildTranslationPrompt(batch, undefined, "pt-BR");
    expect(prompt).toMatch(/no markdown/);
    expect(prompt).toMatch(/no explanation/);
  });
});

describe("OllamaTranslator", () => {
  it("translates all segments, preserving timestamps and ids", async () => {
    const fetchImpl = vi.fn(async (url: string | URL) => {
      const u = String(url);
      if (u.endsWith("/api/version")) return new Response("{}", { status: 200 });
      return ollamaResponse({ segments: [{ id: 1, text: "olá" }, { id: 2, text: "tchau" }] });
    });
    const translator = new OllamaTranslator({ fetchImpl: fetchImpl as unknown as typeof fetch });
    const result = await translator.translate(doc(2), { to: "pt-BR", model: "llama3.2" });
    expect(result.segments).toEqual([
      { id: 1, startMs: 0, endMs: 900, text: "olá" },
      { id: 2, startMs: 1000, endMs: 1900, text: "tchau" },
    ]);
  });

  it("issues one request per batch", async () => {
    let generateCalls = 0;
    const fetchImpl = vi.fn(async (url: string | URL, init?: RequestInit) => {
      const u = String(url);
      if (u.endsWith("/api/version")) return new Response("{}", { status: 200 });
      generateCalls++;
      const body = JSON.parse(String(init?.body)) as { prompt: string };
      const ids = [...body.prompt.matchAll(/"id":\s*(\d+)/g)].map((m) => Number(m[1]));
      return ollamaResponse({ segments: ids.map((id) => ({ id, text: `t${id}` })) });
    });
    const translator = new OllamaTranslator({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      batching: { batchSize: 5, contextSize: 1 },
    });
    await translator.translate(doc(12), { to: "pt-BR", model: "llama3.2" });
    expect(generateCalls).toBe(3); // 5 + 5 + 2
  });

  it("retries once on an invalid response and succeeds on the second attempt", async () => {
    let call = 0;
    const fetchImpl = vi.fn(async (url: string | URL) => {
      const u = String(url);
      if (u.endsWith("/api/version")) return new Response("{}", { status: 200 });
      call++;
      if (call === 1) return ollamaResponse({ segments: [{ id: 1, text: "wrong shape" }, { id: 1, text: "dup" }] });
      return ollamaResponse({ segments: [{ id: 1, text: "ok" }] });
    });
    const translator = new OllamaTranslator({ fetchImpl: fetchImpl as unknown as typeof fetch });
    const result = await translator.translate(doc(1), { to: "pt-BR", model: "llama3.2" });
    expect(result.segments[0].text).toBe("ok");
    expect(call).toBe(2);
  });

  it("gives up after exhausting retries and never returns a corrupted document", async () => {
    const fetchImpl = vi.fn(async (url: string | URL) => {
      const u = String(url);
      if (u.endsWith("/api/version")) return new Response("{}", { status: 200 });
      return ollamaResponse({ segments: [] }); // always missing id 1
    });
    const translator = new OllamaTranslator({ fetchImpl: fetchImpl as unknown as typeof fetch });
    await expect(translator.translate(doc(1), { to: "pt-BR", model: "llama3.2" })).rejects.toThrow(
      /unusable response/,
    );
  });

  it("fails clearly when Ollama is unreachable", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    });
    const translator = new OllamaTranslator({ fetchImpl: fetchImpl as unknown as typeof fetch });
    await expect(translator.translate(doc(1), { to: "pt-BR", model: "llama3.2" })).rejects.toThrow(
      /Could not reach Ollama/,
    );
  });

  it("requires a model to be given", async () => {
    const translator = new OllamaTranslator({ fetchImpl: (async () => new Response("{}")) as unknown as typeof fetch });
    await expect(translator.translate(doc(1), { to: "pt-BR" })).rejects.toThrow(/--model is required/);
  });

  it("reports progress once per batch", async () => {
    const fetchImpl = vi.fn(async (url: string | URL) => {
      const u = String(url);
      if (u.endsWith("/api/version")) return new Response("{}", { status: 200 });
      return ollamaResponse({ segments: [{ id: 1, text: "x" }] });
    });
    const translator = new OllamaTranslator({ fetchImpl: fetchImpl as unknown as typeof fetch, batching: { batchSize: 1, contextSize: 0 } });
    const progress: Array<[number, number]> = [];
    await translator.translate(doc(1), { to: "pt-BR", model: "m", onProgress: (d, t) => progress.push([d, t]) });
    expect(progress).toEqual([[1, 1]]);
  });
});
