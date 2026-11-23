import "server-only";
import {
  type AiConfig,
  type CachedExplanation,
  createLlmClient,
  type ExplainableIssue,
  explainIssues,
  type ExplanationResult,
  fakeExplanationResponder,
  type LlmClient,
  LruCache,
  parseAiConfig,
} from "@urkundenwerk/ai";
import { RateLimiter } from "./rate-limit";

/** Explanation requests per user and minute. */
export const EXPLANATIONS_PER_MINUTE = 10;

type AiState =
  { ok: true; config: AiConfig; client: LlmClient | null } | { ok: false };

let state: AiState | undefined;
const cache = new LruCache<CachedExplanation>(500);
const limiter = new RateLimiter(EXPLANATIONS_PER_MINUTE, 60_000);

// Read at request time, not at build time. Passing the whole `process.env`
// keeps Next.js from inlining values into the server bundle.
function aiState(): AiState {
  if (!state) {
    try {
      const config = parseAiConfig(process.env);
      state = {
        ok: true,
        config,
        client: createLlmClient(config, {
          fakeResponder: fakeExplanationResponder,
        }),
      };
    } catch (error) {
      // The message names the variables but never their values.
      console.error(`[ai] ${(error as Error).message} Explanations are off.`);
      state = { ok: false };
    }
  }
  return state;
}

/** Whether explanations can be requested on this server. */
export function isExplanationEnabled(): boolean {
  const current = aiState();
  return current.ok && current.client !== null;
}

/** Counts a request against the user's limit. */
export function takeExplanationQuota(userId: string): boolean {
  return limiter.take(userId);
}

/**
 * Explains rule issues with the configured model. Never throws for model
 * failures: entries fall back to the rule summary. Logs only the failure
 * kind, never prompts or answers.
 */
export async function explain(
  templateId: string,
  issues: readonly ExplainableIssue[],
): Promise<ExplanationResult> {
  const current = aiState();
  const client = current.ok ? current.client : null;
  const model = current.ok ? current.config.models.explain : "";
  const result = await explainIssues(issues, {
    templateId,
    client,
    model,
    cache,
  });
  if (result.failure) {
    console.warn(
      `[ai] explain fell back to rule summaries: ${result.failure} (model ${model}, prompt ${result.promptVersion})`,
    );
  }
  return result;
}
