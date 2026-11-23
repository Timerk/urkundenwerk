import {
  draftToInput,
  musterprotokollSchema,
  type MusterprotokollDraft,
  type MusterprotokollRuleCode,
  parseDraftAsInput,
} from "@urkundenwerk/core";
import type { z } from "zod";

// ---------------------------------------------------------------------------
// Reading and writing draft values by path
// ---------------------------------------------------------------------------

type Json = { [key: string]: unknown };

export function getAt(draft: MusterprotokollDraft, path: string): unknown {
  let value: unknown = draft;
  for (const key of path.split(".")) {
    if (value === null || typeof value !== "object") return undefined;
    value = (value as Json)[key];
  }
  return value;
}

/**
 * Returns a copy of the draft with the value at `path` replaced. Empty text
 * and `undefined` remove the key, so the stored draft holds only answers.
 */
export function setAt(
  draft: MusterprotokollDraft,
  path: string,
  value: unknown,
): MusterprotokollDraft {
  const [key, ...rest] = path.split(".");
  if (!key) return draft;
  const current = draft as Json;
  const next: Json = { ...current };
  if (rest.length > 0) {
    const child =
      current[key] && typeof current[key] === "object"
        ? (current[key] as MusterprotokollDraft)
        : {};
    next[key] = setAt(child, rest.join("."), value);
  } else if (value === undefined || value === "") {
    delete next[key];
  } else {
    next[key] = value;
  }
  return next as MusterprotokollDraft;
}

/** Choices that every new Musterprotokoll starts from. */
export function withDefaults(
  draft: MusterprotokollDraft,
): MusterprotokollDraft {
  return {
    ...draft,
    notarisation: { mode: "in_person", ...draft.notarisation },
    founder: { kind: "natural_person", ...draft.founder },
    managingDirector: { kind: "founder", ...draft.managingDirector },
  };
}

// ---------------------------------------------------------------------------
// Stammkapital in whole euros
// ---------------------------------------------------------------------------

const MAX_EUROS = 999_999_999;

export type EuroParse =
  | { kind: "empty" }
  | { kind: "valid"; cents: number }
  | { kind: "invalid"; message: string };

/** Parses whole euros as typed in Germany, e.g. `25.000`, `25 000 €`, `25000,00`. */
export function parseEuros(text: string): EuroParse {
  const value = text.replace(/\s*€\s*$/, "").trim();
  if (value === "") return { kind: "empty" };
  const match = /^(\d{1,3}(?:[. ]\d{3})+|\d+)(?:,0{1,2})?$/.exec(value);
  if (!match) {
    return {
      kind: "invalid",
      message: "Enter whole euros, for example 25.000.",
    };
  }
  const euros = Number(match[1]!.replace(/[. ]/g, ""));
  if (euros < 1 || euros > MAX_EUROS) {
    return {
      kind: "invalid",
      message: "Enter an amount between 1 € and 999.999.999 €.",
    };
  }
  return { kind: "valid", cents: euros * 100 };
}

