import { describe, expect, it } from "vitest";
import {
  draftToInput,
  musterprotokollDraftSchema,
  normaliseDraft,
  type MusterprotokollDraft,
} from "./draft";
import {
  exampleCase,
  exampleContext,
  exampleDirector,
  exampleEntity,
} from "./fixtures";
import { validateMusterprotokoll } from "./validate";

describe("musterprotokollDraftSchema", () => {
  it("accepts an empty draft", () => {
    expect(musterprotokollDraftSchema.parse({})).toEqual({});
  });

  it("accepts a complete case unchanged", () => {
    expect(musterprotokollDraftSchema.parse(exampleCase)).toEqual(exampleCase);
  });

  it("keeps text as typed and accepts partial sections", () => {
    const draft = {
      founder: { kind: "natural_person", firstName: " Erika ", lastName: "" },
      company: { name: "Musterlicht" },
    };
    expect(musterprotokollDraftSchema.parse(draft)).toEqual(draft);
  });

  it("keeps the fields of both founder alternatives", () => {
    const draft = {
      founder: { ...exampleCase.founder, ...exampleEntity },
      managingDirector: { ...exampleDirector, kind: "founder" },
    };
    expect(musterprotokollDraftSchema.safeParse(draft).success).toBe(true);
  });

  it.each([
    [{ unexpected: true }, [], "unrecognized_keys"],
    [{ company: { name: "x", slogan: "y" } }, ["company"], "unrecognized_keys"],
    [
      { founder: { address: { country: "DE" } } },
      ["founder", "address"],
      "unrecognized_keys",
    ],
    [
      { notarisation: { mode: "phone" } },
      ["notarisation", "mode"],
      "invalid_value",
    ],
    [
      { founder: { salutation: "Dr." } },
      ["founder", "salutation"],
      "invalid_value",
    ],
    [{ company: { name: "x".repeat(201) } }, ["company", "name"], "too_big"],
    [{ notaryNotes: "x".repeat(2001) }, ["notaryNotes"], "too_big"],
    [{ shareCapitalCents: 1.5 }, ["shareCapitalCents"], "invalid_type"],
    [{ shareCapitalCents: -1 }, ["shareCapitalCents"], "too_small"],
    [
      { notarisation: { date: "23.11.2026" } },
      ["notarisation", "date"],
      "invalid_format",
    ],
  ])("rejects %j", (draft, path, code) => {
    const result = musterprotokollDraftSchema.safeParse(draft);
    expect(result.error?.issues).toContainEqual(
      expect.objectContaining({ code, path }),
    );
  });
});

describe("draftToInput", () => {
  it("turns a complete draft into valid input", () => {
    const result = validateMusterprotokoll(exampleCase, exampleContext);
    expect(result).toEqual({ success: true, data: exampleCase, issues: [] });
  });

  it("selects the fields of the chosen alternatives", () => {
    const draft: MusterprotokollDraft = {
      ...exampleCase,
      founder: { ...exampleCase.founder, ...exampleEntity },
      managingDirector: { ...exampleDirector, kind: "founder" },
    };
    const input = draftToInput(draft);

    expect(input.founder).toEqual(exampleEntity);
    expect(input.managingDirector).toEqual({ kind: "founder" });
  });

  it("drops blank text so optional notarial fields stay blank", () => {
    const input = draftToInput({
      notarisation: { mode: "video", deedNumber: "  ", notaryName: "" },
    });
    expect(input.notarisation).toEqual({ mode: "video" });
  });

  it("reports missing required fields of an incomplete draft", () => {
    const result = validateMusterprotokoll(
      {
        founder: { kind: "natural_person", firstName: "Erika" },
        company: { name: "Musterlicht GmbH", seat: " " },
      },
      exampleContext,
    );
    expect(result.success).toBe(false);
    const paths = result.issues
      .filter((issue) => issue.code === "field_required")
      .map((issue) => issue.paths[0]);

    expect(paths).toEqual(
      expect.arrayContaining([
        "notarisation.mode",
        "founder.lastName",
        "founder.address.street",
        "company.seat",
        "shareCapitalCents",
        "contribution",
      ]),
    );
    expect(paths).not.toContain("notarisation.deedNumber");
  });

  it("trims text as the schema does", () => {
    expect(
      normaliseDraft({
        company: {
          name: "  Musterlicht GmbH ",
          purpose: "Software\r\nund mehr",
        },
      }),
    ).toMatchObject({
      company: { name: "Musterlicht GmbH", purpose: "Software\nund mehr" },
    });
  });
});
