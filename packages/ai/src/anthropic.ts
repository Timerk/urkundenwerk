import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { LlmError } from "./errors";
import type {
  GenerateStructuredRequest,
  GenerateStructuredResult,
  LlmClient,
} from "./port";

/** The part of the SDK the adapter uses, so tests can inject a mock. */
export type AnthropicMessages = Pick<Anthropic["messages"], "create">;

/** Maps SDK errors to provider-independent kinds, most specific first. */
export function toLlmError(error: unknown): LlmError {
  const wrap = (kind: LlmError["kind"], message: string) =>
    new LlmError(kind, message, { cause: error });
  if (error instanceof LlmError) return error;
  if (error instanceof Anthropic.APIUserAbortError) {
    return wrap("aborted", "The request was cancelled.");
  }
  if (error instanceof Anthropic.APIConnectionTimeoutError) {
    return wrap("timeout", "The provider did not answer in time.");
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return wrap("unavailable", "The provider could not be reached.");
  }
  if (error instanceof Anthropic.RateLimitError) {
    return wrap("rate_limited", "The provider is throttling requests.");
  }
  if (
    error instanceof Anthropic.AuthenticationError ||
    error instanceof Anthropic.PermissionDeniedError
  ) {
    return wrap("unauthorized", "The API key was not accepted.");
  }
  if (error instanceof Anthropic.InternalServerError) {
    return wrap("unavailable", "The provider failed or is overloaded.");
  }
  if (error instanceof Anthropic.APIError) {
    return error.status !== undefined && error.status >= 500
      ? wrap("unavailable", `The provider failed (${error.status}).`)
      : wrap(
          "rejected",
          `The provider rejected the request (${error.status}).`,
        );
  }
  return wrap("unavailable", "The request to the provider failed.");
}

/**
 * Calls the Claude Messages API with structured outputs: the Zod schema is
 * sent as a JSON schema that constrains decoding, and the answer is still
 * parsed and validated here, so a schema mismatch can never pass through.
 */
export class AnthropicLlmClient implements LlmClient {
  readonly provider = "anthropic" as const;

  constructor(private readonly messages: AnthropicMessages) {}

  /** Creates a client for an API key. Retries are left to `withResilience`. */
  static fromApiKey(apiKey: string): AnthropicLlmClient {
    return new AnthropicLlmClient(
      new Anthropic({ apiKey, maxRetries: 0 }).messages,
    );
  }

  async generateStructured<T>(
    request: GenerateStructuredRequest<T>,
  ): Promise<GenerateStructuredResult<T>> {
    let message: Anthropic.Message;
    try {
      message = await this.messages.create(
        {
          model: request.model,
          max_tokens: request.maxOutputTokens,
          system: request.system,
          messages: [{ role: "user", content: request.user }],
          output_config: {
            format: zodOutputFormat(request.schema),
            ...(request.effort ? { effort: request.effort } : {}),
          },
        },
        { signal: request.signal, maxRetries: 0 },
      );
    } catch (error) {
      throw toLlmError(error);
    }

    if (message.stop_reason === "refusal") {
      throw new LlmError("refused", "The model declined to answer.");
    }
    if (message.stop_reason === "max_tokens") {
      throw new LlmError("truncated", "The answer hit the token limit.");
    }

    const text = message.content
      .flatMap((block) => (block.type === "text" ? [block.text] : []))
      .join("");
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch (error) {
      throw new LlmError("invalid_output", "The answer was not JSON.", {
        cause: error,
      });
    }
    const parsed = request.schema.safeParse(json);
    if (!parsed.success) {
      throw new LlmError(
        "invalid_output",
        "The answer did not match the schema.",
        { cause: parsed.error },
      );
    }

    return {
      data: parsed.data,
      model: message.model,
      usage: {
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
      },
      stopReason: message.stop_reason ?? "end_turn",
    };
  }
}
