import { ForgeError } from "../core/errors.js";

const LOOPBACK_RE = /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:|\/|$)/i;

export function isLoopbackUrl(url: string): boolean {
  return LOOPBACK_RE.test(url);
}

/**
 * --local's actual guarantee: refuse to run rather than silently send
 * subtitle text off the machine. Never a silent fallback — a step that
 * can't run locally fails clearly instead.
 */
export function assertLocalOllamaUrl(url: string): void {
  if (!isLoopbackUrl(url)) {
    throw new ForgeError(
      `--local was set, but the Ollama endpoint (${url}) is not loopback. In local mode nothing may ` +
        "intentionally leave this machine. Drop --local if you consciously want a remote Ollama endpoint " +
        "— that's still your choice to make, just not silently.",
    );
  }
}
