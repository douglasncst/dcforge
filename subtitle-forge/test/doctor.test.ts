import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../src/util/processRunner.js", () => ({
  commandExists: vi.fn(),
  run: vi.fn(),
}));

const { commandExists, run } = await import("../src/util/processRunner.js");
const { runDoctorChecks, formatDoctorReport } = await import("../src/cli/doctor.js");

const commandExistsMock = vi.mocked(commandExists);
const runMock = vi.mocked(run);

beforeEach(() => {
  commandExistsMock.mockReset();
  runMock.mockReset();
  runMock.mockResolvedValue({ stdout: "ffmpeg version 8.0\n", stderr: "", exitCode: 0 });
});

function fetchOk(models: string[] = []): typeof fetch {
  return vi.fn(async (url: string | URL) => {
    const u = String(url);
    if (u.endsWith("/api/version")) return new Response("{}", { status: 200 });
    if (u.endsWith("/api/tags")) return new Response(JSON.stringify({ models: models.map((name) => ({ name })) }), { status: 200 });
    return new Response("not found", { status: 404 });
  }) as unknown as typeof fetch;
}

function fetchUnreachable(): typeof fetch {
  return vi.fn(async () => {
    throw new Error("ECONNREFUSED");
  }) as unknown as typeof fetch;
}

describe("runDoctorChecks", () => {
  it("reports Node as always OK", async () => {
    commandExistsMock.mockResolvedValue(false);
    const checks = await runDoctorChecks({ fetchImpl: fetchUnreachable() });
    expect(checks.find((c) => c.name === "Node.js")).toMatchObject({ status: "ok" });
  });

  it("reports FFmpeg/FFprobe as not-found when missing", async () => {
    commandExistsMock.mockResolvedValue(false);
    const checks = await runDoctorChecks({ fetchImpl: fetchUnreachable() });
    expect(checks.find((c) => c.name === "FFmpeg")).toMatchObject({ status: "not-found" });
    expect(checks.find((c) => c.name === "FFprobe")).toMatchObject({ status: "not-found" });
  });

  it("reports FFmpeg as ok with its version line when present", async () => {
    commandExistsMock.mockResolvedValue(true);
    const checks = await runDoctorChecks({ fetchImpl: fetchUnreachable() });
    expect(checks.find((c) => c.name === "FFmpeg")).toMatchObject({ status: "ok", detail: "ffmpeg version 8.0" });
  });

  it("reports Whisper as not-found when neither binary name is present", async () => {
    commandExistsMock.mockResolvedValue(false);
    const checks = await runDoctorChecks({ fetchImpl: fetchUnreachable() });
    expect(checks.find((c) => c.name.startsWith("Whisper"))).toMatchObject({ status: "not-found" });
  });

  it("reports Ollama as unreachable when the service does not respond", async () => {
    commandExistsMock.mockResolvedValue(false);
    const checks = await runDoctorChecks({ fetchImpl: fetchUnreachable() });
    expect(checks.find((c) => c.name === "Ollama")).toMatchObject({ status: "unreachable" });
  });

  it("reports Ollama as ok and does not check a model when none was given", async () => {
    commandExistsMock.mockResolvedValue(false);
    const checks = await runDoctorChecks({ fetchImpl: fetchOk() });
    expect(checks.find((c) => c.name === "Ollama")).toMatchObject({ status: "ok" });
    expect(checks.find((c) => c.name.startsWith("Model"))).toBeUndefined();
  });

  it("reports a requested model as found or not found", async () => {
    commandExistsMock.mockResolvedValue(false);
    const found = await runDoctorChecks({ fetchImpl: fetchOk(["llama3.2:latest"]), model: "llama3.2" });
    expect(found.find((c) => c.name.startsWith("Model"))).toMatchObject({ status: "ok" });

    const missing = await runDoctorChecks({ fetchImpl: fetchOk(["mistral"]), model: "llama3.2" });
    expect(missing.find((c) => c.name.startsWith("Model"))).toMatchObject({ status: "not-found" });
  });
});

describe("formatDoctorReport", () => {
  it("aligns columns and shows a human-readable status", () => {
    const report = formatDoctorReport([
      { name: "Node.js", status: "ok", detail: "v22.0.0" },
      { name: "Whisper (whisper.cpp)", status: "not-found", detail: "not found" },
    ]);
    expect(report).toContain("Node.js");
    expect(report).toContain("OK");
    expect(report).toContain("NOT FOUND");
  });
});
