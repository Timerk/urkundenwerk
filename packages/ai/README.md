# AI layer

`@urkundenwerk/ai` is the server-only boundary to LLMs
([ADR-0007](../../docs/adr/0007-llm-port-and-adapters.md)). Import it only
from server code: it reads API keys and calls paid APIs.

```ts
import {
  createLlmClient,
  explainIssues,
  fakeExplanationResponder,
  parseAiConfig,
} from "@urkundenwerk/ai";

const config = parseAiConfig(process.env);
const client = createLlmClient(config, {
  fakeResponder: fakeExplanationResponder,
}); // null when AI is disabled
const result = await explainIssues(issues, {
  templateId: "musterprotokoll-einpersonen",
  client,
  model: config.models.explain,
});
```

- `LlmClient.generateStructured` is the port. It returns data validated
  against a Zod schema, or throws an `LlmError` with a `kind`.
- `AnthropicLlmClient` uses the official SDK with structured outputs.
  `FakeLlmClient` answers from a script and never touches the network.
  `withResilience` adds a timeout per attempt and one retry for transient
  failures.
- `cacheSystemPrompt` marks a stable system prompt for the provider's prompt
  cache, and `LlmUsage` reports cache writes and reads, so callers can
  estimate cost.
- `explainIssues` sends only rule codes, legal references, rule summaries,
  and numeric or boolean params. It validates each answer and falls back to
  the rule summary on any failure. Results carry the model and
  `PROMPT_VERSION`.

| Variable                | Default                                 |
| ----------------------- | --------------------------------------- |
| `AI_PROVIDER`           | `anthropic` with a key, else `disabled` |
| `ANTHROPIC_API_KEY`     | unset                                   |
| `AI_MODEL_EXPLAIN`      | `claude-haiku-5-5`                      |
| `AI_MODEL_EXTRACT`      | `claude-opus-5-5`                       |
| `AI_TIMEOUT_MS`         | `20000`                                 |
| `AI_EXTRACT_TIMEOUT_MS` | `120000`                                |

Contract extraction uses this port but lives in
[`@urkundenwerk/extraction`](../extraction/README.md), next to ingestion and
the citation checks it depends on. Its client is created with
`timeoutMs: config.extractTimeoutMs`.

Tests mock the SDK client or use the fake. No test calls a paid API.
