import { describe, expect, it } from "vitest";
import { validateTranslationResponse } from "../src/translation/responseValidation.js";

describe("validateTranslationResponse", () => {
  it("accepts a response with exactly the expected ids", () => {
    const result = validateTranslationResponse({ segments: [{ id: 1, text: "a" }, { id: 2, text: "b" }] }, [1, 2]);
    expect(result).toEqual(new Map([[1, "a"], [2, "b"]]));
  });

  it("rejects a non-object response", () => {
    expect(() => validateTranslationResponse("not an object", [1])).toThrow(/not a/);
  });

  it("rejects a response missing the segments array", () => {
    expect(() => validateTranslationResponse({}, [1])).toThrow(/not a/);
  });

  it("rejects a missing segment id", () => {
    expect(() => validateTranslationResponse({ segments: [{ id: 1, text: "a" }] }, [1, 2])).toThrow(/missing segment ids: 2/);
  });

  it("rejects a duplicated segment id", () => {
    expect(() =>
      validateTranslationResponse({ segments: [{ id: 1, text: "a" }, { id: 1, text: "b" }] }, [1]),
    ).toThrow(/duplicate segment ids: 1/);
  });

  it("rejects an id that was not requested", () => {
    expect(() => validateTranslationResponse({ segments: [{ id: 1, text: "a" }, { id: 99, text: "b" }] }, [1])).toThrow(
      /weren't requested: 99/,
    );
  });

  it("rejects a non-string text field", () => {
    expect(() => validateTranslationResponse({ segments: [{ id: 1, text: 42 }] }, [1])).toThrow(/non-string text/);
  });

  it("rejects a non-integer id", () => {
    expect(() => validateTranslationResponse({ segments: [{ id: "1", text: "a" }] }, [1])).toThrow(/non-integer id/);
  });
});
