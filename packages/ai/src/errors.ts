/**
 * Why a model call failed, independent of the provider. Callers branch on the
 * kind; messages never contain prompts, outputs, or keys.
 */
export type LlmErrorKind =
  /** The call took longer than the configured timeout. */
  | "timeout"
  /** The provider throttled the request (HTTP 429). */
  | "rate_limited"
  /** The provider or the network failed (5xx, overload, connection). */
  | "unavailable"
  /** The key is missing, invalid, or lacks permission (401, 403). */
  | "unauthorized"
  /** The provider rejected the request itself (400, 404, 413, 422). */
  | "rejected"
  /** The model declined to answer. */
  | "refused"
  /** The output hit the token limit before it was complete. */
  | "truncated"
  /** The output was not JSON or did not match the schema. */
  | "invalid_output"
  /** The caller cancelled the request. */
  | "aborted";

const RETRYABLE: ReadonlySet<LlmErrorKind> = new Set([
  "timeout",
  "rate_limited",
  "unavailable",
]);

export class LlmError extends Error {
  readonly kind: LlmErrorKind;

  constructor(kind: LlmErrorKind, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "LlmError";
    this.kind = kind;
  }

  /** Transient failures that a second attempt may get past. */
  get retryable(): boolean {
    return RETRYABLE.has(this.kind);
  }
}

export function isLlmError(error: unknown): error is LlmError {
  return error instanceof LlmError;
}
