import { LlmError, type LlmErrorKind } from "./errors";
import type {
  GenerateStructuredRequest,
  GenerateStructuredResult,
  LlmClient,
} from "./port";

/** What the fake answers to one request. */
export type FakeResponse =
  /** Output that is validated with the request's schema, like real output. */
  | { kind: "output"; output: unknown }
  /** A failure of the given kind. */
  | { kind: "error"; error: LlmErrorKind }
  /** No answer until the request is aborted, to exercise timeouts. */
  | { kind: "hang" };

export type FakeResponder = (
  request: GenerateStructuredRequest<unknown>,
) => FakeResponse;

export const FAKE_MODEL = "fake-model";

/**
 * A deterministic adapter for tests, end-to-end runs, and local development
 * without a key. It never touches the network. It records the requests it
 * receives, so tests can assert exactly what would have been sent.
 */
export class FakeLlmClient implements LlmClient {
  readonly provider = "fake" as const;
  readonly requests: GenerateStructuredRequest<unknown>[] = [];

  constructor(private readonly respond: FakeResponder) {}

  /** Answers with the scripted responses in order, then fails. */
  static scripted(responses: readonly FakeResponse[]): FakeLlmClient {
    let next = 0;
    return new FakeLlmClient(
      () => responses[next++] ?? { kind: "error", error: "unavailable" },
    );
  }

  async generateStructured<T>(
    request: GenerateStructuredRequest<T>,
  ): Promise<GenerateStructuredResult<T>> {
    this.requests.push(request as GenerateStructuredRequest<unknown>);
    const response = this.respond(
      request as GenerateStructuredRequest<unknown>,
    );
    switch (response.kind) {
      case "error":
        throw new LlmError(response.error, `Fake ${response.error}.`);
      case "hang":
        return new Promise((_, reject) => {
          const abort = () =>
            reject(new LlmError("aborted", "The request was cancelled."));
          if (request.signal?.aborted) abort();
          request.signal?.addEventListener("abort", abort, { once: true });
        });
      case "output": {
        const parsed = request.schema.safeParse(response.output);
        if (!parsed.success) {
          throw new LlmError("invalid_output", "The answer did not match.");
        }
        return {
          data: parsed.data,
          model: FAKE_MODEL,
          usage: {
            inputTokens: 0,
            outputTokens: 0,
            cacheCreationInputTokens: 0,
            cacheReadInputTokens: 0,
          },
          stopReason: "end_turn",
        };
      }
    }
  }
}
