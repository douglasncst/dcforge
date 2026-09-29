import { StringDecoder } from "node:string_decoder";

export interface TtyInput extends NodeJS.ReadableStream {
  isTTY?: boolean;
  setRawMode?(mode: boolean): unknown;
}

export class PromptAbortedError extends Error {
  constructor() {
    super("aborted");
  }
}

const ENTER = new Set(["\r", "\n"]);
const BACKSPACE = new Set(["\u007f", "\b"]);
const CTRL_C = "\u0003";
const CTRL_D = "\u0004";

/**
 * Reads one line from a terminal without echoing it. Raw mode is always
 * restored, including when the user aborts with Ctrl-C or Ctrl-D, when the
 * input stream errors, or when it closes before a line is finished.
 */
export function readHidden(
  prompt: string,
  input: TtyInput = process.stdin,
  output: NodeJS.WritableStream = process.stderr,
): Promise<string> {
  if (!input.isTTY || typeof input.setRawMode !== "function") {
    return Promise.reject(new Error("standard input is not a terminal"));
  }
  const setRawMode = input.setRawMode.bind(input);

  return new Promise((resolve, reject) => {
    let value = "";
    let settled = false;
    // Buffers a multi-byte UTF-8 sequence that arrives split across chunks
    // (e.g. a pasted non-ASCII character on a slow pipe) instead of letting
    // chunk.toString() turn the partial bytes into U+FFFD and silently
    // corrupt the password.
    const decoder = new StringDecoder("utf-8");

    const cleanup = () => {
      input.removeListener("data", onData);
      input.removeListener("error", onError);
      input.removeListener("close", onClose);
      input.removeListener("end", onClose);
      setRawMode(false);
      input.pause();
    };

    const finish = (err: Error | null) => {
      if (settled) return;
      settled = true;
      cleanup();
      output.write("\n");
      if (err) reject(err);
      else resolve(value);
    };

    const onData = (chunk: Buffer | string) => {
      const text = typeof chunk === "string" ? chunk : decoder.write(chunk);
      for (const char of text) {
        if (ENTER.has(char)) return finish(null);
        if (char === CTRL_C || (char === CTRL_D && value === "")) return finish(new PromptAbortedError());
        if (BACKSPACE.has(char)) {
          value = [...value].slice(0, -1).join("");
        } else if (char >= " ") {
          value += char;
        }
      }
    };

    const onError = (err: Error) => finish(err);
    // The input stream ending before Enter was pressed (stdin closed,
    // redirected from an already-exhausted file, etc.) must not leave the
    // promise hanging forever.
    const onClose = () => finish(new Error("input closed before a line was entered"));

    output.write(prompt);
    setRawMode(true);
    input.resume();
    input.on("data", onData);
    input.on("error", onError);
    input.on("close", onClose);
    input.on("end", onClose);
  });
}

/** Reads all of a non-interactive stream and returns its first line. */
export async function readFirstLine(input: NodeJS.ReadableStream = process.stdin): Promise<string> {
  let data = "";
  for await (const chunk of input) {
    data += chunk.toString();
  }
  return data.split(/\r?\n/, 1)[0] ?? "";
}
