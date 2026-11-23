import { describe, expect, it } from "vitest";
import {
  analyseDraft,
  editDraftField,
  formatEuros,
  getAt,
  legalFormOf,
  parseEuros,
  setAt,
  withDefaults,
} from "./form-model";

describe("getAt and setAt", () => {
  it("reads and writes nested values without mutating the draft", () => {
    const draft = { founder: { kind: "natural_person" as const } };
    const next = setAt(draft, "founder.address.city", "Musterstadt");

    expect(getAt(next, "founder.address.city")).toBe("Musterstadt");
    expect(getAt(next, "founder.kind")).toBe("natural_person");
    expect(draft).toEqual({ founder: { kind: "natural_person" } });
  });

  it("removes keys for empty text and undefined", () => {
    const draft = {
      company: { name: "Musterlicht GmbH", seat: "Musterstadt" },
    };

    expect(setAt(draft, "company.name", "")).toEqual({
      company: { seat: "Musterstadt" },
    });
    expect(setAt(draft, "company.seat", undefined)).toEqual({
      company: { name: "Musterlicht GmbH" },
    });
  });

  it("keeps null, which means no salutation", () => {
    expect(setAt({}, "founder.salutation", null)).toEqual({
      founder: { salutation: null },
    });
  });
});

describe("filing assurances", () => {
  const draft = {
    founder: { kind: "natural_person", firstName: "Erika" },
    managingDirector: { kind: "founder" },
    filing: {
      paidCents: 2_500_000,
      fundsAtFreeDisposal: true,
      noDisqualification: true,
      instructedOnDisclosure: true,
    },
  } as const;

  it("clears assurances when the appointed identity changes", () => {
    expect(editDraftField(draft, "founder.firstName", "Mara").filing).toEqual({
      paidCents: 2_500_000,
      fundsAtFreeDisposal: false,
      noDisqualification: false,
      instructedOnDisclosure: false,
    });
    expect(
      editDraftField(draft, "managingDirector.firstName", "Mara").filing,
    ).toEqual(draft.filing);
  });

  it("clears the disposal confirmation when the recorded amount changes", () => {
    expect(editDraftField(draft, "filing.paidCents", 1_250_050).filing).toEqual(
      {
        ...draft.filing,
        fundsAtFreeDisposal: false,
        paidCents: 1_250_050,
      },
    );
    expect(editDraftField(draft, "filing.paidCents", 2_500_000).filing).toEqual(
      draft.filing,
    );
  });
});

describe("withDefaults", () => {
  it("fills in the default choices and keeps existing ones", () => {
    expect(
      withDefaults({ notarisation: { mode: "video", deedNumber: "1/2026" } }),
    ).toEqual({
      notarisation: { mode: "video", deedNumber: "1/2026" },
      founder: { kind: "natural_person" },
      managingDirector: { kind: "founder" },
    });
  });
});

describe("parseEuros", () => {
  it.each([
    ["25000", 2_500_000],
    ["25.000", 2_500_000],
    ["25 000 €", 2_500_000],
    ["25.000,00", 2_500_000],
    ["1", 100],
    ["999.999.999", 99_999_999_900],
  ])("reads %j as %i cents", (text, cents) => {
    expect(parseEuros(text)).toEqual({ kind: "valid", cents });
  });

  it("treats blank input as empty", () => {
    expect(parseEuros("  ")).toEqual({ kind: "empty" });
  });

  it.each(["25.000,50", "25,5", "2.50", "abc", "-5", "1.0000"])(
    "rejects %j",
    (text) => {
      expect(parseEuros(text)).toEqual({
        kind: "invalid",
        message: "Enter whole euros, for example 25.000.",
      });
    },
  );

  it("rejects amounts outside the supported range", () => {
    expect(parseEuros("0").kind).toBe("invalid");
    expect(parseEuros("1.000.000.000").kind).toBe("invalid");
  });

  it("formats cents back with thousands separators", () => {
    expect(formatEuros(2_500_000)).toBe("25.000");
    expect(formatEuros(undefined)).toBe("");
  });

  it("accepts fractional euros for the paid amount", () => {
    expect(parseEuros("12.500,5", true)).toEqual({
      kind: "valid",
      cents: 1_250_050,
    });
    expect(formatEuros(1_250_050, true)).toBe("12.500,50");
  });
});

const TODAY = "2026-11-23";

/** The issues of a draft, keyed by path, without the ones of a new draft. */
function ruleFindings(draft: Parameters<typeof analyseDraft>[0]) {
  return [...analyseDraft(draft, TODAY).issues.values()]
    .filter((issue) => !issue.code.startsWith("field_"))
    .map(({ path, code, message }) => ({ path, code, message }));
}

