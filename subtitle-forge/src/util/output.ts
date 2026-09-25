export interface Logger {
  verbose: boolean;
  /** A pipeline step header, e.g. "[3/6] Transcribing". */
  step(current: number, total: number, label: string): void;
  /** Progress within a step, e.g. "Translating 3/18 batches". Overwrites the previous line when the output is a TTY. */
  progress(label: string): void;
  /** Technical detail (external commands run, timings, batches) — printed only with --verbose. Never pass secrets. */
  debug(message: string): void;
  info(message: string): void;
  warn(message: string): void;
}

export interface LogStream extends NodeJS.WritableStream {
  isTTY?: boolean;
}

export function createLogger(verbose: boolean, out: LogStream = process.stdout): Logger {
  let lastProgressLength = 0;
  const clearProgress = () => {
    if (lastProgressLength > 0 && out.isTTY) {
      out.write(`\r${" ".repeat(lastProgressLength)}\r`);
      lastProgressLength = 0;
    } else if (lastProgressLength > 0) {
      out.write("\n");
      lastProgressLength = 0;
    }
  };

  return {
    verbose,
    step(current, total, label) {
      clearProgress();
      out.write(`[${current}/${total}] ${label}\n`);
    },
    progress(label) {
      if (out.isTTY) {
        out.write(`\r${" ".repeat(lastProgressLength)}\r  ${label}`);
        lastProgressLength = label.length + 2;
      } else {
        // Non-interactive output (piped/redirected): one line per update,
        // not an escape-code overwrite nobody will see move.
        out.write(`  ${label}\n`);
      }
    },
    debug(message) {
      if (verbose) {
        clearProgress();
        out.write(`  · ${message}\n`);
      }
    },
    info(message) {
      clearProgress();
      out.write(`${message}\n`);
    },
    warn(message) {
      clearProgress();
      process.stderr.write(`Warning: ${message}\n`);
    },
  };
}
