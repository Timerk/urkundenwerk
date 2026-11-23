import { describe, expect, it } from "vitest";
import { anniversary, daysBetween, hasReachedAge } from "../../rules/dates";
import { getRule, rulesFor, runRules } from "../../rules";
import type { MusterprotokollDraft } from "./draft";
import {
  exampleCase,
  exampleContext,
  exampleDirector,
  exampleEntity,
  exampleFounder,
} from "./fixtures";
import {
  legalFormOf,
  musterprotokollRules,
  type MusterprotokollRuleCode,
} from "./rules";
import { checkMusterprotokoll, validateMusterprotokoll } from "./validate";

const referenceDate = exampleContext.referenceDate;

function issuesOf(
  code: MusterprotokollRuleCode,
  draft: MusterprotokollDraft,
  context = exampleContext,
) {
  return checkMusterprotokoll(draft, context).filter(
    (issue) => issue.code === code,
  );
}

const withCompany = (name: string, extra: Partial<MusterprotokollDraft> = {}) =>
  ({
    ...exampleCase,
    company: { ...exampleCase.company, name },
    ...extra,
  }) satisfies MusterprotokollDraft;

const gmbh = (shareCapitalCents: number, contribution: "full" | "half") =>
  withCompany("Musterlicht GmbH", { shareCapitalCents, contribution });
const ug = (shareCapitalCents: number, contribution: "full" | "half") =>
  withCompany("Musterlicht UG (haftungsbeschränkt)", {
    shareCapitalCents,
    contribution,
  });

/** Founder or director born on a date, notarised on a date (`null`: open). */
const notarised = (date: string | null) => ({
  ...exampleCase.notarisation,
  date: date ?? undefined,
});
const founderBorn = (birthDate: string, date: string | null = referenceDate) =>
  ({
    ...exampleCase,
    notarisation: notarised(date),
    founder: { ...exampleFounder, birthDate },
  }) satisfies MusterprotokollDraft;
const directorBorn = (birthDate: string, date: string | null = referenceDate) =>
  ({
    ...exampleCase,
    notarisation: notarised(date),
    managingDirector: { ...exampleDirector, birthDate },
  }) satisfies MusterprotokollDraft;

type Case = [
  name: string,
  draft: MusterprotokollDraft,
  expected: { paths?: string[]; params?: Record<string, unknown> } | null,
];

