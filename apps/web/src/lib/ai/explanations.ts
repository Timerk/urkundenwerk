import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type CachedExplanation,
  type ExplainableIssue,
  explainIssues,
  type ExplanationLocale,
  type ExplanationResult,
  LruCache,
} from "@urkundenwerk/ai";
import type { Database } from "@urkundenwerk/core/db";
import { configuredAi, createRequestClient } from "./state";

const cache = new LruCache<CachedExplanation>(500);

/** Whether explanations can be requested on this server. */
export function isExplanationEnabled(): boolean {
  const config = configuredAi();
  return config !== null && config.provider !== "disabled";
}

/**
 * Explains rule issues with the configured model, in the UI language of the
 * request. Never throws for model
 * failures: entries fall back to the rule summary. Logs only the failure
 * kind, never prompts or answers.
 */
export async function explain(
  supabase: SupabaseClient<Database>,
  templateId: string,
  issues: readonly ExplainableIssue[],
  locale: ExplanationLocale,
): Promise<ExplanationResult> {
  const config = configuredAi();
  const client = config
    ? createRequestClient(config, supabase, "explain")
    : null;
  const model = config?.models.explain ?? "";
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
