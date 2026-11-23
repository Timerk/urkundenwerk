import type { z } from "zod";
import { daysBetween, hasReachedAge } from "../../rules/dates";
import type { Finding, Rule, RuleContext } from "../../rules/types";
import type { MusterprotokollCandidate } from "./draft";
import { musterprotokollMetadata } from "./metadata";
import { musterprotokollSchema } from "./schema";

/*
 * Consistency rules for the single-founder Musterprotokoll (ADR-0006).
 *
 * Every rule reads a normalised, possibly incomplete draft and reports only
 * what its inputs already show, so the builder can show a rule as soon as the
 * values it compares exist. The schema checks structure; these rules check
 * required values and the law. Messages and summaries are deterministic; an
 * LLM may explain an issue later but never decides one (ADR-0002).
 */

type Input = MusterprotokollCandidate;

export type MusterprotokollRuleCode =
  | "field_required"
  | "field_invalid"
  | "company_legal_form_suffix"
  | "share_capital_whole_euros"
  | "gmbh_capital_minimum"
  | "ug_capital_below_gmbh_minimum"
  | "ug_contribution_full"
  | "contribution_minimum_payment"
  | "director_founder_natural_person"
  | "director_full_age"
  | "birth_date_not_in_future"
  | "founder_minor"
  | "notarisation_date_plausible"
  | "company_purpose_specific"
  | "formation_costs_capped";

type MusterprotokollRule = Rule<Input, MusterprotokollRuleCode>;

const templateId = musterprotokollMetadata.id;

/** § 5 Abs. 1 GmbHG */
export const MINIMUM_GMBH_CAPITAL_CENTS = 2_500_000;
/** § 7 Abs. 2 GmbHG for the single cash share of the Musterprotokoll. */
export function gmbhMinimumPaymentCents(capitalCents: number): number {
  return Math.max(Math.ceil(capitalCents / 4), MINIMUM_GMBH_CAPITAL_CENTS / 2);
}
/** Clause 5 of the Musterprotokoll caps the formation costs the company bears. */
export const FORMATION_COST_CAP_CENTS = 30_000;
/** Age of majority under § 2 BGB. */
export const FULL_AGE_YEARS = 18;
/** How far a notarisation date may lie from today before it is questioned. */
export const NOTARISATION_PAST_DAYS = 30;
export const NOTARISATION_FUTURE_DAYS = 365;

// ---------------------------------------------------------------------------
// Legal form
// ---------------------------------------------------------------------------

// § 4 GmbHG requires the designation or an understandable abbreviation; the
// check expects it at the end of the Firma, where registry practice puts it.
const gmbhSuffix = /(?:^|\s)(?:GmbH|Gesellschaft mit beschränkter Haftung)$/u;
const ugSuffix =
  /(?:^|\s)(?:UG|Unternehmergesellschaft) \(haftungsbeschränkt\)$/u;

export type LegalForm = "GmbH" | "UG";

/** The legal form named by the Firma's suffix, if it names one. */
export function legalFormOf(name: string | undefined): LegalForm | undefined {
  const firma = name?.trim();
  if (!firma) return undefined;
  if (ugSuffix.test(firma)) return "UG";
  if (gmbhSuffix.test(firma)) return "GmbH";
  return undefined;
}

// ---------------------------------------------------------------------------
// Required and well-formed values, derived from the schema
// ---------------------------------------------------------------------------

function valueAt(input: Input, path: readonly PropertyKey[]): unknown {
  let value: unknown = input;
  for (const key of path) {
    if (value === null || typeof value !== "object") return undefined;
    value = (value as Record<PropertyKey, unknown>)[key];
  }
  return value;
}

