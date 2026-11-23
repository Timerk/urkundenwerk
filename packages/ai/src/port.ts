import type { z } from "zod";

/**
 * The port every model adapter implements (ADR-0007). It knows nothing about
 * rules, drafts, or prompts: features such as explanations and, later,
 * extraction build requests on top of it and own their prompts and schemas.
 */
export interface LlmClient {
  /** The adapter's name, for logs and result metadata. */
  readonly provider: "anthropic" | "fake";
  /**
   * Asks the model for one JSON value that matches `schema`. Resolves with
   * data that has been validated against the schema, or rejects with an
   * `LlmError`.
   */
  generateStructured<T>(
    request: GenerateStructuredRequest<T>,
  ): Promise<GenerateStructuredResult<T>>;
}

export interface GenerateStructuredRequest<T> {
  /** A short, non-personal label of the feature, e.g. "explain". */
  task: string;
  system: string;
  user: string;
  /** Validates the output. Adapters may also send it to constrain decoding. */
  schema: z.ZodType<T>;
  model: string;
  maxOutputTokens: number;
  /** How much the model may think; small tasks use "low". */
  effort?: "low" | "medium" | "high";
  signal?: AbortSignal;
}

export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface GenerateStructuredResult<T> {
  data: T;
  /** The model that answered, as the provider reports it. */
  model: string;
  usage: LlmUsage;
  stopReason: string;
}
