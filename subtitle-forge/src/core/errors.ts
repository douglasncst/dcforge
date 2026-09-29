/**
 * An expected failure the CLI should report to the user with a clean
 * message and a specific exit code, as opposed to a bug that should surface
 * as an unhandled exception with a stack trace. Library code throws this
 * (or lets it propagate); only the command layer / top-level handler
 * decides to print with --verbose detail and set process.exitCode.
 */
export class ForgeError extends Error {
  readonly exitCode: number;
  /** Extra technical detail (a wrapped stderr, a stack) shown only with --verbose. */
  readonly detail?: string;

  constructor(message: string, options: { exitCode?: number; detail?: string } = {}) {
    super(message);
    this.name = "ForgeError";
    this.exitCode = options.exitCode ?? 1;
    this.detail = options.detail;
  }
}