function structuralMessage(issue: z.core.$ZodIssue): string {
  switch (issue.code) {
    case "invalid_value":
    case "invalid_union":
      return "Choose one of the options.";
    case "invalid_type":
      return "Required to complete the deed.";
    case "too_small":
    case "too_big":
      return issue.path.join(".") === "shareCapitalCents"
        ? "Enter an amount between 1 € and 999.999.999 €."
        : "Required to complete the deed.";
    case "invalid_format":
      return "Enter a valid date.";
    default:
      return "Check this value.";
  }
}

// The two schema rules share one parse per input.
const structuralCache = new WeakMap<Input, z.core.$ZodIssue[]>();

function structuralIssues(input: Input): z.core.$ZodIssue[] {
  let issues = structuralCache.get(input);
  if (!issues) {
    const result = musterprotokollSchema.safeParse(input);
    issues = result.success ? [] : result.error.issues;
    structuralCache.set(input, issues);
  }
  return issues;
}

function schemaFindings(input: Input, missing: boolean): Finding[] {
  return structuralIssues(input)
    .filter((issue) => (valueAt(input, issue.path) === undefined) === missing)
    .map((issue) => ({
      paths: [issue.path.join(".")],
      message: structuralMessage(issue),
    }));
}

const fieldRequired: MusterprotokollRule = {
  id: "field_required",
  templateId,
  severity: "error",
  legalReference: "§ 2 Abs. 1a GmbHG, Anlage 1 a) GmbHG",
  summary:
    "The Musterprotokoll must be completed with every value its wording requires before it can be used.",
  paths: [],
  check: (input) => schemaFindings(input, true),
};

const fieldInvalid: MusterprotokollRule = {
  id: "field_invalid",
  templateId,
  severity: "error",
  legalReference: "§ 2 Abs. 1a GmbHG, Anlage 1 a) GmbHG",
  summary:
    "Every value in the Musterprotokoll must have the expected form, such as a valid date or an amount within range.",
  paths: [],
  check: (input) => schemaFindings(input, false),
};

// ---------------------------------------------------------------------------
// Company and capital
// ---------------------------------------------------------------------------

const companyLegalFormSuffix: MusterprotokollRule = {
  id: "company_legal_form_suffix",
  templateId,
  severity: "error",
  legalReference: "§ 4 Satz 1, § 5a Abs. 1 GmbHG",
  summary:
    "The Firma must carry the legal form: “GmbH” or “Gesellschaft mit beschränkter Haftung”, or for a UG “UG (haftungsbeschränkt)” or “Unternehmergesellschaft (haftungsbeschränkt)”.",
  paths: ["company.name"],
  check: ({ company }) =>
    company?.name && !legalFormOf(company.name)
      ? [
          {
            paths: ["company.name"],
            message: "End the Firma with “GmbH” or “UG (haftungsbeschränkt)”.",
          },
        ]
      : [],
};

const shareCapitalWholeEuros: MusterprotokollRule = {
  id: "share_capital_whole_euros",
  templateId,
  severity: "error",
  legalReference: "§ 5 Abs. 2 Satz 1 GmbHG",
  summary:
    "The nominal amount of each share must be in whole euros; the Musterprotokoll has one share covering the whole Stammkapital.",
  paths: ["shareCapitalCents"],
  check: ({ shareCapitalCents: cents }) =>
    cents !== undefined && cents % 100 !== 0
      ? [{ paths: ["shareCapitalCents"], message: "Use whole euros." }]
      : [],
};

const gmbhCapitalMinimum: MusterprotokollRule = {
  id: "gmbh_capital_minimum",
  templateId,
  severity: "error",
  legalReference: "§ 5 Abs. 1 GmbHG",
  summary:
    "A GmbH needs a Stammkapital of at least 25,000 euros; below that, the company must be founded as a UG (haftungsbeschränkt).",
  paths: ["shareCapitalCents", "company.name"],
  check: ({ company, shareCapitalCents: cents }) =>
    legalFormOf(company?.name) === "GmbH" &&
    cents !== undefined &&
    cents < MINIMUM_GMBH_CAPITAL_CENTS
      ? [
          {
            paths: ["shareCapitalCents", "company.name"],
            params: {
              shareCapitalCents: cents,
              minimumCents: MINIMUM_GMBH_CAPITAL_CENTS,
            },
            message: "A GmbH needs a Stammkapital of at least 25.000 €.",
          },
        ]
      : [],
};

