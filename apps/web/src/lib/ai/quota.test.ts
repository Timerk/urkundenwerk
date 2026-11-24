import type { SupabaseClient } from "@supabase/supabase-js";
import {
  explainIssues,
  LlmError,
  withResilience,
  type LlmClient,
} from "@urkundenwerk/ai";
import type { Database } from "@urkundenwerk/core/db";
import { expect, it, vi } from "vitest";
import { paidAttemptGuard } from "./quota";

function mockClient() {
  const rpc = vi.fn();
  return { rpc, client: { rpc } as unknown as SupabaseClient<Database> };
}

it.each([
  ["user_limited", "user_quota"],
  ["budget_exhausted", "daily_budget"],
])(
  "maps a denied reservation (%s) to a provider-independent error",
  async (data, kind) => {
    const { rpc, client } = mockClient();
    rpc.mockResolvedValue({ data, error: null });
    await expect(paidAttemptGuard(client, "import")()).rejects.toMatchObject({
      kind,
    });
    expect(rpc).toHaveBeenCalledExactlyOnceWith("consume_ai_request", {
      kind: "import",
    });
  },
);

it.each([{ error: { code: "unavailable" } }, { data: "unknown_response" }])(
  "fails closed if the quota could not be checked (%j)",
  async (response) => {
    const { rpc, client } = mockClient();
    rpc.mockResolvedValue(response);
    await expect(paidAttemptGuard(client, "explain")()).rejects.toMatchObject({
      kind: "unavailable",
    });
  },
);

it("checks the caller's quota before each attempt and falls back to the rule summary when the retry is denied", async () => {
  const { rpc, client: supabase } = mockClient();
  rpc
    .mockResolvedValueOnce({ data: "allowed" })
    .mockResolvedValueOnce({ data: "budget_exhausted" });
  const generateStructured = vi.fn(async () => {
    throw new LlmError("unavailable", "Temporary provider outage");
  });
  const adapter: LlmClient = { provider: "openai", generateStructured };
  const client = withResilience(adapter, {
    timeoutMs: 1000,
    sleep: async () => {},
    beforeAttempt: paidAttemptGuard(supabase, "explain"),
  });
  const result = await explainIssues(
    [{ code: "gmbh_capital_minimum", params: { shareCapitalCents: 100 } }],
    {
      templateId: "musterprotokoll-einpersonen",
      locale: "en",
      client,
      model: "test",
    },
  );
  expect(rpc.mock.calls).toEqual([
    ["consume_ai_request", { kind: "explain" }],
    ["consume_ai_request", { kind: "explain" }],
  ]);
  expect(generateStructured).toHaveBeenCalledTimes(1);
  expect(result).toMatchObject({
    failure: "daily_budget",
    explanations: [{ source: "rule", suggestedFix: null }],
  });
});
