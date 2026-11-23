import "server-only";
import {
  type CachedExplanation,
  type ExplainableIssue,
  explainIssues,
  type ExplanationLocale,
  type ExplanationResult,
  LruCache,
} from "@urkundenwerk/ai";
import { RateLimiter } from "./rate-limit";
import { aiState } from "./state";

/** Explanation requests per user and minute. */
export const EXPLANATIONS_PER_MINUTE = 10;

const cache = new LruCache<CachedExplanation>(500);
const limiter = new RateLimiter(EXPLANATIONS_PER_MINUTE, 60_000);

/** Whether explanations can be requested on this server. */
export function isExplanationEnabled(): boolean {
  const current = aiState();
  return current.ok && current.explainClient !== null;
}

/** Counts a request against the user's limit. */
export function takeExplanationQuota(userId: string): boolean {
  return limiter.take(userId);
}

/**
 * Explains rule issues with the configured model, in the UI language of the
 * request. Never throws for model
 * failures: entries fall back to the rule summary. Logs only the failure
 * kind, never prompts or answers.
 */
export async function explain(
  templateId: string,
  issues: readonly ExplainableIssue[],
  locale: ExplanationLocale,
): Promise<ExplanationResult> {
  const current = aiState();
  const client = current.ok ? current.explainClient : null;
  const model = current.ok ? current.config.models.explain : "";
  const result = await explainIssues(issues, {
    templateId,
    locale,
    client,
    model,
    cache,
  });
  if (result.failure) {
    console.warn(
      `[ai] explain fell back to rule summaries: ${result.failure} (model ${model}, prompt ${result.promptVersion}, ${locale})`,
    );
  }
  return result;
}