const ugCapitalBelowGmbhMinimum: MusterprotokollRule = {
  id: "ug_capital_below_gmbh_minimum",
  templateId,
  severity: "error",
  legalReference: "§ 5a Abs. 1 GmbHG",
  summary:
    "Only a company founded with less than 25,000 euros Stammkapital is a UG (haftungsbeschränkt); with more, it must be named a GmbH.",
  paths: ["shareCapitalCents", "company.name"],
  check: ({ company, shareCapitalCents: cents }) =>
    legalFormOf(company?.name) === "UG" &&
    cents !== undefined &&
    cents >= MINIMUM_GMBH_CAPITAL_CENTS
      ? [
          {
            paths: ["shareCapitalCents", "company.name"],
            params: {
              shareCapitalCents: cents,
              minimumCents: MINIMUM_GMBH_CAPITAL_CENTS,
            },
            message:
              "A UG (haftungsbeschränkt) has less than 25.000 € Stammkapital. From 25.000 € on, found a GmbH instead.",
          },
        ]
      : [],
};

const ugContributionFull: MusterprotokollRule = {
  id: "ug_contribution_full",
  templateId,
  severity: "error",
  legalReference: "§ 5a Abs. 2 Satz 1 GmbHG",
  summary:
    "A UG (haftungsbeschränkt) may only be registered once its Stammkapital is paid in full.",
  paths: ["contribution", "company.name"],
  check: ({ company, contribution }) =>
    legalFormOf(company?.name) === "UG" && contribution === "half"
      ? [
          {
            paths: ["contribution", "company.name"],
            message:
              "A UG (haftungsbeschränkt) must be paid in full before registration (§ 5a Abs. 2 GmbHG).",
          },
        ]
      : [],
};

const contributionMinimumPayment: MusterprotokollRule = {
  id: "contribution_minimum_payment",
  templateId,
  severity: "error",
  legalReference: "§ 7 Abs. 2 GmbHG",
  summary:
    "Before registration, at least a quarter of each share and in total at least half of the minimum Stammkapital (12,500 euros) must be paid in cash.",
  paths: ["contribution", "shareCapitalCents"],
  check: ({ company, contribution, shareCapitalCents: cents }) => {
    // A UG is paid in full under § 5a Abs. 2, which displaces § 7 Abs. 2.
    if (legalFormOf(company?.name) === "UG") return [];
    if (contribution !== "half" || cents === undefined) return [];
    const dueNowCents = Math.floor(cents / 2);
    const requiredCents = gmbhMinimumPaymentCents(cents);
    return dueNowCents < requiredCents
      ? [
          {
            paths: ["contribution", "shareCapitalCents"],
            params: { dueNowCents, requiredCents },
            message:
              "Paying 50 % now does not reach the 12.500 € that must be paid before registration. Choose payment in full.",
          },
        ]
      : [];
  },
};

const formationCostsCapped: MusterprotokollRule = {
  id: "formation_costs_capped",
  templateId,
  severity: "info",
  legalReference: "Anlage 1 a) GmbHG, Nr. 5",
  summary:
    "Clause 5 lets the company bear formation costs up to 300 euros, but never more than its Stammkapital; the founder bears the rest.",
  paths: ["shareCapitalCents"],
  check: ({ shareCapitalCents: cents }) =>
    cents !== undefined && cents < FORMATION_COST_CAP_CENTS
      ? [
          {
            paths: ["shareCapitalCents"],
            params: {
              shareCapitalCents: cents,
              costCapCents: FORMATION_COST_CAP_CENTS,
            },
            message:
              "With less than 300 € Stammkapital, the company bears formation costs only up to the Stammkapital (clause 5). The founder bears the rest.",
          },
        ]
      : [],
};

