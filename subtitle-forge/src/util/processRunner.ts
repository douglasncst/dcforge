import { spawn } from "node:child_process";

export interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

export interface RunOptions {
  signal?: AbortSignal;
  /** Milliseconds before the process is killed. No timeout by default. */
  timeoutMs?: number;
}

/**
 * Runs an external command with argv passed as a real array — never through
 * a shell — so paths with spaces, quotes, `&&`, parentheses or Unicode are
 * passed through exactly as given instead of being re-parsed by a shell.
 */
export function run(command: string, args: string[], options: RunOptions = {}): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      shell: false,
      signal: options.signal,
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer =
      options.timeoutMs !== undefined
        ? setTimeout(() => {
            timedOut = true;
            child.kill();
          }, options.timeoutMs)
        : null;

    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on("error", (err) => {
      if (timer) clearTimeout(timer);
      reject(err);
    });

    child.on("close", (exitCode) => {
      if (timer) clearTimeout(timer);
      if (timedOut) {
        reject(new Error(`${command} timed out after ${options.timeoutMs}ms`));
        return;
      }
      resolve({ stdout, stderr, exitCode });
    });
  });
}

/** True if `command` can be spawned at all (found on PATH, executable). */
export async function commandExists(command: string, versionArgs: string[] = ["-version"]): Promise<boolean> {
  try {
    await run(command, versionArgs);
    return true;
  } catch {
    return false;
  }
}