/** Formats cents as whole euros with German thousands separators. */
export function formatEuros(cents: number | undefined): string {
  if (cents === undefined) return "";
  return String(Math.floor(cents / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

// ---------------------------------------------------------------------------
// Validation: missing values, invalid values, and the template's rules
// ---------------------------------------------------------------------------

export type FieldIssue = {
  path: string;
  code: string;
  rule?: MusterprotokollRuleCode;
  message: string;
};

const RULE_MESSAGES: Record<MusterprotokollRuleCode, string> = {
  company_legal_form_suffix:
    "End the Firma with “GmbH” or “UG (haftungsbeschränkt)”.",
  share_capital_whole_euros: "Use whole euros.",
  gmbh_capital_minimum: "A GmbH needs a Stammkapital of at least 25.000 €.",
  ug_capital_below_gmbh_minimum:
    "A UG (haftungsbeschränkt) has less than 25.000 € Stammkapital. From 25.000 € on, found a GmbH instead.",
  ug_contribution_full:
    "A UG (haftungsbeschränkt) must be paid in full before registration (§ 5a Abs. 2 GmbHG).",
  director_founder_natural_person:
    "Only a natural person can be Geschäftsführer. Appoint another person.",
};

/** Maps a Zod issue from the core schema to a message for the form. */
export function issueMessage(issue: z.core.$ZodIssue): string {
  const rule = issue.code === "custom" ? issue.params?.rule : undefined;
  if (typeof rule === "string" && rule in RULE_MESSAGES) {
    return RULE_MESSAGES[rule as MusterprotokollRuleCode];
  }
  const path = issue.path.join(".");
  switch (issue.code) {
    case "invalid_value":
    case "invalid_union":
      return "Choose one of the options.";
    case "invalid_type":
      return "Required to complete the deed.";
    case "too_small":
    case "too_big":
      return path === "shareCapitalCents"
        ? "Enter an amount between 1 € and 999.999.999 €."
        : "Required to complete the deed.";
    case "invalid_format":
      return "Enter a valid date.";
    default:
      return "Check this value.";
  }
}

function toFieldIssue(issue: z.core.$ZodIssue): FieldIssue {
  const rule = issue.code === "custom" ? issue.params?.rule : undefined;
  return {
    path: issue.path.join("."),
    code: issue.code,
    ...(typeof rule === "string"
      ? { rule: rule as MusterprotokollRuleCode }
      : {}),
    message: issueMessage(issue),
  };
}

// Complete fictional values for every field of both alternatives. Merged under
// a draft, they let the core schema check its cross-field rules early, before
// everything else has been filled in.
const PROBE_BASE = {
  notarisation: { mode: "in_person" },
  founder: {
    kind: "natural_person",
    salutation: null,
    firstName: "Probe",
    lastName: "Probe",
    birthDate: "1990-01-01",
    address: { street: "Probe 1", postalCode: "00000", city: "Probe" },
    name: "Probe",
    registerCourt: "Probe",
    registerNumber: "Probe",
    seat: "Probe",
  },
  company: { name: "Probe GmbH", seat: "Probe", purpose: "Probe" },
  shareCapitalCents: 2_500_000,
  contribution: "full",
  managingDirector: {
    kind: "founder",
    salutation: null,
    firstName: "Probe",
    lastName: "Probe",
    birthDate: "1990-01-01",
    residence: "Probe",
  },
};

// A rule is only reported once the user has given every value it compares.
const RULE_INPUTS: Record<MusterprotokollRuleCode, string[]> = {
  company_legal_form_suffix: ["company.name"],
  share_capital_whole_euros: ["shareCapitalCents"],
  gmbh_capital_minimum: ["company.name", "shareCapitalCents"],
  ug_capital_below_gmbh_minimum: ["company.name", "shareCapitalCents"],
  ug_contribution_full: ["company.name", "contribution"],
  director_founder_natural_person: ["founder.kind", "managingDirector.kind"],
};

function mergeUnder(base: Json, overrides: Json): Json {
  const merged: Json = { ...base };
  for (const [key, value] of Object.entries(overrides)) {
    const below = base[key];
    merged[key] =
      value && typeof value === "object" && below && typeof below === "object"
        ? mergeUnder(below as Json, value as Json)
        : value;
  }
  return merged;
}

/** Cross-field rule violations among the values the user has given so far. */
export function ruleIssues(draft: MusterprotokollDraft): FieldIssue[] {
  const given = draftToInput(draft) as Json;
  const result = musterprotokollSchema.safeParse(mergeUnder(PROBE_BASE, given));
  if (result.success) return [];
  return result.error.issues
    .filter((issue) => issue.code === "custom")
    .map(toFieldIssue)
    .filter(
      (issue) =>
        issue.rule !== undefined &&
        RULE_INPUTS[issue.rule].every(
          (path) => getAt(given as MusterprotokollDraft, path) !== undefined,
        ),
    );
}

export type LegalForm = "GmbH" | "UG";

/**
 * The legal form named by the Firma's suffix, as the core schema reads it.
 * It asks the schema instead of repeating its suffix patterns.
 */
export function legalFormOf(name: string | undefined): LegalForm | undefined {
  if (!name?.trim()) return undefined;
  const issues = ruleIssues({
    company: { name },
    shareCapitalCents: 100,
    contribution: "full",
  });
  if (issues.some((issue) => issue.rule === "company_legal_form_suffix")) {
    return undefined;
  }
  return issues.some((issue) => issue.rule === "gmbh_capital_minimum")
    ? "GmbH"
    : "UG";
}

export type DraftAnalysis = {
  complete: boolean;
  /** The first issue per path, in form order. */
  issues: Map<string, FieldIssue>;
  /** Paths still to fill in or correct. */
  outstanding: number;
};

/** Validates a draft with the full schema plus early rule checks. */
export function analyseDraft(draft: MusterprotokollDraft): DraftAnalysis {
  const result = parseDraftAsInput(draft);
  const issues = new Map<string, FieldIssue>();
  if (!result.success) {
    for (const issue of result.error.issues.map(toFieldIssue)) {
      if (!issues.has(issue.path)) issues.set(issue.path, issue);
    }
  }
  for (const issue of ruleIssues(draft)) {
    issues.set(issue.path, issue);
  }
  return {
    complete: result.success,
    issues,
    outstanding: issues.size,
  };
}
