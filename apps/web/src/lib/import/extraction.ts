import "server-only";
import {
  extractDraftFields,
  type ExtractionReview,
  type SourceDocument,
} from "@urkundenwerk/extraction";
import { RateLimiter } from "../ai/rate-limit";
import { aiState } from "../ai/state";

/** Extractions per user within `EXTRACTION_WINDOW_MS`. */
export const EXTRACTIONS_PER_WINDOW = 6;
export const EXTRACTION_WINDOW_MS = 10 * 60_000;

const limiter = new RateLimiter(EXTRACTIONS_PER_WINDOW, EXTRACTION_WINDOW_MS);

/** Whether this server can extract contract data with an LLM. */
export function isExtractionEnabled(): boolean {
  const current = aiState();
  return current.ok && current.extractClient !== null;
}

/** Counts an extraction against the user's limit. */
export function takeExtractionQuota(userId: string): boolean {
  return limiter.take(userId);
}

/**
 * Extracts draft fields from an ingested document with the configured
 * model. Throws an `ExtractionError` on failure. Logs only the failure kind,
 * never document text, prompts, or answers.
 */
export async function extract(doc: SourceDocument): Promise<ExtractionReview> {
  const current = aiState();
  if (!current.ok || !current.extractClient) {
    throw new Error("AI extraction is not configured.");
  }
  const model = current.config.models.extract;
  try {
    return await extractDraftFields(doc, {
      client: current.extractClient,
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
