import { z } from "zod";
import { AnthropicLlmClient } from "./anthropic";
import { FakeLlmClient, type FakeResponder } from "./fake";
import type { LlmClient } from "./port";
import { withResilience } from "./resilience";

/**
 * Default models per task. Explanations are short, high-volume, and
 * latency-sensitive, so they use the current Haiku. Extraction (M4) reads
 * long documents and must cite sources accurately, so it uses the current
 * Opus. Both can be overridden per environment.
 */
export const DEFAULT_MODELS = {
  explain: "claude-haiku-5-5",
  extract: "claude-opus-5-5",
} as const;

export type AiTask = keyof typeof DEFAULT_MODELS;

// Empty values in .env files mean "not set".
const optionalText = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().trim().optional(),
);
const modelId = (fallback: string) =>
  z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? undefined : value,
    z
      .string()
      .regex(/^[a-z0-9][a-z0-9.-]*$/, { error: "must be a model id" })
      .default(fallback),
  );

const aiEnvSchema = z
  .object({
    ANTHROPIC_API_KEY: optionalText,
    AI_PROVIDER: z.preprocess(
      (value) => (value === "" ? undefined : value),
      z.enum(["anthropic", "fake", "disabled"]).optional(),
    ),
    AI_MODEL_EXPLAIN: modelId(DEFAULT_MODELS.explain),
    AI_MODEL_EXTRACT: modelId(DEFAULT_MODELS.extract),
    AI_TIMEOUT_MS: z.preprocess(
      (value) => (value === "" ? undefined : value),
      z.coerce.number().int().min(1_000).max(120_000).default(20_000),
    ),
  })
  .transform((env) => ({
    // Without an explicit choice, a key turns the real provider on.
    provider:
      env.AI_PROVIDER ?? (env.ANTHROPIC_API_KEY ? "anthropic" : "disabled"),
    apiKey: env.ANTHROPIC_API_KEY,
    models: { explain: env.AI_MODEL_EXPLAIN, extract: env.AI_MODEL_EXTRACT },
    timeoutMs: env.AI_TIMEOUT_MS,
  }))
  .refine((config) => config.provider !== "anthropic" || config.apiKey, {
    error: "is required when AI_PROVIDER is anthropic",
    path: ["ANTHROPIC_API_KEY"],
  });

export type AiConfig = z.output<typeof aiEnvSchema>;
export type AiProvider = AiConfig["provider"];

/**
 * Validates the AI settings from the environment. Errors name the variables
 * but never echo their values, so a key cannot end up in a log.
 */
export function parseAiConfig(
  env: Record<string, string | undefined>,
): AiConfig {
  const result = aiEnvSchema.safeParse(env);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `${issue.path.join(".")} ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid AI configuration: ${problems}. See .env.example.`);
  }
  return result.data;
}

/**
 * Creates the configured client, wrapped with the timeout and retry policy,
 * or `null` when AI is disabled. The fake answers with `fakeResponder`.
 */
export function createLlmClient(
  config: AiConfig,
  { fakeResponder }: { fakeResponder: FakeResponder },
): LlmClient | null {
  switch (config.provider) {
    case "disabled":
      return null;
    case "fake":
      return withResilience(new FakeLlmClient(fakeResponder), {
        timeoutMs: config.timeoutMs,
      });
    case "anthropic":
      return withResilience(AnthropicLlmClient.fromApiKey(config.apiKey!), {
        timeoutMs: config.timeoutMs,
      });
  }
}