const cases: Record<MusterprotokollRuleCode, Case[]> = {
  field_required: [
    ["complete input", exampleCase, null],
    [
      "a blank seat",
      { ...exampleCase, company: { ...exampleCase.company, seat: "  " } },
      { paths: ["company.seat"] },
    ],
    [
      "a missing contribution",
      { ...exampleCase, contribution: undefined },
      { paths: ["contribution"] },
    ],
    [
      "optional notarial details left out",
      { ...exampleCase, notarisation: { mode: "in_person" } },
      null,
    ],
  ],
  field_invalid: [
    ["complete input", exampleCase, null],
    [
      "capital above the range the deed can write out",
      { ...exampleCase, shareCapitalCents: 100_000_000_000 },
      { paths: ["shareCapitalCents"] },
    ],
  ],
  company_legal_form_suffix: [
    ["a GmbH", withCompany("Musterlicht GmbH"), null],
    [
      "the long GmbH form",
      withCompany("Musterlicht Gesellschaft mit beschränkter Haftung"),
      null,
    ],
    [
      "a UG",
      withCompany("Musterlicht UG (haftungsbeschränkt)", {
        shareCapitalCents: 100,
      }),
      null,
    ],
    [
      "UG without (haftungsbeschränkt)",
      withCompany("Musterlicht UG"),
      { paths: ["company.name"] },
    ],
    [
      "a suffix glued to the name",
      withCompany("MusterlichtXGmbH"),
      { paths: ["company.name"] },
    ],
    ["no name yet", { company: {} }, null],
  ],
  share_capital_whole_euros: [
    ["whole euros", gmbh(2_500_000, "full"), null],
    [
      "a cent amount",
      gmbh(2_500_001, "full"),
      { paths: ["shareCapitalCents"] },
    ],
  ],
  gmbh_capital_minimum: [
    [
      "24.999 € for a GmbH",
      gmbh(2_499_900, "full"),
      {
        paths: ["shareCapitalCents", "company.name"],
        params: { shareCapitalCents: 2_499_900, minimumCents: 2_500_000 },
      },
    ],
    ["25.000 € for a GmbH", gmbh(2_500_000, "full"), null],
    ["24.999 € for a UG", ug(2_499_900, "full"), null],
    ["capital without a Firma", { shareCapitalCents: 100 }, null],
  ],
  ug_capital_below_gmbh_minimum: [
    ["24.999 € for a UG", ug(2_499_900, "full"), null],
    [
      "25.000 € for a UG",
      ug(2_500_000, "full"),
      { paths: ["shareCapitalCents", "company.name"] },
    ],
    ["1 € for a UG", ug(100, "full"), null],
  ],
  ug_contribution_full: [
    ["a UG paid in full", ug(100, "full"), null],
    [
      "a UG paid half",
      ug(100, "half"),
      { paths: ["contribution", "company.name"] },
    ],
    ["a GmbH paid half", gmbh(2_500_000, "half"), null],
  ],
  contribution_minimum_payment: [
    ["25.000 € paid half", gmbh(2_500_000, "half"), null],
    [
      "24.998 € paid half",
      gmbh(2_499_800, "half"),
      {
        paths: ["contribution", "shareCapitalCents"],
        params: { dueNowCents: 1_249_900, requiredCents: 1_250_000 },
      },
    ],
    ["24.998 € paid in full", gmbh(2_499_800, "full"), null],
    ["a UG paid half, reported by § 5a instead", ug(100, "half"), null],
  ],
  director_founder_natural_person: [
    ["a natural person as founder and director", exampleCase, null],
    [
      "a legal entity as founder and director",
      { ...exampleCase, founder: exampleEntity },
      { paths: ["managingDirector.kind", "founder.kind"] },
    ],
    [
      "a legal entity with another director",
      {
        ...exampleCase,
        founder: exampleEntity,
        managingDirector: exampleDirector,
      },
      null,
    ],
  ],
  director_full_age: [
    ["18 on the day of notarisation", directorBorn("2008-11-23"), null],
    [
      "18 the day after notarisation",
      directorBorn("2008-11-24"),
      {
        paths: ["managingDirector.birthDate"],
        params: { minimumAge: 18, notarisationDateGiven: true },
      },
    ],
    [
      "a founder director under 18",
      founderBorn("2009-01-01"),
      { paths: ["founder.birthDate", "managingDirector.kind"] },
    ],
    [
      "no notarisation date yet, 18 today",
      directorBorn("2008-11-23", null),
      null,
    ],
    [
      "no notarisation date yet, 17 today",
      directorBorn("2008-12-01", null),
      { params: { minimumAge: 18, notarisationDateGiven: false } },
    ],
    [
      "18 by a later notarisation date",
      directorBorn("2008-12-01", "2026-12-01"),
      null,
    ],
    [
      "born on 29 February, notarised on 28 February",
      directorBorn("2008-02-29", "2026-02-28"),
      { paths: ["managingDirector.birthDate"] },
    ],
    [
      "born on 29 February, notarised on 1 March",
      directorBorn("2008-02-29", "2026-03-01"),
      null,
    ],
  ],
  birth_date_not_in_future: [
    ["born today", founderBorn("2026-11-23"), null],
    [
      "a founder born tomorrow",
      founderBorn("2026-11-24"),
      { paths: ["founder.birthDate"] },
    ],
    [
      "a director born tomorrow",
      directorBorn("2026-11-24"),
      { paths: ["managingDirector.birthDate"] },
    ],
  ],
  founder_minor: [
    ["an adult founder", exampleCase, null],
    [
      "a founder who turns 18 on the day",
      {
        ...founderBorn("2008-11-23"),
        managingDirector: exampleDirector,
      },
      null,
    ],
    [
      "a 17-year-old founder",
      { ...founderBorn("2009-06-01"), managingDirector: exampleDirector },
      { paths: ["founder.birthDate"], params: { minimumAge: 18 } },
    ],
    ["a legal entity", { ...exampleCase, founder: exampleEntity }, null],
  ],
  notarisation_date_plausible: [
    ["today", founderBorn("1990-03-07", referenceDate), null],
    ["30 days ago", founderBorn("1990-03-07", "2026-10-24"), null],
    [
      "31 days ago",
      founderBorn("1990-03-07", "2026-10-23"),
      {
        paths: ["notarisation.date"],
        params: { inFuture: false, thresholdDays: 30 },
      },
    ],
    ["in a year", founderBorn("1990-03-07", "2027-11-23"), null],
    [
      "in a year and a day",
      founderBorn("1990-03-07", "2027-11-24"),
      { params: { inFuture: true, thresholdDays: 365 } },
    ],
    ["no date yet", founderBorn("1990-03-07", null), null],
  ],
  company_purpose_specific: [
    ["a specific purpose", exampleCase, null],
    [
      "Handel mit Waren aller Art",
      {
        ...exampleCase,
        company: {
          ...exampleCase.company,
          purpose: "der Handel mit Waren aller Art.",
        },
      },
      { paths: ["company.purpose"] },
    ],
    [
      "a stock phrase narrowed by insbesondere",
      {
        ...exampleCase,
        company: {
          ...exampleCase.company,
          purpose: "Handel mit Waren aller Art, insbesondere mit Fahrrädern",
        },
      },
      null,
    ],
  ],
  formation_costs_capped: [
    ["300 €", ug(30_000, "full"), null],
    [
      "299 €",
      ug(29_900, "full"),
      {
        paths: ["shareCapitalCents"],
        params: { shareCapitalCents: 29_900, costCapCents: 30_000 },
      },
    ],
  ],
};

