import { describe, expect, it } from "vitest";
import { PassThrough, Readable } from "node:stream";
import { PromptAbortedError, readFirstLine, readHidden, type TtyInput } from "../src/lib/prompt.js";

function fakeTty(): { input: TtyInput & PassThrough; rawModes: boolean[] } {
  const rawModes: boolean[] = [];
  const input = Object.assign(new PassThrough(), {
    isTTY: true,
    setRawMode(mode: boolean) {
      rawModes.push(mode);
    },
  });
  return { input, rawModes };
}

function sink(): PassThrough & { text: () => string } {
  const out = new PassThrough();
  let text = "";
  out.on("data", (c) => (text += c.toString()));
  return Object.assign(out, { text: () => text });
}

describe("readHidden", () => {
  it("reads a line without echoing it and restores the terminal", async () => {
    const { input, rawModes } = fakeTty();
    const out = sink();
    const pending = readHidden("Password: ", input, out);
    input.write("s3cr");
    input.write("et!\r");
    await expect(pending).resolves.toBe("s3cret!");
    expect(out.text()).toBe("Password: \n");
    expect(rawModes).toEqual([true, false]);
  });

  it("handles backspace", async () => {
    const { input } = fakeTty();
    const pending = readHidden("", input, sink());
    input.write("abx\u007fc\n");
    await expect(pending).resolves.toBe("abc");
  });

  it("rejects on Ctrl-C and still restores the terminal", async () => {
    const { input, rawModes } = fakeTty();
    const pending = readHidden("", input, sink());
    input.write("ab\u0003");
    await expect(pending).rejects.toBeInstanceOf(PromptAbortedError);
    expect(rawModes).toEqual([true, false]);
  });

  it("refuses to run when input is not a terminal", async () => {
    await expect(readHidden("", new PassThrough(), sink())).rejects.toThrow(/not a terminal/);
  });
});

describe("readFirstLine", () => {
  it("returns only the first line of piped input", async () => {
    await expect(readFirstLine(Readable.from(["pass", "word\nignored\n"]))).resolves.toBe("password");
  });

  it("strips a Windows line ending", async () => {
    await expect(readFirstLine(Readable.from(["pw\r\n"]))).resolves.toBe("pw");
  });
});
