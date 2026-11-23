import { expect, it } from "vitest";
import { extractionResultSchema } from "./index";

it("validates fields against draft types and rejects duplicates and unknown paths", () => {
  const parse = (...entries: [string, unknown][]) =>
    extractionResultSchema.safeParse({
      documentId: "a".repeat(64),
      fields: entries.map(([path, value]) => ({ path, value, citation: null })),
    }).success;
  expect(
    parse(
      ["shareCapitalCents", 2_500_000],
      ["founder.salutation", null],
      ["notarisation.date", "2026-01-31"],
    ),
  ).toBe(true);
  expect(parse(["shareCapitalCents", "25.000 Euro"])).toBe(false);
  expect(parse(["notarisation.date", "2026-02-31"])).toBe(false);
  expect(parse(["company.name", null])).toBe(false);
  expect(parse(["company.name", " "])).toBe(false);
  expect(
    parse(["company.name", "Muster GmbH"], ["company.name", "Andere GmbH"]),
  ).toBe(false);
  expect(parse(["company.address", "Musterstadt"])).toBe(false);
});
