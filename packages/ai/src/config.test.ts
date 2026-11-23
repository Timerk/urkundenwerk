import { describe, expect, it } from "vitest";
import { createLlmClient, DEFAULT_MODELS, parseAiConfig } from "./config";
import type { FakeResponder } from "./fake";

const fakeResponder: FakeResponder = () => ({
  kind: "output",
  output: {},
});
const options = { fakeResponder };

describe("parseAiConfig", () => {
  it("is disabled without a key or a provider", () => {
    expect(parseAiConfig({})).toEqual({
      provider: "disabled",
      apiKey: undefined,
      models: DEFAULT_MODELS,
      timeoutMs: 20_000,
      extractTimeoutMs: 120_000,
    });
  });

  it("treats empty values as unset", () => {
    expect(
      parseAiConfig({
        ANTHROPIC_API_KEY: "",
        AI_PROVIDER: "",
        AI_MODEL_EXPLAIN: " ",
        AI_TIMEOUT_MS: "",
      }).provider,
    ).toBe("disabled");
  });

  it("turns Anthropic on when a key is present", () => {
    const config = parseAiConfig({ ANTHROPIC_API_KEY: "test-key" });
    expect(config).toMatchObject({ provider: "anthropic", apiKey: "test-key" });
  });

  it("lets an explicit provider win over the key", () => {
    expect(
      parseAiConfig({ ANTHROPIC_API_KEY: "test-key", AI_PROVIDER: "fake" })
        .provider,
    ).toBe("fake");
  });

  it("reads model ids and the timeout", () => {
    expect(
      parseAiConfig({
        AI_PROVIDER: "fake",
        AI_MODEL_EXPLAIN: "claude-sonnet-5-5",
        AI_TIMEOUT_MS: "5000",
        AI_EXTRACT_TIMEOUT_MS: "180000",
      }),
    ).toMatchObject({
      models: { explain: "claude-sonnet-5-5", extract: DEFAULT_MODELS.extract },
      timeoutMs: 5_000,
      extractTimeoutMs: 180_000,
    });
  });

  it.each([
    [{ AI_PROVIDER: "anthropic" }, "ANTHROPIC_API_KEY"],
    [{ AI_PROVIDER: "openai" }, "AI_PROVIDER"],
    [{ AI_MODEL_EXPLAIN: "Claude Haiku" }, "AI_MODEL_EXPLAIN"],
    [{ AI_TIMEOUT_MS: "10" }, "AI_TIMEOUT_MS"],
    [{ AI_EXTRACT_TIMEOUT_MS: "999999" }, "AI_EXTRACT_TIMEOUT_MS"],
  ])("rejects %j and names %s", (env, variable) => {
    expect(() => parseAiConfig(env)).toThrow(variable);
  });

  it("never echoes the key", () => {
    const secret = "sk-test-should-not-appear";
    expect(() =>
      parseAiConfig({ ANTHROPIC_API_KEY: secret, AI_TIMEOUT_MS: "x" }),
    ).toThrow(
      expect.objectContaining({ message: expect.not.stringContaining(secret) }),
    );
  });
});

describe("createLlmClient", () => {
  it("returns no client when AI is disabled", () => {
    expect(createLlmClient(parseAiConfig({}), options)).toBeNull();
  });

  it.each([
    [{ AI_PROVIDER: "fake" }, "fake"],
    [{ ANTHROPIC_API_KEY: "test-key" }, "anthropic"],
  ])("creates the %j client", (env, provider) => {
    expect(createLlmClient(parseAiConfig(env), options)?.provider).toBe(
      provider,
    );
  });
});
