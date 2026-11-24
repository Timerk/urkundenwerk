import type { FieldReview } from "@urkundenwerk/extraction/contract";
import { describe, expect, it } from "vitest";
import { checkUpload, MAX_UPLOAD_BYTES } from "./limits";
import {
  acceptAllVerified,
  decisionCounts,
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
  it("counts the decisions per extraction status, without values", () => {
    expect(
      decisionCounts(fields, {
        "company.name": { kind: "accepted" },
        "company.seat": { kind: "edited", value: "Blaustadt" },
        shareCapitalCents: { kind: "cleared" },
        "founder.birthDate": { kind: "pending" },
        notaryNotes: { kind: "edited", value: "Belehrt." },
      }),
    ).toEqual({
      verified: { accepted: 1, edited: 0, cleared: 1 },
      unverified: { accepted: 0, edited: 1, cleared: 0 },
      absent: { accepted: 0, edited: 1, cleared: 0 },
    });
  });

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

// The review screen's option labels come from the catalogues; a stand-in.
const optionLabel = (_path: string, value: string) => `<${value}>`;

describe("values", () => {
  it.each([
    ["shareCapitalCents", 3_500_000, "de", "35.000 €"],
    ["shareCapitalCents", 3_500_000, "en", "€35,000"],
    ["notarisation.date", "2025-01-21", "de", "21.01.2025"],
    ["notarisation.date", "2025-01-21", "en", "21/01/2025"],
    ["contribution", "half", "en", "<half>"],
    ["company.name", "Muster GmbH", "de", "Muster GmbH"],
  ] as const)("shows %s %j in %s as %j", (path, value, locale, shown) => {
    expect(formatValue(path, value, locale, optionLabel)).toBe(shown);
  });

  it("reads edits in the UI language's formats and checks them", () => {
    expect(editText("shareCapitalCents", 2_500_000, "de")).toBe("25.000");
    expect(editText("shareCapitalCents", 2_500_000, "en")).toBe("25,000");
    expect(editText("notarisation.date", "2025-01-21", "de")).toBe(
      "21.01.2025",
    );
    expect(parseEdit("shareCapitalCents", "30.000", "de")).toEqual({
      ok: true,
      value: 3_000_000,
    });
    expect(parseEdit("shareCapitalCents", "30,000", "en")).toEqual({
      ok: true,
      value: 3_000_000,
    });
    expect(parseEdit("shareCapitalCents", "abc", "de")).toEqual({
      ok: false,
      problem: "amountFormat",
    });
    expect(parseEdit("notarisation.date", "07.03.1990", "de")).toEqual({
      ok: true,
      value: "1990-03-07",
    });
    expect(parseEdit("notarisation.date", "30.02.2025", "de")).toEqual({
      ok: false,
      problem: "date",
    });
    expect(parseEdit("company.name", "  ", "en")).toEqual({
      ok: false,
      problem: "valueMissing",
    });
    expect(parseEdit("contribution", "full", "en")).toEqual({
      ok: true,
      value: "full",
    });
  });
});

describe("checkUpload", () => {
  it.each([
    [{ name: "Vertrag.PDF", size: 1_000 }, undefined],
    [{ name: "satzung.docx", size: MAX_UPLOAD_BYTES }, undefined],
    [{ name: "notes.txt", size: 10 }, "type"],
    [{ name: "scan.pdf", size: 0 }, "empty"],
    [{ name: "big.pdf", size: MAX_UPLOAD_BYTES + 1 }, "size"],
  ])("checks %j", (file, problem) => {
    expect(checkUpload(file)).toBe(problem);
  });
});
