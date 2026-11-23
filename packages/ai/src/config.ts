import { z } from "zod";
import { AnthropicLlmClient } from "./anthropic";
import { FakeLlmClient, type FakeResponder } from "./fake";
import { OpenAiLlmClient } from "./openai";
import type { LlmClient } from "./port";
import { withResilience } from "./resilience";

/**
 * Default models per provider and task. Explanations are short, frequent,
 * and latency-sensitive, so they use a small model. Extraction reads whole
 * documents and must quote its sources verbatim, so it uses a stronger one;
 * ADR-0009 records the OpenAI choice from the evaluation. Each model ID
 * can be overridden per environment.
 */
export const PROVIDER_MODELS = {
  anthropic: { explain: "claude-haiku-5-5", extract: "claude-opus-5-5" },
  openai: { explain: "gpt-6-luna", extract: "gpt-6.2-sol" },
} as const;

/** The defaults of the Anthropic provider, also used by the fake. */
export const DEFAULT_MODELS = PROVIDER_MODELS.anthropic;

export type AiTask = keyof typeof DEFAULT_MODELS;

// Empty values in .env files mean "not set".
const emptyAsUnset = (value: unknown) => (value === "" ? undefined : value);
const optionalText = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().trim().optional(),
);
const modelId = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? undefined : value,
  z
    .string()
    .regex(/^[a-z0-9][a-z0-9.-]*$/, { error: "must be a model id" })
    .optional(),
);

const aiEnvSchema = z
  .object({
    ANTHROPIC_API_KEY: optionalText,
    OPENAI_API_KEY: optionalText,
    AI_PROVIDER: z.preprocess(
      emptyAsUnset,
      z.enum(["anthropic", "openai", "fake", "disabled"]).optional(),
    ),
    AI_MODEL_EXPLAIN: modelId,
    AI_MODEL_EXTRACT: modelId,
    AI_TIMEOUT_MS: z.preprocess(
      emptyAsUnset,
      z.coerce.number().int().min(1_000).max(120_000).default(20_000),
    ),
    // Extraction reads a whole document and writes a long answer, so it gets
    // its own, longer deadline.
    AI_EXTRACT_TIMEOUT_MS: z.preprocess(
      emptyAsUnset,
      z.coerce.number().int().min(10_000).max(300_000).default(120_000),
    ),
  })
  .transform((env) => {
    // Without an explicit choice, a key turns its provider on; Anthropic
    // wins if both keys are set.
    const provider =
      env.AI_PROVIDER ??
      (env.ANTHROPIC_API_KEY
        ? "anthropic"
        : env.OPENAI_API_KEY
          ? "openai"
          : "disabled");
    const defaults =
      provider === "openai" ? PROVIDER_MODELS.openai : DEFAULT_MODELS;
    return {
      provider,
      apiKey:
        provider === "openai" ? env.OPENAI_API_KEY : env.ANTHROPIC_API_KEY,
      models: {
        explain: env.AI_MODEL_EXPLAIN ?? defaults.explain,
        extract: env.AI_MODEL_EXTRACT ?? defaults.extract,
      },
      timeoutMs: env.AI_TIMEOUT_MS,
      extractTimeoutMs: env.AI_EXTRACT_TIMEOUT_MS,
    };
  })
  .superRefine((config, context) => {
    const key = { anthropic: "ANTHROPIC_API_KEY", openai: "OPENAI_API_KEY" };
    if (
      (config.provider === "anthropic" || config.provider === "openai") &&
      !config.apiKey
    ) {
      context.addIssue({
        code: "custom",
        message: `is required when AI_PROVIDER is ${config.provider}`,
        path: [key[config.provider]],
      });
    }
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
 * `timeoutMs` overrides the default deadline per attempt, for example with
 * `config.extractTimeoutMs`.
 */
export function createLlmClient(
  config: AiConfig,
  {
    fakeResponder,
    timeoutMs = config.timeoutMs,
  }: { fakeResponder: FakeResponder; timeoutMs?: number },
): LlmClient | null {
  switch (config.provider) {
    case "disabled":
      return null;
    case "fake":
      return withResilience(new FakeLlmClient(fakeResponder), { timeoutMs });
    case "anthropic":
      return withResilience(AnthropicLlmClient.fromApiKey(config.apiKey!), {
        timeoutMs,
      });
    case "openai":
      return withResilience(OpenAiLlmClient.fromApiKey(config.apiKey!), {
        timeoutMs,
      });
  }
}