describe.each(Object.entries(cases))("%s", (code, table) => {
  it.each(table)("%s", (_name, draft, expected) => {
    const found = issuesOf(code as MusterprotokollRuleCode, draft);
    if (expected === null) {
      expect(found).toEqual([]);
    } else {
      expect(found).toContainEqual(expect.objectContaining(expected));
    }
  });
});

describe("the rule registry", () => {
  it("has a case table for every rule", () => {
    expect(Object.keys(cases).sort()).toEqual(
      musterprotokollRules.map((rule) => rule.id).sort(),
    );
  });

  it("describes every rule with a reference and a one-sentence summary", () => {
    for (const rule of musterprotokollRules) {
      expect(rule.templateId).toBe("musterprotokoll-einpersonen");
      expect(rule.legalReference).toMatch(/(§|Anlage)/);
      expect(rule.summary).toMatch(/^[A-Z].*\.$/);
      expect(rule.summary.split(/\.\s/)).toHaveLength(1);
    }
  });

  it("looks rules up by template and code", () => {
    expect(
      getRule("musterprotokoll-einpersonen", "gmbh_capital_minimum"),
    ).toMatchObject({ legalReference: "§ 5 Abs. 1 GmbHG" });
    expect(getRule("musterprotokoll-einpersonen", "unknown")).toBeUndefined();
    expect(rulesFor("future-template")).toEqual([]);
  });

  it("only puts numbers and booleans into params", () => {
    const issues = runRules(
      "musterprotokoll-einpersonen",
      { ...ug(100, "half"), founder: exampleEntity },
      exampleContext,
    );
    for (const issue of issues) {
      for (const value of Object.values(issue.params)) {
        expect(["number", "boolean"]).toContain(typeof value);
      }
    }
  });
});

describe("runRules", () => {
  it("sorts issues by severity and is deterministic", () => {
    const draft = {
      ...ug(100, "half"),
      company: {
        ...exampleCase.company,
        name: "Musterlicht UG (haftungsbeschränkt)",
        purpose: "Handel mit Waren aller Art",
      },
    };
    const issues = runRules(
      "musterprotokoll-einpersonen",
      draft,
      exampleContext,
    );

    expect(issues.map((issue) => [issue.severity, issue.code])).toEqual([
      ["error", "ug_contribution_full"],
      ["warning", "company_purpose_specific"],
      ["info", "formation_costs_capped"],
    ]);
    expect(
      runRules("musterprotokoll-einpersonen", draft, exampleContext),
    ).toEqual(issues);
  });

  it("checks a rule as soon as its values exist", () => {
    const issues = runRules(
      "musterprotokoll-einpersonen",
      { company: { name: "Musterlicht GmbH" }, shareCapitalCents: 100 },
      exampleContext,
    );
    expect(issues.map((issue) => issue.code)).toContain("gmbh_capital_minimum");
  });

  it("rejects a reference date that is not an ISO date", () => {
    expect(() =>
      runRules("musterprotokoll-einpersonen", {}, { referenceDate: "today" }),
    ).toThrow(RangeError);
  });
});

describe("validateMusterprotokoll", () => {
  it("passes warnings and notes through without blocking", () => {
    const result = validateMusterprotokoll(ug(100, "full"), exampleContext);
    expect(result.success).toBe(true);
    expect(result.issues.map((issue) => issue.code)).toEqual([
      "formation_costs_capped",
    ]);
  });

  it("refuses input with an error", () => {
    const result = validateMusterprotokoll(gmbh(100, "full"), exampleContext);
    expect(result.success).toBe(false);
  });
});

describe("legalFormOf", () => {
  it.each([
    ["Musterlicht GmbH", "GmbH"],
    ["Musterlicht Gesellschaft mit beschränkter Haftung", "GmbH"],
    ["Musterlicht UG (haftungsbeschränkt)", "UG"],
    ["Musterlicht Unternehmergesellschaft (haftungsbeschränkt)", "UG"],
    ["  Musterlicht GmbH  ", "GmbH"],
    ["Musterlicht", undefined],
    ["", undefined],
    [undefined, undefined],
  ])("reads %j as %s", (name, form) => {
    expect(legalFormOf(name)).toBe(form);
  });
});

describe("dates", () => {
  it.each([
    ["2008-11-23", 18, "2026-11-23"],
    ["2008-02-29", 18, "2026-03-01"],
    ["2008-02-29", 16, "2024-02-29"],
    ["2000-12-31", 1, "2001-12-31"],
  ])("%s plus %i years is %s", (birth, years, expected) => {
    expect(anniversary(birth, years)).toBe(expected);
  });

  it("counts a person's age from the start of the birthday", () => {
    expect(hasReachedAge("2008-11-23", 18, "2026-11-22")).toBe(false);
    expect(hasReachedAge("2008-11-23", 18, "2026-11-23")).toBe(true);
  });

  it("counts days across months and leap years", () => {
    expect(daysBetween("2026-11-23", "2026-10-24")).toBe(-30);
    expect(daysBetween("2027-02-28", "2028-02-29")).toBe(366);
  });
});