// Lower case, without a leading article or final full stop.
function normalisePurpose(purpose: string): string {
  return purpose
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.\s]+$/, "")
    .replace(/^(?:die|der|das) /, "");
}

/**
 * Purposes that registry courts commonly reject as not specific enough. The
 * list is deliberately short; it catches the stock phrases, not every case.
 */
export const GENERIC_PURPOSES: readonly string[] = [
  "handel mit waren aller art",
  "handel mit waren",
  "handel aller art",
  "vertrieb von waren aller art",
  "herstellung und vertrieb von waren aller art",
  "erbringung von dienstleistungen aller art",
  "dienstleistungen aller art",
  "geschäfte aller art",
  "jede gesetzlich zulässige tätigkeit",
  "jede gesetzlich zulässige geschäftstätigkeit",
  "betrieb von geschäften aller art",
];

const companyPurposeSpecific: MusterprotokollRule = {
  id: "company_purpose_specific",
  templateId,
  severity: "warning",
  legalReference: "§ 3 Abs. 1 Nr. 2 GmbHG",
  summary:
    "The Unternehmensgegenstand must show the main area of business; registry courts reject stock phrases that would fit any company.",
  paths: ["company.purpose"],
  check: ({ company }) =>
    company?.purpose &&
    GENERIC_PURPOSES.includes(normalisePurpose(company.purpose))
      ? [
          {
            paths: ["company.purpose"],
            message:
              "This Unternehmensgegenstand is likely too general for the register court. Name the goods or services, for example “der Handel mit Fahrrädern und Zubehör”.",
          },
        ]
      : [],
};

// ---------------------------------------------------------------------------
// Persons and dates
// ---------------------------------------------------------------------------

/** The date the deed is notarised, or today if the date is still open. */
function notarisationDay(input: Input, context: RuleContext): string {
  return input.notarisation?.date ?? context.referenceDate;
}

function founderBirthDate(input: Input): string | undefined {
  return input.founder?.kind === "natural_person"
    ? input.founder.birthDate
    : undefined;
}

const directorFounderNaturalPerson: MusterprotokollRule = {
  id: "director_founder_natural_person",
  templateId,
  severity: "error",
  legalReference: "§ 6 Abs. 2 Satz 1 GmbHG",
  summary:
    "Only a natural person can be Geschäftsführer, so a founder that is a legal entity must appoint someone else.",
  paths: ["managingDirector.kind", "founder.kind"],
  check: ({ founder, managingDirector }) =>
    managingDirector?.kind === "founder" && founder?.kind === "legal_entity"
      ? [
          {
            paths: ["managingDirector.kind", "founder.kind"],
            message:
              "Only a natural person can be Geschäftsführer. Appoint another person.",
          },
        ]
      : [],
};

const directorFullAge: MusterprotokollRule = {
  id: "director_full_age",
  templateId,
  severity: "error",
  legalReference: "§ 6 Abs. 2 Satz 1 GmbHG, §§ 2, 106 BGB",
  summary:
    "A Geschäftsführer must have unrestricted legal capacity, which a minor never has; the person must be 18 by the date of notarisation.",
  paths: ["managingDirector.birthDate", "founder.birthDate"],
  check: (input, context) => {
    const director = input.managingDirector;
    const [birthDate, paths] =
      director?.kind === "other"
        ? [director.birthDate, ["managingDirector.birthDate"]]
        : director?.kind === "founder"
          ? [
              founderBirthDate(input),
              ["founder.birthDate", "managingDirector.kind"],
            ]
          : [undefined, []];
    // A date of birth in the future is reported by its own rule.
    if (!birthDate || birthDate > context.referenceDate) return [];
    const day = notarisationDay(input, context);
    return hasReachedAge(birthDate, FULL_AGE_YEARS, day)
      ? []
      : [
          {
            paths,
            params: {
              minimumAge: FULL_AGE_YEARS,
              notarisationDateGiven: input.notarisation?.date !== undefined,
            },
            message:
              "The Geschäftsführer must be at least 18 on the date of notarisation (§ 6 Abs. 2 GmbHG).",
          },
        ];
  },
};

