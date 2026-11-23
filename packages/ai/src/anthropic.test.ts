import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  AnthropicLlmClient,
  type AnthropicMessages,
  toLlmError,
} from "./anthropic";
import { LlmError } from "./errors";
import type { GenerateStructuredRequest } from "./port";

// The SDK client is replaced by a mock: no test reaches the network.

const schema = z.object({ answer: z.string() });

const request: GenerateStructuredRequest<z.infer<typeof schema>> = {
  task: "test",
  system: "System prompt",
  user: "User prompt",
  schema,
  model: "claude-haiku-5-5",
  maxOutputTokens: 1_000,
  effort: "low",
};

function message(
  overrides: Partial<Anthropic.Message> = {},
): Anthropic.Message {
  return {
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: "claude-haiku-5-5",
    content: [
      { type: "thinking", thinking: "", signature: "sig" },
      { type: "text", text: '{"answer":"42"}', citations: null },
    ],
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: {
      input_tokens: 120,
      output_tokens: 30,
      cache_creation_input_tokens: null,
      cache_read_input_tokens: null,
    },
    ...overrides,
  } as Anthropic.Message;
}

function clientReturning(result: Anthropic.Message | Error) {
  const create = vi.fn(async () => {
    if (result instanceof Error) throw result;
    return result;
  });
  const client = new AnthropicLlmClient({
    create,
  } as unknown as AnthropicMessages);
  return { client, create };
}

describe("AnthropicLlmClient", () => {
  it("sends a structured-output request and validates the answer", async () => {
    const { client, create } = clientReturning(message());
    const signal = new AbortController().signal;

    const result = await client.generateStructured({ ...request, signal });

    expect(result).toEqual({
      data: { answer: "42" },
      model: "claude-haiku-5-5",
      usage: {
        inputTokens: 120,
        outputTokens: 30,
        cacheCreationInputTokens: 0,
        cacheReadInputTokens: 0,
      },
      stopReason: "end_turn",
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "claude-haiku-5-5",
        max_tokens: 1_000,
        system: "System prompt",
        messages: [{ role: "user", content: "User prompt" }],
        output_config: {
          effort: "low",
          format: expect.objectContaining({
            type: "json_schema",
            schema: expect.objectContaining({ type: "object" }),
          }),
        },
      }),
      { signal, maxRetries: 0 },
    );
  });

  it("marks a stable system prompt as cacheable and reports cache usage", async () => {
    const { client, create } = clientReturning(
      message({
        usage: {
          input_tokens: 40,
          output_tokens: 30,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 1_800,
        } as Anthropic.Usage,
      }),
    );

    const result = await client.generateStructured({
      ...request,
      cacheSystemPrompt: true,
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        system: [
          {
            type: "text",
            text: "System prompt",
            cache_control: { type: "ephemeral" },
          },
        ],
      }),
      expect.anything(),
    );
    expect(result.usage).toMatchObject({
      inputTokens: 40,
      cacheReadInputTokens: 1_800,
    });
  });

  it.each([
    ["refusal", "refused"],
    ["max_tokens", "truncated"],
  ] as const)("maps the stop reason %s to %s", async (stopReason, kind) => {
    const { client } = clientReturning(message({ stop_reason: stopReason }));
    await expect(client.generateStructured(request)).rejects.toMatchObject({
      kind,
    });
  });

  it.each([
    ["text that is not JSON", "Sure! Here you go."],
    ["JSON that does not match the schema", '{"answer":42}'],
  ])("rejects %s", async (_name, text) => {
    const { client } = clientReturning(
      message({ content: [{ type: "text", text, citations: null }] }),
    );
    await expect(client.generateStructured(request)).rejects.toMatchObject({
      kind: "invalid_output",
    });
  });

  it("maps SDK errors to typed errors", async () => {
    const { client } = clientReturning(
      Anthropic.APIError.generate(
        429,
        { type: "error", error: { type: "rate_limit_error" } },
        "rate limited",
        new Headers(),
      ),
    );
    const error = await client.generateStructured(request).catch((e) => e);
    expect(error).toBeInstanceOf(LlmError);
    expect(error).toMatchObject({ kind: "rate_limited", retryable: true });
  });
});

describe("toLlmError", () => {
  const status = (code: number) =>
    Anthropic.APIError.generate(code, undefined, "failed", new Headers());

  it.each([
    [status(400), "rejected", false],
    [status(401), "unauthorized", false],
    [status(403), "unauthorized", false],
    [status(404), "rejected", false],
    [status(429), "rate_limited", true],
    [status(500), "unavailable", true],
    [status(529), "unavailable", true],
    [
      new Anthropic.APIConnectionError({ message: "reset" }),
      "unavailable",
      true,
    ],
    [new Anthropic.APIConnectionTimeoutError(), "timeout", true],
    [new Anthropic.APIUserAbortError(), "aborted", false],
    [new Error("anything else"), "unavailable", true],
  ])("maps %s to %s", (error, kind, retryable) => {
    expect(toLlmError(error)).toMatchObject({ kind, retryable });
  });

  it("keeps the key and prompts out of messages", () => {
    const error = toLlmError(status(401));
    expect(error.message).toBe("The API key was not accepted.");
  });
});
