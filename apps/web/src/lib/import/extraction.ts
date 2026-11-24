import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@urkundenwerk/core/db";
import {
  extractDraftFields,
  type ExtractionReview,
  type SourceDocument,
} from "@urkundenwerk/extraction";
import { configuredAi, createRequestClient } from "../ai/state";

/** Whether this server can extract contract data with an LLM. */
export function isExtractionEnabled(): boolean {
  const config = configuredAi();
  return config !== null && config.provider !== "disabled";
}

/**
 * Extracts draft fields from an ingested document with the configured
 * model. Throws an `ExtractionError` on failure. Logs only the failure kind,
 * never document text, prompts, or answers.
 */
export async function extract(
  supabase: SupabaseClient<Database>,
  doc: SourceDocument,
): Promise<ExtractionReview> {
  const config = configuredAi();
  const client = config
    ? createRequestClient(config, supabase, "extract")
    : null;
  if (!config || !client) {
    throw new Error("AI extraction is not configured.");
  }
  const model = config.models.extract;
  try {
    return await extractDraftFields(doc, {
      client,
      model,
    });
  } catch (error) {
    const code = (error as { code?: unknown }).code;
    console.warn(
      `[ai] extract failed: ${typeof code === "string" ? code : "unknown"} (model ${model})`,
    );
    throw error;
  }
}
