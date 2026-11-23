import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { FakeLlmClient, type FakeResponse } from "./fake";
import { withResilience } from "./resilience";

const request = {
  task: "test",
  system: "s",
  user: "u",
  schema: z.object({ ok: z.boolean() }),
  model: "fake-model",
  maxOutputTokens: 100,
};
const ok: FakeResponse = { kind: "output", output: { ok: true } };

function resilient(responses: FakeResponse[], timeoutMs = 1_000) {
  const fake = FakeLlmClient.scripted(responses);
  const sleep = vi.fn(async () => {});
  return { fake, sleep, client: withResilience(fake, { timeoutMs, sleep }) };
}

describe("withResilience", () => {
  it("retries a transient failure once", async () => {
    const { client, fake, sleep } = resilient([
      { kind: "error", error: "unavailable" },
      ok,
    ]);

    await expect(client.generateStructured(request)).resolves.toMatchObject({
      data: { ok: true },
    });
    expect(fake.requests).toHaveLength(2);
    expect(sleep).toHaveBeenCalledOnce();
  });

  it("gives up after the second transient failure", async () => {
    const { client, fake } = resilient([
      { kind: "error", error: "rate_limited" },
      { kind: "error", error: "rate_limited" },
      ok,
    ]);

    await expect(client.generateStructured(request)).rejects.toMatchObject({
      kind: "rate_limited",
    });
    expect(fake.requests).toHaveLength(2);
  });

  it.each(["invalid_output", "refused", "unauthorized", "rejected"] as const)(
    "does not retry %s",
    async (error) => {
      const { client, fake } = resilient([{ kind: "error", error }, ok]);
      await expect(client.generateStructured(request)).rejects.toMatchObject({
        kind: error,
      });
      expect(fake.requests).toHaveLength(1);
    },
  );

  it("times out a hanging attempt and retries it once", async () => {
    const { client, fake } = resilient(
      [{ kind: "hang" }, { kind: "hang" }],
      20,
    );

    await expect(client.generateStructured(request)).rejects.toMatchObject({
      kind: "timeout",
    });
    expect(fake.requests).toHaveLength(2);
  });

  it("reports a cancelled request without retrying", async () => {
    const { client, fake } = resilient([{ kind: "hang" }, ok]);
    const controller = new AbortController();

    const pending = client.generateStructured({
      ...request,
      signal: controller.signal,
    });
    controller.abort();

    await expect(pending).rejects.toMatchObject({ kind: "aborted" });
    expect(fake.requests).toHaveLength(1);
  });
});
