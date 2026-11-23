import { describe, expect, it } from "vitest";
import { eurAmountSchema } from "./index";

describe("eurAmountSchema", () => {
  it.each([0, 1250, -1250])("accepts a EUR amount of %i cents", (cents) => {
    const amount = { currency: "EUR", cents };

    expect(eurAmountSchema.parse(amount)).toEqual(amount);
  });

  it.each([
    { currency: "EUR", cents: 12.5 },
    { currency: "EUR", cents: Number.MAX_SAFE_INTEGER + 1 },
    { currency: "EUR", cents: "1250" },
    { currency: "USD", cents: 1250 },
  ])("rejects an invalid amount: %j", (amount) => {
    expect(eurAmountSchema.safeParse(amount).success).toBe(false);
  });
});
