import { expect, it } from "vitest";
import { exampleCase, exampleDirector, exampleEntity } from "./fixtures";
import { musterprotokollSchema, type MusterprotokollInput } from "./schema";

it.each([
  ["GmbH", 2_500_000, "half"],
  ["Gesellschaft mit beschränkter Haftung", 2_500_000, "full"],
  ["UG (haftungsbeschränkt)", 100, "full"],
  ["Unternehmergesellschaft (haftungsbeschränkt)", 2_499_900, "full"],
] as const)(
  "accepts %s and its permitted capital and contribution",
  (suffix, shareCapitalCents, contribution) => {
    const input = {
      ...exampleCase,
      company: { ...exampleCase.company, name: `Musterlicht ${suffix}` },
      shareCapitalCents,
      contribution,
    };
    expect(musterprotokollSchema.parse(input)).toEqual(input);
  },
);

it("accepts a legal entity with a separate director and missing notarial details", () => {
  const input = {
    ...exampleCase,
    notarisation: { mode: "video" },
    founder: exampleEntity,
    managingDirector: exampleDirector,
  } as const;
  expect(musterprotokollSchema.parse(input)).toEqual(input);
});

it("leaves cross-field and legal rules to the rule engine", () => {
  // A UG with GmbH capital is structurally valid; the rules report it.
  const input = {
    ...exampleCase,
    company: { ...exampleCase.company, name: "Musterlicht UG" },
    shareCapitalCents: 2_500_050,
  };
  expect(musterprotokollSchema.safeParse(input).success).toBe(true);
});

it.each([
  [{ shareCapitalCents: -100 }, ["shareCapitalCents"], "too_small"],
  [{ shareCapitalCents: 100_000_000_000 }, ["shareCapitalCents"], "too_big"],
  [{ shareCapitalCents: 2_500_000.1 }, ["shareCapitalCents"], "invalid_type"],
  [
    { notarisation: { mode: "video", date: "2026-02-29" } },
    ["notarisation", "date"],
    "invalid_format",
  ],
  [
    { company: { ...exampleCase.company, seat: " " } },
    ["company", "seat"],
    "too_small",
  ],
] satisfies [Partial<MusterprotokollInput>, string[], string][])(
  "reports a structural violation for %j",
  (overrides, path, code) => {
    const result = musterprotokollSchema.safeParse({
      ...exampleCase,
      ...overrides,
    });
    expect(result.error?.issues).toContainEqual(
      expect.objectContaining({ code, path }),
    );
  },
);
