import { describe, expect, it } from "vitest";
import { assertLocalOllamaUrl, isLoopbackUrl } from "../src/util/localMode.js";

describe("isLoopbackUrl", () => {
  it.each([
    "http://127.0.0.1:11434",
    "http://localhost:11434",
    "https://127.0.0.1",
    "http://[::1]:11434",
  ])("accepts %s as loopback", (url) => {
    expect(isLoopbackUrl(url)).toBe(true);
  });

  it.each(["http://192.168.1.10:11434", "https://ollama.example.com", "http://0.0.0.0:11434"])(
    "rejects %s as non-loopback",
    (url) => {
      expect(isLoopbackUrl(url)).toBe(false);
    },
  );
});

describe("assertLocalOllamaUrl", () => {
  it("does not throw for a loopback URL", () => {
    expect(() => assertLocalOllamaUrl("http://127.0.0.1:11434")).not.toThrow();
  });

  it("throws a ForgeError for a non-loopback URL, naming --local as the cause", () => {
    expect(() => assertLocalOllamaUrl("http://192.168.1.10:11434")).toThrow(/--local/);
  });
});
