import { isLlmError, LlmError } from "./errors";
import type {
  GenerateStructuredRequest,
  GenerateStructuredResult,
  LlmClient,
} from "./port";

export interface ResilienceOptions {
  /** Deadline for each attempt. */
  timeoutMs: number;
  /** Extra attempts after a transient failure. Defaults to one. */
  retries?: number;
  /** Pause before a retry. */
  retryDelayMs?: number;
  /** Injected for tests. */
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
}

function defaultSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new LlmError("aborted", "The request was cancelled."));
      },
      { once: true },
    );
  });
}

/**
 * Wraps any adapter with a per-attempt timeout and a bounded retry for
 * transient failures (timeouts, 429, 5xx, network). Provider SDK retries are
 * turned off, so this is the only retry policy and it is the same for every
 * adapter.
 */
export function withResilience(
  client: LlmClient,
  {
    timeoutMs,
    retries = 1,
    retryDelayMs = 500,
    sleep = defaultSleep,
  }: ResilienceOptions,
): LlmClient {
  async function attempt<T>(
    request: GenerateStructuredRequest<T>,
  ): Promise<GenerateStructuredResult<T>> {
    const deadline = AbortSignal.timeout(timeoutMs);
    const signal = request.signal
      ? AbortSignal.any([request.signal, deadline])
      : deadline;
    try {
      return await client.generateStructured({ ...request, signal });
    } catch (error) {
      if (request.signal?.aborted) {
        throw new LlmError("aborted", "The request was cancelled.", {
          cause: error,
        });
      }
      if (deadline.aborted) {
        throw new LlmError("timeout", `No answer within ${timeoutMs} ms.`, {
          cause: error,
        });
      }
      throw error;
    }
  }

  return {
    provider: client.provider,
    async generateStructured<T>(request: GenerateStructuredRequest<T>) {
      for (let failures = 0; ; failures++) {
        try {
          return await attempt(request);
        } catch (error) {
          if (!isLlmError(error) || !error.retryable || failures >= retries) {
            throw error;
          }
          await sleep(retryDelayMs, request.signal);
        }
      }
    },
  };
}
