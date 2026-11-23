// Server-only: this package reads API keys and calls paid APIs. Import it
// from server code only, such as route handlers and server actions.
export {
  AnthropicLlmClient,
  toLlmError,
  type AnthropicMessages,
} from "./anthropic";
export {
  createLlmClient,
  DEFAULT_MODELS,
  parseAiConfig,
  PROVIDER_MODELS,
  type AiConfig,
  type AiProvider,
  type AiTask,
} from "./config";
export { isLlmError, LlmError, type LlmErrorKind } from "./errors";
export {
  FAKE_MODEL,
  FakeLlmClient,
  type FakeResponder,
  type FakeResponse,
} from "./fake";
export { LruCache } from "./lru";
export {
  OpenAiLlmClient,
  toOpenAiLlmError,
  type OpenAiResponses,
} from "./openai";
export type {
  GenerateStructuredRequest,
  GenerateStructuredResult,
  LlmClient,
  LlmUsage,
} from "./port";
export { withResilience, type ResilienceOptions } from "./resilience";
export {
  explainableIssueSchema,
  issueKey,
  issueParamsSchema,
  toExplanationItems,
  type ExplainableIssue,
  type ExplanationItem,
} from "./explain/payload";
export { PROMPT_VERSION, SYSTEM_PROMPT } from "./explain/prompt";
export {
  explainIssues,
  explanationCacheKey,
  explanationOutputSchema,
  fakeExplanationResponder,
  sentenceCount,
  type CachedExplanation,
  type ExplainOptions,
  type Explanation,
  type ExplanationCache,
  type ExplanationResult,
} from "./explain/service";
