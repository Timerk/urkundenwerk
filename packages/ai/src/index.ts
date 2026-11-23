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
export type {
  GenerateStructuredRequest,
  GenerateStructuredResult,
  LlmClient,
  LlmUsage,
} from "./port";
export { withResilience, type ResilienceOptions } from "./resilience";
