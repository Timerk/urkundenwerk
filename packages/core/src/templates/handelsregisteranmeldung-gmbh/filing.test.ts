import { describe, expect, it } from "vitest";
import { toPlainText } from "../../documents/plain-text";
import { getRule, runRules } from "../../rules";
import {
  musterprotokollDraftSchema,
  type MusterprotokollDraft,
} from "../musterprotokoll-einpersonen/draft";
import {
  exampleCase,
  exampleContext,
  exampleEntity,
} from "../musterprotokoll-einpersonen/fixtures";
import { validateMusterprotokoll } from "../musterprotokoll-einpersonen/validate";
import { exampleEntityFiling, exampleFiling } from "./fixtures";
import { registerFilingRules, type RegisterFilingRuleCode } from "./rules";
import {
  buildRegisterFiling,
  buildRegisterFilingPreview,
  registerFilingMetadata,
} from "./template";
import { validateRegisterFiling } from "./validate";

const id = registerFilingMetadata.id;
const filing = exampleFiling.filing;
const cases: Array<[RegisterFilingRuleCode, MusterprotokollDraft, string]> = [
  [
    "filing_court_required",
    { ...exampleFiling, filing: { ...filing, registerCourt: " " } },
    "filing.registerCourt",
  ],
  [
    "filing_business_address",
    {
      ...exampleFiling,
      filing: {
        ...filing,
        businessAddress: { city: " ", postalCode: "DE1234" },
      },
    },
    "filing.businessAddress.postalCode",
  ],
  [
    "filing_payment_minimum",
    { ...exampleFiling, filing: { ...filing, paidCents: 1_249_999 } },
    "filing.paidCents",
  ],
  [
    "filing_payment_minimum",
    {
      ...exampleFiling,
      shareCapitalCents: 10_000_400,
      filing: { ...filing, paidCents: 2_500_000 },
    },
    "filing.paidCents",
  ],
  [
    "filing_payment_minimum",
    {
      ...exampleFiling,
      company: {
        ...exampleCase.company,
        name: "Muster UG (haftungsbeschränkt)",
      },
      shareCapitalCents: 50_000,
      filing: { ...filing, paidCents: 49_999 },
    },
    "filing.paidCents",
  ],
  [
    "filing_payment_matches_deed",
    { ...exampleFiling, filing: { ...filing, paidCents: 1_250_000 } },
    "filing.paidCents",
  ],
  [
    "filing_payment_matches_deed",
    { ...exampleFiling, filing: { ...filing, paidCents: 2_500_001 } },
    "filing.paidCents",
  ],
  [
    "filing_payment_matches_deed",
    {
      ...exampleFiling,
      contribution: "half",
      shareCapitalCents: 5_000_000,
      filing: { ...filing, paidCents: 2_499_999 },
    },
    "filing.paidCents",
  ],
  [
    "filing_funds_at_free_disposal",
    { ...exampleFiling, filing: { ...filing, fundsAtFreeDisposal: false } },
    "filing.fundsAtFreeDisposal",
  ],
  [
    "filing_no_disqualification",
    { ...exampleFiling, filing: { ...filing, noDisqualification: false } },
    "filing.noDisqualification",
  ],
  [
    "filing_disclosure_instruction",
    {
      ...exampleFiling,
      filing: { ...filing, instructedOnDisclosure: undefined },
    },
    "filing.instructedOnDisclosure",
  ],
  [
    "filing_director_appointed_in_deed",
    { ...exampleFiling, founder: exampleEntity },
    "managingDirector.kind",
  ],
];

describe("register filing checks", () => {
  it.each(cases)("blocks %s", (code, draft, path) => {
    expect(runRules(id, draft, exampleContext)).toContainEqual(
      expect.objectContaining({ code, paths: [path], severity: "error" }),
    );
    expect(getRule(id, code)?.legalReference).toBeTruthy();
    expect(validateRegisterFiling(draft, exampleContext).success).toBe(false);
  });

  it("has a passing fixture and a failing case for every rule", () => {
    expect(new Set(cases.map(([code]) => code))).toEqual(
      new Set(registerFilingRules.map(({ id }) => id)),
    );
    for (const draft of [
      exampleFiling,
      exampleEntityFiling,
      {
        ...exampleEntityFiling,
        filing: { ...exampleEntityFiling.filing, paidCents: 1_250_000 },
      },
      {
        ...exampleFiling,
        company: {
          ...exampleCase.company,
          name: "Muster UG (haftungsbeschränkt)",
        },
        shareCapitalCents: 50_000,
        filing: { ...filing, paidCents: 50_000 },
      },
    ]) {
      expect(validateRegisterFiling(draft, exampleContext).success).toBe(true);
    }
  });

  it("keeps old drafts exportable and rejects a second filing director in saved data", () => {
    const draft = musterprotokollDraftSchema.parse(exampleCase);
    expect(validateMusterprotokoll(draft, exampleContext).success).toBe(true);
    expect(validateRegisterFiling(draft, exampleContext).success).toBe(false);
    expect(
      musterprotokollDraftSchema.safeParse({
        ...exampleFiling,
        filing: { ...filing, managingDirector: { firstName: "Andere" } },
      }).success,
    ).toBe(false);
  });
});

describe("register filing text", () => {
  it.each([
    [
      exampleFiling,
      "Geschäftsführerin",
      "Erika Mustermann",
      "Unterschrift der Geschäftsführerin",
      false,
    ],
    [
      exampleEntityFiling,
      "Geschäftsführer",
      "Max Mustermann",
      "Unterschrift des Geschäftsführers",
      true,
    ],
  ] as const)(
    "uses the signer's deed identity and the applicable attachments",
    (draft, role, name, signature, evidence) => {
      const document = buildRegisterFiling(draft, exampleContext);
      expect(buildRegisterFilingPreview(draft)).toEqual(document);
      const text = toPlainText(document);
      for (const passage of [
        "An das Amtsgericht Musterstadt",
        `${role}: ${name}`,
        "vertreten sie die Gesellschaft gemeinschaftlich",
        "von den Beschränkungen des § 181 BGB befreit",
        "Musterkai 4, 12345 Musterstadt",
        "§ 6 Abs. 2 Satz 2 Nr. 2 und 3 sowie Satz 3 und 4 GmbHG",
        "§ 53 Abs. 2 BZRG",
        "zugleich Gesellschafterliste nach § 2 Abs. 1a Satz 4 GmbHG",
        signature,
        "Beglaubigungsvermerk (vom Notariat auszufüllen)",
      ])
        expect(text).toContain(passage);
      expect(text.includes("– Einzahlungsnachweis")).toBe(evidence);
    },
  );

  it("leaves unconfirmed assurances blank in the preview", () => {
    const model = buildRegisterFilingPreview(exampleCase);
    expect(model.blocks).toContainEqual(
      expect.objectContaining({
        kind: "paragraph",
        runs: expect.arrayContaining([
          { kind: "blank", path: "filing.noDisqualification" },
        ]),
      }),
    );
    expect(() => buildRegisterFiling(exampleCase, exampleContext)).toThrow(
      "filing_no_disqualification",
    );
  });
});
