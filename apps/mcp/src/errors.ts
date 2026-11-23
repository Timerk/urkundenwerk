/**
 * An error the agent can act on. Its message says what went wrong and what to
 * do next; `details` carries structured data such as rule issues. Tool
 * results report it with `isError: true`.
 */
export class ToolError extends Error {
  readonly details: Record<string, unknown> | undefined;

  constructor(message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "ToolError";
    this.details = details;
  }
}
