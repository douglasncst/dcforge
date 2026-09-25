/**
 * A failure library code expects and wants reported to the user with a
 * specific exit code, as opposed to a bug that should surface as an
 * unhandled exception with a stack trace.
 *
 * Library code (src/lib/**, excluding this file and output.ts's `fail`
 * helper, which IS the command layer's exit primitive) throws this instead
 * of calling process.exit itself. The command layer — or, for anything a
 * command didn't explicitly catch, the top-level handler in index.ts —
 * decides what to print and what exit code to use.
 */
export class CliError extends Error {
  readonly exitCode: number;

  constructor(message: string, exitCode = 1) {
    super(message);
    this.name = "CliError";
    this.exitCode = exitCode;
  }
}
