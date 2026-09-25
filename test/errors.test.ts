import { describe, expect, it } from "vitest";
import { CliError } from "../src/lib/errors.js";

describe("CliError", () => {
  it("defaults to exit code 1", () => {
    const err = new CliError("boom");
    expect(err.message).toBe("boom");
    expect(err.exitCode).toBe(1);
    expect(err.name).toBe("CliError");
    expect(err).toBeInstanceOf(Error);
  });

  it("accepts a custom exit code", () => {
    expect(new CliError("aborted", 130).exitCode).toBe(130);
  });
});
