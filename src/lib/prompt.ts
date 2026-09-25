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
 * restored, including when the user aborts with Ctrl-C or Ctrl-D.
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

    const finish = (err: Error | null) => {
      input.removeListener("data", onData);
      setRawMode(false);
      input.pause();
      output.write("\n");
      if (err) reject(err);
      else resolve(value);
    };

    const onData = (chunk: Buffer | string) => {
      for (const char of chunk.toString()) {
        if (ENTER.has(char)) return finish(null);
        if (char === CTRL_C || (char === CTRL_D && value === "")) return finish(new PromptAbortedError());
        if (BACKSPACE.has(char)) {
          value = [...value].slice(0, -1).join("");
        } else if (char >= " ") {
          value += char;
        }
      }
    };

    output.write(prompt);
    setRawMode(true);
    input.resume();
    input.on("data", onData);
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