const founderMinor: MusterprotokollRule = {
  id: "founder_minor",
  templateId,
  severity: "warning",
  legalReference: "§§ 1629, 1643 Abs. 1, 1852 Nr. 2 BGB",
  summary:
    "A founder under 18 is represented by their legal representatives, and a company agreement for running a business may need the approval of the family court.",
  paths: ["founder.birthDate"],
  check: (input, context) => {
    const birthDate = founderBirthDate(input);
    if (!birthDate || birthDate > context.referenceDate) return [];
    return hasReachedAge(
      birthDate,
      FULL_AGE_YEARS,
      notarisationDay(input, context),
    )
      ? []
      : [
          {
            paths: ["founder.birthDate"],
            params: { minimumAge: FULL_AGE_YEARS },
            message:
              "The founder is under 18. Their legal representatives act for them, and the formation may need the family court's approval.",
          },
        ];
  },
};

const birthDateNotInFuture: MusterprotokollRule = {
  id: "birth_date_not_in_future",
  templateId,
  severity: "error",
  legalReference: "§ 10 Abs. 2 BeurkG",
  summary:
    "The deed must identify each person beyond doubt, and a date of birth in the future cannot be correct.",
  paths: ["founder.birthDate", "managingDirector.birthDate"],
  check: (input, { referenceDate }) => {
    const dates = [
      ["founder.birthDate", founderBirthDate(input)],
      [
        "managingDirector.birthDate",
        input.managingDirector?.kind === "other"
          ? input.managingDirector.birthDate
          : undefined,
      ],
    ] as const;
    return dates.flatMap(([path, date]) =>
      date && date > referenceDate
        ? [
            {
              paths: [path],
              message: "A date of birth cannot lie in the future.",
            },
          ]
        : [],
    );
  },
};

const notarisationDatePlausible: MusterprotokollRule = {
  id: "notarisation_date_plausible",
  templateId,
  severity: "warning",
  legalReference: "§ 9 Abs. 2 BeurkG",
  summary: `The deed should state the day of notarisation; a date more than ${NOTARISATION_PAST_DAYS} days ago or more than a year ahead is probably a typing error.`,
  paths: ["notarisation.date"],
  check: ({ notarisation }, { referenceDate }) => {
    if (!notarisation?.date) return [];
    const days = daysBetween(referenceDate, notarisation.date);
    if (days < -NOTARISATION_PAST_DAYS) {
      return [
        {
          paths: ["notarisation.date"],
          params: { inFuture: false, thresholdDays: NOTARISATION_PAST_DAYS },
          message: `This date lies more than ${NOTARISATION_PAST_DAYS} days in the past. Check it.`,
        },
      ];
    }
    if (days > NOTARISATION_FUTURE_DAYS) {
      return [
        {
          paths: ["notarisation.date"],
          params: { inFuture: true, thresholdDays: NOTARISATION_FUTURE_DAYS },
          message: "This date lies more than a year ahead. Check it.",
        },
      ];
    }
    return [];
  },
};

/** The rules in the order of the deed's sections. */
export const musterprotokollRules: readonly MusterprotokollRule[] = [
  fieldRequired,
  fieldInvalid,
  notarisationDatePlausible,
  birthDateNotInFuture,
  founderMinor,
  companyLegalFormSuffix,
  companyPurposeSpecific,
  shareCapitalWholeEuros,
  gmbhCapitalMinimum,
  ugCapitalBelowGmbhMinimum,
  ugContributionFull,
  contributionMinimumPayment,
  formationCostsCapped,
  directorFounderNaturalPerson,
  directorFullAge,
];
