import { describe, expect, it } from "vitest";
import {
  documentTitleSchema,
  draftDataSchema,
  MAX_DRAFT_BYTES,
} from "./schemas";

describe("draftDataSchema", () => {
  it("accepts an empty draft and a partial one", () => {
    expect(draftDataSchema.parse({})).toEqual({});
    const partial = {
      founder: { kind: "natural_person", firstName: "Erika" },
      company: { name: "Musterlicht" },
      shareCapitalCents: 2_500_000,
    };
    expect(draftDataSchema.parse(partial)).toEqual(partial);
  });

  it.each([null, [], "text", 42])("rejects %j", (value) => {
    expect(draftDataSchema.safeParse(value).success).toBe(false);
  });

  it("rejects unknown keys at any depth", () => {
    expect(draftDataSchema.safeParse({ admin: true }).success).toBe(false);
    expect(
      draftDataSchema.safeParse({ company: { name: "x", __proto__x: 1 } })
        .success,
    ).toBe(false);
  });

  it("rejects payloads over the size limit before checking the shape", () => {
    const result = draftDataSchema.safeParse({
      padding: "x".repeat(MAX_DRAFT_BYTES),
    });
    expect(result.error?.issues).toEqual([
      expect.objectContaining({ message: "draftTooLarge" }),
    ]);
  });

  it("rejects values that cannot be serialised", () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(draftDataSchema.safeParse(cyclic).success).toBe(false);
  });
});

describe("documentTitleSchema", () => {
  it("trims titles and enforces the database limits", () => {
    expect(documentTitleSchema.parse("  Musterlicht GmbH ")).toBe(
      "Musterlicht GmbH",
    );
    expect(documentTitleSchema.safeParse("   ").success).toBe(false);
    expect(documentTitleSchema.safeParse("x".repeat(120)).success).toBe(true);
    expect(documentTitleSchema.safeParse("x".repeat(121)).success).toBe(false);
  });
});
