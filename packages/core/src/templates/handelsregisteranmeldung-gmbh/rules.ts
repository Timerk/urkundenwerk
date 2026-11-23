import type { Rule } from "../../rules/types";
import type { MusterprotokollCandidate } from "../musterprotokoll-einpersonen/draft";
import {
  gmbhMinimumPaymentCents,
  legalFormOf,
} from "../musterprotokoll-einpersonen/rules";
import { appointedDirector, isIdentifiedDirector } from "./director";
import { registerFilingMetadata } from "./metadata";
import { filingSchema, type FilingDraft } from "./schema";

export type RegisterFilingRuleCode =
  | "filing_court_required"
  | "filing_business_address"
  | "filing_payment_minimum"
  | "filing_payment_matches_deed"
  | "filing_funds_at_free_disposal"
  | "filing_no_disqualification"
  | "filing_disclosure_instruction"
  | "filing_director_appointed_in_deed";

export type RegisterFilingCandidate = MusterprotokollCandidate & {
  filing: FilingDraft;
};

type FilingRule = Rule<RegisterFilingCandidate, RegisterFilingRuleCode>;
type FilingCheck = Omit<FilingRule, "templateId" | "severity">;
const paidPath = "filing.paidCents";

const checks: readonly FilingCheck[] = [
  {
    id: "filing_court_required",
    legalReference: "§ 7 Abs. 1 GmbHG",
    summary: "Name the register court for the company's registered seat.",
    paths: ["filing.registerCourt"],
    check: ({ filing }) =>
      filingSchema.shape.registerCourt.safeParse(filing.registerCourt).success
        ? []
        : [
            {
              paths: ["filing.registerCourt"],
              message: "Enter the town of the Amtsgericht.",
            },
          ],
  },
  {
    id: "filing_business_address",
    legalReference: "§ 8 Abs. 4 Nr. 1 GmbHG",
    summary: "The application must state a complete domestic business address.",
    paths: [
      "filing.businessAddress.street",
      "filing.businessAddress.postalCode",
      "filing.businessAddress.city",
    ],
    check: ({ filing }) => {
      const result = filingSchema.shape.businessAddress.safeParse(
        filing.businessAddress,
      );
      return result.success
        ? []
        : result.error.issues.map(({ path }) => ({
            paths: [`filing.businessAddress.${path.join(".")}`],
            message:
              path[0] === "postalCode"
                ? "Enter a five-digit German postcode."
                : "Complete the domestic business address.",
          }));
    },
  },
  {
    id: "filing_payment_minimum",
    legalReference: "§ 7 Abs. 2, § 5a Abs. 2, § 8 Abs. 2 GmbHG",
    summary:
      "The paid amount must meet the statutory threshold before registration.",
    paths: [paidPath, "shareCapitalCents", "company.name"],
    check: ({ company, shareCapitalCents, filing: { paidCents } }) => {
      if (
        !filingSchema.shape.paidCents.safeParse(paidCents).success ||
        paidCents === undefined
      ) {
        return [
          { paths: [paidPath], message: "Enter the amount paid in euros." },
        ];
      }
      const form = legalFormOf(company?.name);
      if (!form || shareCapitalCents === undefined) return [];
      const minimumCents =
        form === "UG"
          ? shareCapitalCents
          : gmbhMinimumPaymentCents(shareCapitalCents);
      return paidCents < minimumCents
        ? [
            {
              paths: [paidPath],
              params: { paidCents, minimumCents },
              message:
                "The paid amount is below the statutory minimum for registration.",
            },
          ]
        : [];
    },
  },
  {
    id: "filing_payment_matches_deed",
    legalReference: "Anlage 1 a) GmbHG, Nr. 3",
    summary:
      "The paid amount must cover the immediate payment agreed in the deed and cannot exceed the subscribed capital.",
    paths: [paidPath, "shareCapitalCents", "contribution"],
    check: ({
      contribution,
      shareCapitalCents: capital,
      filing: { paidCents },
    }) => {
      if (!contribution || capital === undefined || paidCents === undefined)
        return [];
      const dueCents =
        contribution === "full" ? capital : Math.ceil(capital / 2);
      return paidCents < dueCents || paidCents > capital
        ? [
            {
              paths: [paidPath],
              params: { paidCents, dueCents, capitalCents: capital },
              message:
                "Enter an amount between the payment due under the deed and the share capital.",
            },
          ]
        : [];
    },
  },
  {
    id: "filing_director_appointed_in_deed",
    legalReference: "§ 8 Abs. 1 Nr. 2, § 78 GmbHG, Anlage 1 a) GmbHG Nr. 4",
    summary:
      "The filing director must be the person appointed in clause 4 of the deed.",
    paths: [
      "managingDirector.kind",
      "founder.kind",
      "founder.firstName",
      "founder.lastName",
      "founder.birthDate",
      "founder.address.city",
      "managingDirector.firstName",
      "managingDirector.lastName",
      "managingDirector.birthDate",
      "managingDirector.residence",
    ],
    check: (data) =>
      isIdentifiedDirector(appointedDirector(data))
        ? []
        : [
            {
              paths: ["managingDirector.kind"],
              message:
                "Complete the identity of the director appointed in the Musterprotokoll.",
            },
          ],
  },
];

const assurances = [
  [
    "fundsAtFreeDisposal",
    "filing_funds_at_free_disposal",
    "§ 8 Abs. 2 GmbHG",
    "Confirm that the paid funds are definitively at the director's free disposal.",
  ],
  [
    "noDisqualification",
    "filing_no_disqualification",
    "§ 8 Abs. 3, § 6 Abs. 2 Satz 2 Nr. 2 und 3, Satz 3 und 4 GmbHG",
    "Confirm that no statutory disqualification applies to the appointed director.",
  ],
  [
    "instructedOnDisclosure",
    "filing_disclosure_instruction",
    "§ 8 Abs. 3 GmbHG, § 53 Abs. 2 BZRG",
    "Confirm that the director was instructed about the unlimited duty to disclose to the court.",
  ],
] as const;

export const registerFilingRules: readonly FilingRule[] = [
  ...checks,
  ...assurances.map(([field, id, legalReference, summary]): FilingCheck => {
    const paths = [`filing.${field}`];
    return {
      id,
      legalReference,
      summary,
      paths,
      check: ({ filing }) =>
        filing[field] === true ? [] : [{ paths, message: summary }],
    };
  }),
].map((rule) => ({
  ...rule,
  templateId: registerFilingMetadata.id,
  severity: "error",
}));
