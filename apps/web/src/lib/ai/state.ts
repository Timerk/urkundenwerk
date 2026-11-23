import "server-only";
import {
  type AiConfig,
  createLlmClient,
  fakeExplanationResponder,
  type LlmClient,
  parseAiConfig,
} from "@urkundenwerk/ai";
import { fakeExtractionResponder } from "@urkundenwerk/extraction";

/** The AI settings and one client per feature, or `ok: false` if misconfigured. */
export type AiState =
  | {
      ok: true;
      config: AiConfig;
      explainClient: LlmClient | null;
      extractClient: LlmClient | null;
    }
  | { ok: false };

let state: AiState | undefined;

/**
 * Reads the AI settings at request time, not at build time, once per server.
 * Passing the whole `process.env` keeps Next.js from inlining values into
 * the server bundle. Each feature gets its own client, because the scripted
 * fake answers per feature and extraction needs a longer deadline.
 */
export function aiState(): AiState {
  if (!state) {
    try {
      const config = parseAiConfig(process.env);
      state = {
        ok: true,
        config,
        explainClient: createLlmClient(config, {
          fakeResponder: fakeExplanationResponder,
        }),
        extractClient: createLlmClient(config, {
          fakeResponder: fakeExtractionResponder,
          timeoutMs: config.extractTimeoutMs,
        }),
      };
    } catch (error) {
      // The message names the variables but never their values.
      console.error(`[ai] ${(error as Error).message} AI features are off.`);
      state = { ok: false };
    }
  }
  return state;
}
