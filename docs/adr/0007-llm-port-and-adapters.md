# ADR-0007 · LLM port, adapters, and data minimisation

## Context

M3 adds plain-English explanations of rule issues. M4 will extract
structured data from documents with source citations. Both call an LLM, and
ADR-0002 limits what an LLM may do: it may explain results and extract data,
but it never decides validity and never writes legal text. The demo is
public, runs on the maintainer's key, and must work without any key. Tests
must never call a paid API. Drafts contain personal data of fictional
founders, but the real product would hold real personal data, so the design
has to follow GDPR data minimisation from the start.

## Decision

**A port with adapters.** A new server-only package, `@urkundenwerk/ai`,
defines one provider-agnostic port:

```ts
interface LlmClient {
  generateStructured<T>(request: {
    task: string; // non-personal label, e.g. "explain"
    system: string;
    user: string;
    schema: ZodType<T>;
    model: string;
    maxOutputTokens: number;
    effort?: "low" | "medium" | "high";
    signal?: AbortSignal;
  }): Promise<{ data: T; model: string; usage: LlmUsage; stopReason: string }>;
}
```

Features own their prompts, schemas, and post-validation. The port only
returns data that matched the schema, or throws an `LlmError` with a kind:
`timeout`, `rate_limited`, `unavailable`, `unauthorized`, `rejected`,
`refused`, `truncated`, `invalid_output`, or `aborted`.

- **Anthropic adapter.** It uses the official `@anthropic-ai/sdk` with
  structured outputs (`output_config.format` from the Zod schema), so
  decoding is constrained to the schema. It still parses and validates the
  text with Zod, and maps refusals, truncation, and SDK errors to kinds.
- **OpenAI adapter.** It uses the official `openai` SDK and the Responses
  API with a strict JSON schema (`text.format`). It parses and validates
  the response with Zod and maps errors to the same kinds. It sets
  `store: false` to disable storage of the response for later API retrieval.
  Provider retention is covered by [OpenAI's data controls][openai-data].
- **Fake adapter.** `FakeLlmClient` answers from a script. It can return
  invalid output, refusals, errors, and hangs, and it records requests so
  tests can assert what would have been sent. `AI_PROVIDER=fake` uses it in
  end-to-end tests and in local development without a key.
- **Resilience.** `withResilience` wraps any adapter with a per-attempt
  timeout and one retry for transient kinds (timeouts, 429, 5xx, network).
  SDK retries are off, so this is the only retry policy.

**Configuration.** `parseAiConfig` validates `AI_PROVIDER`
(`anthropic`, `openai`, `fake`, or `disabled`), the provider keys
(`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`), per-task model IDs
(`AI_MODEL_EXPLAIN`, `AI_MODEL_EXTRACT`), and the per-task timeouts with Zod.
Both features use the selected provider. Without an explicit choice,
Anthropic takes precedence when both keys are set, a single key selects its
provider, and no key disables AI. Error messages name variables without
echoing values. Local keys live in `apps/web/.env.local`, which Git ignores.

**Models.** Explanations default to `claude-haiku-5-5` with Anthropic and
`gpt-6-luna` with OpenAI, both at low effort. Explanations are short and
latency-sensitive. Extraction reads longer documents and must quote its
sources accurately. ADR-0009 records the extraction defaults. Both model
IDs are configurable.

**Data minimisation by construction.** The explanation payload is built from
the rule registry, not from the draft: rule code, severity, legal reference,
rule summary, and the issue's params. The core types allow only numbers and
booleans in params, and the server action and the payload builder validate
that again. Names, dates of birth, addresses, the Firma, and free text have
no field to travel in, and a test asserts that none of them appears in the
request. The client sends only codes and params; legal references and
summaries come from the server's registry, so the prompt cannot be injected.

**Explanations never decide.** The system prompt says the rule is
authoritative. Answers are validated per entry: unknown or repeated codes are
dropped, and explanations over three sentences or overlong fixes are
rejected. Any failure falls back to the rule's deterministic summary, so the
user always gets an answer. Results carry the model and a `PROMPT_VERSION`.
Answers are cached by code, params, model, and prompt version.

**Abuse and logging.** The server action requires a signed-in member of the
document's firm (row-level security loads the document) and allows ten
requests per user and minute. Logs record only failure kinds, never prompts,
answers, or keys.

## Consequences

M4 reuses the port, the adapters, the resilience wrapper, the configuration,
and the fake. It adds an extraction feature with its own prompt, output
schema with source spans, prompt version, and evaluation set, using
`AI_MODEL_EXTRACT`. Extraction sends document text, so it will need its own
data protection review. The explanation payload rules do not carry over.

Another provider needs only a new adapter. The in-memory cache is per server
instance. The quotas and the paid budget are shared across instances as
described in [ADR-0013](0013-hosted-public-demo.md). Explanations of
issues with the same code but different params share one model answer per
request; the second falls back to the summary.

[openai-data]: https://developers.openai.com/api/docs/guides/your-data
