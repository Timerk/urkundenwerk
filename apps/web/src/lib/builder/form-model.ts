import {
  checkMusterprotokoll,
  type MusterprotokollDraft,
  type MusterprotokollIssue,
  type MusterprotokollRuleCode,
  passes,
  type Severity,
} from "@urkundenwerk/core";

export { legalFormOf, type LegalForm } from "@urkundenwerk/core";

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
// Checks: missing values, invalid values, and the template's rules
// ---------------------------------------------------------------------------

/** Rules that report missing or malformed values rather than the law. */
const FIELD_RULES: ReadonlySet<MusterprotokollRuleCode> = new Set([
  "field_required",
  "field_invalid",
]);

export function isFieldRule(code: MusterprotokollRuleCode): boolean {
  return FIELD_RULES.has(code);
}

/** The issue shown next to one field. */
export type FieldIssue = {
  path: string;
  code: MusterprotokollRuleCode;
  severity: Severity;
  message: string;
};

export type DraftAnalysis = {
  /** No rule reports an error, so the deed can be exported. */
  complete: boolean;
  /** The issue to show per path, errors first and then in form order. */
  issues: Map<string, FieldIssue>;
  /** Paths that still have an error. */
  outstanding: number;
  /** Rule findings about the law rather than single fields, by severity. */
  checks: MusterprotokollIssue[];
};

/**
 * Runs the core rule engine on a draft. Each rule reports as soon as the
 * values it compares exist, so the form can show it next to the field early.
 * `referenceDate` is today's date, computed once on the server.
 */
export function analyseDraft(
  draft: MusterprotokollDraft,
  referenceDate: string,
): DraftAnalysis {
  const all = checkMusterprotokoll(draft, { referenceDate });
  const issues = new Map<string, FieldIssue>();
  // A rule error explains more than "required", so it is placed first.
  const ordered = [
    ...all.filter((i) => i.severity === "error" && !isFieldRule(i.code)),
    ...all.filter((i) => i.severity === "error" && isFieldRule(i.code)),
    ...all.filter((i) => i.severity !== "error"),
  ];
  for (const { code, severity, message, paths } of ordered) {
    const path = paths[0];
    if (path !== undefined && !issues.has(path)) {
      issues.set(path, { path, code, severity, message });
    }
  }
  return {
    complete: passes(all),
    issues: new Map(
      [...issues].sort(([a], [b]) => formOrder(a) - formOrder(b)),
    ),
    outstanding: [...issues.values()].filter((i) => i.severity === "error")
      .length,
    checks: all.filter((issue) => !isFieldRule(issue.code)),
  };
}

// The order of the form's sections, matching the deed.
const SECTION_ORDER = [
  "notarisation.",
  "founder.",
  "company.",
  "shareCapitalCents",
  "contribution",
  "managingDirector.",
  "notaryNotes",
];

function formOrder(path: string): number {
  const index = SECTION_ORDER.findIndex((prefix) => path.startsWith(prefix));
  return index === -1 ? SECTION_ORDER.length : index;
}