describe("rule issues in the form", () => {
  it("reports cross-field rules as soon as their inputs are given", () => {
    expect(
      ruleFindings({
        company: { name: "Musterlicht UG (haftungsbeschränkt)" },
        shareCapitalCents: 3_000_000,
        contribution: "half",
      }),
    ).toEqual([
      {
        path: "shareCapitalCents",
        code: "ug_capital_below_gmbh_minimum",
        message:
          "A UG (haftungsbeschränkt) has less than 25.000 € Stammkapital. From 25.000 € on, found a GmbH instead.",
      },
      {
        path: "contribution",
        code: "ug_contribution_full",
        message:
          "A UG (haftungsbeschränkt) must be paid in full before registration (§ 5a Abs. 2 GmbHG).",
      },
    ]);
  });

  it("waits until every value a rule compares is present", () => {
    expect(ruleFindings({ shareCapitalCents: 100_000 })).toEqual([]);
    expect(ruleFindings({ company: { name: "Musterlicht GmbH" } })).toEqual([]);
  });

  it("flags a legal entity appointed as Geschäftsführer", () => {
    expect(
      ruleFindings({
        founder: { kind: "legal_entity" },
        managingDirector: { kind: "founder" },
      }),
    ).toEqual([
      expect.objectContaining({
        path: "managingDirector.kind",
        code: "director_founder_natural_person",
      }),
    ]);
  });

  it("flags a Firma without a legal form suffix", () => {
    expect(ruleFindings({ company: { name: "Musterlicht" } })).toEqual([
      expect.objectContaining({ code: "company_legal_form_suffix" }),
    ]);
  });

  it("shows warnings and notes without blocking the export", () => {
    const analysis = analyseDraft(
      { company: { purpose: "Handel mit Waren aller Art" } },
      TODAY,
    );
    expect(analysis.issues.get("company.purpose")).toMatchObject({
      code: "company_purpose_specific",
      severity: "warning",
    });
    expect(analysis.checks.map((issue) => issue.code)).toEqual([
      "company_purpose_specific",
    ]);
  });

  it("prefers a rule error over a missing value on the same path", () => {
    const analysis = analyseDraft(
      {
        founder: { kind: "legal_entity" },
        managingDirector: { kind: "founder" },
      },
      TODAY,
    );
    expect(analysis.issues.get("managingDirector.kind")?.code).toBe(
      "director_founder_natural_person",
    );
  });
});

describe("legalFormOf", () => {
  it.each([
    ["Musterlicht GmbH", "GmbH"],
    ["Musterlicht Gesellschaft mit beschränkter Haftung", "GmbH"],
    ["Musterlicht UG (haftungsbeschränkt)", "UG"],
    ["Musterlicht", undefined],
    ["", undefined],
    [undefined, undefined],
  ])("reads %j as %j", (name, form) => {
    expect(legalFormOf(name)).toBe(form);
  });
});

describe("analyseDraft", () => {
  it("lists every missing required value of a new draft", () => {
    const analysis = analyseDraft(withDefaults({}), TODAY);

    expect(analysis.complete).toBe(false);
    expect([...analysis.issues.keys()]).toEqual([
      "founder.salutation",
      "founder.firstName",
      "founder.lastName",
      "founder.birthDate",
      "founder.address.street",
      "founder.address.postalCode",
      "founder.address.city",
      "company.name",
      "company.seat",
      "company.purpose",
      "shareCapitalCents",
      "contribution",
    ]);
    expect(analysis.issues.get("company.name")?.message).toBe(
      "Required to complete the deed.",
    );
    expect(analysis.issues.get("contribution")?.message).toBe(
      "Choose one of the options.",
    );
  });

  it("is complete for a valid case", () => {
    const analysis = analyseDraft(
      {
        notarisation: { mode: "in_person" },
        founder: {
          kind: "natural_person",
          salutation: null,
          firstName: "Alex",
          lastName: "Beispiel",
          birthDate: "1990-01-01",
          address: {
            street: "Musterweg 1",
            postalCode: "12345",
            city: "Musterstadt",
          },
        },
        company: {
          name: "Musterlicht UG (haftungsbeschränkt)",
          seat: "Musterstadt",
          purpose: "Beratung",
        },
        shareCapitalCents: 100,
        contribution: "full",
        managingDirector: { kind: "founder" },
      },
      TODAY,
    );

    // A UG with 1 € only gets the note about formation costs.
    expect(analysis).toMatchObject({ complete: true, outstanding: 0 });
    expect([...analysis.issues.keys()]).toEqual(["shareCapitalCents"]);
    expect(analysis.checks.map((issue) => issue.severity)).toEqual(["info"]);
  });
});
