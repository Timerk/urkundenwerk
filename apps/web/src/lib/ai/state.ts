import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type AiConfig,
  type AiTask,
  createLlmClient,
  fakeExplanationResponder,
  parseAiConfig,
} from "@urkundenwerk/ai";
import type { Database } from "@urkundenwerk/core/db";
import { fakeExtractionResponder } from "@urkundenwerk/extraction";
import { paidAttemptGuard } from "./quota";

let config: AiConfig | null | undefined;

/** Reads settings once per server, at request time. */
export function configuredAi(): AiConfig | null {
  if (config === undefined) {
    try {
      config = parseAiConfig(process.env);
    } catch (error) {
      // The message names the variables but never their values.
      console.error(`[ai] ${(error as Error).message} AI features are off.`);
      config = null;
    }
  }
  return config;
}

export function createRequestClient(
  config: AiConfig,
  supabase: SupabaseClient<Database>,
  task: AiTask,
) {
  const extraction = task === "extract";
  return createLlmClient(config, {
    fakeResponder: extraction
      ? fakeExtractionResponder
      : fakeExplanationResponder,
    timeoutMs: extraction ? config.extractTimeoutMs : config.timeoutMs,
    beforePaidAttempt: paidAttemptGuard(
      supabase,
      extraction ? "import" : "explain",
    ),
  });
}
