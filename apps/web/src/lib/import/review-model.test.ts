import type { FieldReview } from "@urkundenwerk/extraction/contract";
import { describe, expect, it } from "vitest";
import { checkUpload, MAX_UPLOAD_BYTES } from "./limits";
import {
  acceptAllVerified,
  draftFromDecisions,
  editText,
  formatValue,
  initialDecisions,
  parseEdit,
  pendingFields,
} from "./review-model";

function review(
  path: FieldReview["path"],
  status: FieldReview["status"],
  value: FieldReview["value"],
): FieldReview {
  return {
    path,
    status,
    value,
    text: value === null ? null : String(value),
    quote: status === "absent" ? null : "a quote",
    citation: null,
    reasons: [],
    note: null,
  };
}

const fields = [
  review("company.name", "verified", "Schieferwabe Prüfstände GmbH"),
  review("company.seat", "unverified", "Blausaum"),
  review("shareCapitalCents", "verified", 3_500_000),
  review("founder.birthDate", "unverified", null),
  review("notaryNotes", "absent", null),
];

describe("review decisions", () => {
  it("starts with every found value undecided and absent ones ignored", () => {
    const decisions = initialDecisions(fields);
    expect(Object.keys(decisions)).toEqual([
      "company.name",
      "company.seat",
      "shareCapitalCents",
      "founder.birthDate",
    ]);
    expect(pendingFields(fields, decisions)).toHaveLength(4);
  });

  it("accepts only verified values with “Accept all verified”", () => {
    const decisions = acceptAllVerified(fields, initialDecisions(fields));
    expect(decisions).toMatchObject({
      "company.name": { kind: "accepted" },
      shareCapitalCents: { kind: "accepted" },
      "company.seat": { kind: "pending" },
      "founder.birthDate": { kind: "pending" },
    });
  });

  it("builds a draft from accepted and edited values only", () => {
    const draft = draftFromDecisions(fields, {
      "company.name": { kind: "accepted" },
      "company.seat": { kind: "cleared" },
      shareCapitalCents: { kind: "edited", value: 2_500_000 },
      // Accepting a value that could not be read adds nothing.
      "founder.birthDate": { kind: "accepted" },
    });
    expect(draft).toEqual({
      company: { name: "Schieferwabe Prüfstände GmbH" },
      shareCapitalCents: 2_500_000,
    });
  });
});

describe("values", () => {
  it.each([
    ["shareCapitalCents", 3_500_000, "35.000 €"],
    ["notarisation.date", "2025-01-21", "21. Januar 2025"],
    ["contribution", "half", "50 % now, the rest when called in"],
    ["company.name", "Muster GmbH", "Muster GmbH"],
  ] as const)("shows %s as %j", (path, value, shown) => {
    expect(formatValue(path, value)).toBe(shown);
  });

  it("reads edits in the builder's formats and checks them", () => {
    expect(editText("shareCapitalCents", 2_500_000)).toBe("25.000");
    expect(parseEdit("shareCapitalCents", "30.000")).toEqual({
      ok: true,
      value: 3_000_000,
    });
    expect(parseEdit("shareCapitalCents", "abc")).toMatchObject({ ok: false });
    expect(parseEdit("notarisation.date", "2025-02-30")).toEqual({
      ok: false,
      message: "Enter a valid date.",
    });
    expect(parseEdit("company.name", "  ")).toMatchObject({ ok: false });
    expect(parseEdit("contribution", "full")).toEqual({
      ok: true,
      value: "full",
    });
  });
});

describe("checkUpload", () => {
  it.each([
    [{ name: "Vertrag.PDF", size: 1_000 }, undefined],
    [{ name: "satzung.docx", size: MAX_UPLOAD_BYTES }, undefined],
    [{ name: "notes.txt", size: 10 }, /Only PDF and DOCX/u],
    [{ name: "scan.pdf", size: 0 }, /empty/u],
    [{ name: "big.pdf", size: MAX_UPLOAD_BYTES + 1 }, /larger than 4 MB/u],
  ])("checks %j", (file, message) => {
    const problem = checkUpload(file);
    if (message) expect(problem).toMatch(message);
    else expect(problem).toBeUndefined();
  });
});
