import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { LlmError } from "@urkundenwerk/ai";
import type { Database } from "@urkundenwerk/core/db";

export const EXPLANATIONS_PER_MINUTE = 10;
export const EXTRACTIONS_PER_WINDOW = 6;
export const EXTRACTION_WINDOW_MINUTES = 10;

/** A provider attempt needs both quotas from the caller's authenticated session. */
export function paidAttemptGuard(
  supabase: SupabaseClient<Database>,
  kind: "explain" | "import",
) {
  return async () => {
    const { data, error } = await supabase.rpc("consume_ai_request", { kind });
    if (!error) {
      if (data === "allowed") return;
      if (data === "user_limited") {
        throw new LlmError(
          "user_quota",
          "The user's request limit was reached.",
        );
      }
      if (data === "budget_exhausted") {
        throw new LlmError(
          "daily_budget",
          "The demo has reached its daily AI limit.",
        );
      }
    }
    console.error(`[ai] request quota could not be checked (${kind})`);
    throw new LlmError(
      "unavailable",
      "The demo AI quota could not be checked.",
    );
  };
}
