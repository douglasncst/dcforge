import { ForgeError } from "../core/errors.js";

export interface TranslatedSegment {
  id: number;
  text: string;
}

/**
 * Validates the model's structured response against exactly the ids that
 * were requested. Ollama's `format: "json"` only guarantees syntactically
 * valid JSON, not that it matches our schema or asked-for ids, so this is
 * the actual contract enforcement — the model never controls timestamps or
 * segment identity, only text.
 */
export function validateTranslationResponse(raw: unknown, expectedIds: number[]): Map<number, string> {
  if (typeof raw !== "object" || raw === null || !Array.isArray((raw as { segments?: unknown }).segments)) {
    throw new ForgeError('model response is not a {"segments": [...]} object.');
  }
  const items = (raw as { segments: unknown[] }).segments;

  const byId = new Map<number, string>();
  const duplicates = new Set<number>();
  for (const [i, item] of items.entries()) {
    if (typeof item !== "object" || item === null) {
      throw new ForgeError(`model response segment at index ${i} is not an object.`);
    }
    const { id, text } = item as { id?: unknown; text?: unknown };
    if (typeof id !== "number" || !Number.isInteger(id)) {
      throw new ForgeError(`model response segment at index ${i} has a non-integer id.`);
    }
    if (typeof text !== "string") {
      throw new ForgeError(`model response segment id ${id} has a non-string text.`);
    }
    if (byId.has(id)) {
      duplicates.add(id);
    }
    byId.set(id, text);
  }
  if (duplicates.size > 0) {
    throw new ForgeError(`model response contains duplicate segment ids: ${[...duplicates].join(", ")}.`);
  }

  const missing = expectedIds.filter((id) => !byId.has(id));
  if (missing.length > 0) {
    throw new ForgeError(`model response is missing segment ids: ${missing.join(", ")}.`);
  }

  const unexpected = [...byId.keys()].filter((id) => !expectedIds.includes(id));
  if (unexpected.length > 0) {
    throw new ForgeError(`model response includes segment ids that weren't requested: ${unexpected.join(", ")}.`);
  }

  return byId;
}
