import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { LlmError } from "./errors";
import type {
  GenerateStructuredRequest,
  GenerateStructuredResult,
  LlmClient,
} from "./port";

/** The part of the SDK the adapter uses, so tests can inject a mock. */
export type OpenAiResponses = Pick<OpenAI["responses"], "create">;

/** Maps SDK errors to provider-independent kinds, most specific first. */
export function toOpenAiLlmError(error: unknown): LlmError {
  const wrap = (kind: LlmError["kind"], message: string) =>
    new LlmError(kind, message, { cause: error });
  if (error instanceof LlmError) return error;
  if (error instanceof OpenAI.APIUserAbortError) {
    return wrap("aborted", "The request was cancelled.");
  }
  if (error instanceof OpenAI.APIConnectionTimeoutError) {
    return wrap("timeout", "The provider did not answer in time.");
  }
  if (error instanceof OpenAI.APIConnectionError) {
    return wrap("unavailable", "The provider could not be reached.");
  }
  if (error instanceof OpenAI.RateLimitError) {
    return wrap("rate_limited", "The provider is throttling requests.");
  }
  if (
    error instanceof OpenAI.AuthenticationError ||
    error instanceof OpenAI.PermissionDeniedError
  ) {
    return wrap("unauthorized", "The API key was not accepted.");
  }
  if (error instanceof OpenAI.InternalServerError) {
    return wrap("unavailable", "The provider failed or is overloaded.");
  }
  if (error instanceof OpenAI.APIError) {
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
 * Calls the OpenAI Responses API with Structured Outputs: the Zod schema is
 * sent as a strict JSON schema that constrains decoding, and the answer is
 * still parsed and validated here. Responses are not stored on OpenAI's side
 * (`store: false`). OpenAI caches long prompt prefixes automatically, so the
 * `cacheSystemPrompt` hint only adds a stable cache key per task.
 */
export class OpenAiLlmClient implements LlmClient {
  readonly provider = "openai" as const;

  constructor(private readonly responses: OpenAiResponses) {}

  /** Creates a client for an API key. Retries are left to `withResilience`. */
  static fromApiKey(apiKey: string): OpenAiLlmClient {
    return new OpenAiLlmClient(new OpenAI({ apiKey, maxRetries: 0 }).responses);
  }

  async generateStructured<T>(
    request: GenerateStructuredRequest<T>,
  ): Promise<GenerateStructuredResult<T>> {
    let response: OpenAI.Responses.Response;
    try {
      response = await this.responses.create(
        {
          model: request.model,
          instructions: request.system,
          input: request.user,
          max_output_tokens: request.maxOutputTokens,
          text: { format: zodTextFormat(request.schema, "answer") },
          store: false,
          ...(request.effort ? { reasoning: { effort: request.effort } } : {}),
          ...(request.cacheSystemPrompt
            ? { prompt_cache_key: `urkundenwerk-${request.task}` }
            : {}),
        },
        { signal: request.signal, maxRetries: 0 },
      );
    } catch (error) {
      throw toOpenAiLlmError(error);
    }

    if (response.status === "incomplete") {
      throw response.incomplete_details?.reason === "content_filter"
        ? new LlmError("refused", "The model declined to answer.")
        : new LlmError("truncated", "The answer hit the token limit.");
    }
    const refused = response.output.some(
      (item) =>
        item.type === "message" &&
        item.content.some((part) => part.type === "refusal"),
    );
    if (refused) {
      throw new LlmError("refused", "The model declined to answer.");
    }
    if (response.status !== "completed") {
      throw new LlmError(
        "unavailable",
        `The response ended as ${response.status ?? "unknown"}.`,
      );
    }

    let json: unknown;
    try {
      json = JSON.parse(response.output_text);
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

    // OpenAI counts cached tokens inside input_tokens; the port reports
    // them separately, as cache reads.
    const usage = response.usage;
    const cached = usage?.input_tokens_details?.cached_tokens ?? 0;
    return {
      data: parsed.data,
      model: response.model,
      usage: {
        inputTokens: (usage?.input_tokens ?? 0) - cached,
        outputTokens: usage?.output_tokens ?? 0,
        cacheCreationInputTokens: 0,
        cacheReadInputTokens: cached,
      },
      stopReason: response.status,
    };
  }
}
