import OpenAI from "openai";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { LlmError } from "./errors";
import {
  OpenAiLlmClient,
  type OpenAiResponses,
  toOpenAiLlmError,
} from "./openai";
import type { GenerateStructuredRequest } from "./port";

// The SDK client is replaced by a mock: no test reaches the network.

const schema = z.object({ answer: z.string() });

const request: GenerateStructuredRequest<z.infer<typeof schema>> = {
  task: "extract",
  system: "System prompt",
  user: "User prompt",
  schema,
  model: "gpt-6.2-sol",
  maxOutputTokens: 16_000,
  effort: "medium",
  cacheSystemPrompt: true,
};

function response(
  overrides: Partial<OpenAI.Responses.Response> & { output_text?: string } = {},
): OpenAI.Responses.Response {
  return {
    id: "resp_test",
    object: "response",
    model: "gpt-6.2-sol-2026-10-01",
    status: "completed",
    output: [
      {
        type: "message",
        id: "msg_test",
        role: "assistant",
        status: "completed",
        content: [
          { type: "output_text", text: '{"answer":"42"}', annotations: [] },
        ],
      },
    ],
    output_text: '{"answer":"42"}',
    usage: {
      input_tokens: 2_000,
      input_tokens_details: { cached_tokens: 1_500 },
      output_tokens: 900,
      output_tokens_details: { reasoning_tokens: 700 },
      total_tokens: 2_900,
    },
    ...overrides,
  } as OpenAI.Responses.Response;
}

function clientReturning(result: OpenAI.Responses.Response | Error) {
  const create = vi.fn(async () => {
    if (result instanceof Error) throw result;
    return result;
  });
  const client = new OpenAiLlmClient({
    create,
  } as unknown as OpenAiResponses);
  return { client, create };
}

describe("OpenAiLlmClient", () => {
  it("sends a strict structured-output request and validates the answer", async () => {
    const { client, create } = clientReturning(response());
    const signal = new AbortController().signal;

    const result = await client.generateStructured({ ...request, signal });

    expect(result).toEqual({
      data: { answer: "42" },
      model: "gpt-6.2-sol-2026-10-01",
      // Cached tokens are part of OpenAI's input_tokens; the port separates them.
      usage: {
        inputTokens: 500,
        outputTokens: 900,
        cacheCreationInputTokens: 0,
        cacheReadInputTokens: 1_500,
      },
      stopReason: "completed",
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-6.2-sol",
        instructions: "System prompt",
        input: "User prompt",
        max_output_tokens: 16_000,
        store: false,
        reasoning: { effort: "medium" },
        prompt_cache_key: "urkundenwerk-extract",
        text: {
          format: expect.objectContaining({
            type: "json_schema",
            name: "answer",
            strict: true,
            schema: expect.objectContaining({
              type: "object",
              additionalProperties: false,
              required: ["answer"],
            }),
          }),
        },
      }),
      { signal, maxRetries: 0 },
    );
  });

  it("leaves out optional settings that were not asked for", async () => {
    const { client, create } = clientReturning(response());
    await client.generateStructured({
      ...request,
      effort: undefined,
      cacheSystemPrompt: undefined,
    });
    const body = (
      create.mock.calls as unknown as [Record<string, unknown>][]
    )[0]![0];
    expect(body).not.toHaveProperty("reasoning");
    expect(body).not.toHaveProperty("prompt_cache_key");
  });

  it.each([
    [
      {
        status: "incomplete",
        incomplete_details: { reason: "max_output_tokens" },
      },
      "truncated",
    ],
    [
      {
        status: "incomplete",
        incomplete_details: { reason: "content_filter" },
      },
      "refused",
    ],
    [
      {
        output: [
          {
            type: "message",
            id: "msg",
            role: "assistant",
            status: "completed",
            content: [{ type: "refusal", refusal: "I can't help with that." }],
          },
        ],
        output_text: "",
      },
      "refused",
    ],
    [{ status: "failed" }, "unavailable"],
    [{ output_text: "Sure! Here you go." }, "invalid_output"],
    [{ output_text: '{"answer":42}' }, "invalid_output"],
  ] as const)("maps %j to %s", async (overrides, kind) => {
    const { client } = clientReturning(
      response(overrides as Partial<OpenAI.Responses.Response>),
    );
    await expect(client.generateStructured(request)).rejects.toMatchObject({
      kind,
    });
  });

  it("maps SDK errors to typed errors", async () => {
    const { client } = clientReturning(
      OpenAI.APIError.generate(
        429,
        { error: { type: "rate_limit_exceeded" } },
        "rate limited",
        new Headers(),
      ),
    );
    const error = await client.generateStructured(request).catch((e) => e);
    expect(error).toBeInstanceOf(LlmError);
    expect(error).toMatchObject({ kind: "rate_limited", retryable: true });
  });
});

describe("toOpenAiLlmError", () => {
  const status = (code: number) =>
    OpenAI.APIError.generate(code, undefined, "failed", new Headers());

  it.each([
    [status(400), "rejected", false],
    [status(401), "unauthorized", false],
    [status(403), "unauthorized", false],
    [status(404), "rejected", false],
    [status(429), "rate_limited", true],
    [status(500), "unavailable", true],
    [status(503), "unavailable", true],
    [new OpenAI.APIConnectionError({ message: "reset" }), "unavailable", true],
    [new OpenAI.APIConnectionTimeoutError(), "timeout", true],
    [new OpenAI.APIUserAbortError(), "aborted", false],
    [new Error("anything else"), "unavailable", true],
  ])("maps %s to %s", (error, kind, retryable) => {
    expect(toOpenAiLlmError(error)).toMatchObject({ kind, retryable });
  });

  it("keeps the key and prompts out of messages", () => {
    expect(toOpenAiLlmError(status(401)).message).toBe(
      "The API key was not accepted.",
    );
  });
});
