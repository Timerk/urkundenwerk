import {
  formatEuroAmount,
  formatGermanDate,
  type MusterprotokollDraft,
} from "@urkundenwerk/core";
import {
  type ExtractionFieldPath,
  type FieldReview,
  fieldKind,
  isFieldValue,
} from "@urkundenwerk/extraction/contract";
import { parseEuros, setAt } from "../builder/form-model";

// The review screen's state, kept free of React so it can be tested alone.

/** What the user decided for one extracted value. */
export type Decision =
  | { kind: "pending" }
  | { kind: "accepted" }
  | { kind: "edited"; value: string | number }
  | { kind: "cleared" };

export type Decisions = Partial<Record<ExtractionFieldPath, Decision>>;

/** The sections of the builder, in the deed's order. */
export const REVIEW_SECTIONS = [
  { id: "notarisation", title: "Notarisation", prefix: "notarisation." },
  { id: "founder", title: "Founder (Gesellschafter)", prefix: "founder." },
  { id: "company", title: "Company", prefix: "company." },
  {
    id: "capital",
    title: "Capital",
    prefix: ["shareCapitalCents", "contribution"],
  },
  {
    id: "director",
    title: "Geschäftsführer (managing director)",
    prefix: "managingDirector.",
  },
  { id: "notes", title: "Notary's notes", prefix: ["notaryNotes"] },
] as const;

export function sectionOf(path: ExtractionFieldPath): string {
  return REVIEW_SECTIONS.find(({ prefix }) =>
    typeof prefix === "string"
      ? path.startsWith(prefix)
      : (prefix as readonly string[]).includes(path),
  )!.id;
}

const OPTION_LABELS: Record<string, Record<string, string>> = {
  "notarisation.mode": { in_person: "In person", video: "By video" },
  "founder.kind": {
    natural_person: "Natural person",
    legal_entity: "Legal entity",
  },
  contribution: {
    full: "In full, immediately",
    half: "50 % now, the rest when called in",
  },
  "managingDirector.kind": { founder: "The founder", other: "Another person" },
};

/** The options of an enum field with their labels. */
export function fieldOptions(
  path: ExtractionFieldPath,
): { value: string; label: string }[] {
  const kind = fieldKind(path);
  if (kind.type !== "enum") return [];
  return kind.values.map((value) => ({
    value,
    label: OPTION_LABELS[path]?.[value] ?? value,
  }));
}

/** A value as the review screen shows it, in the builder's conventions. */
export function formatValue(
  path: ExtractionFieldPath,
  value: string | number,
): string {
  const kind = fieldKind(path);
  if (kind.type === "amount" && typeof value === "number") {
    return formatEuroAmount(value);
  }
  if (kind.type === "date" && typeof value === "string") {
    return formatGermanDate(value);
  }
  if (kind.type === "enum") {
    return OPTION_LABELS[path]?.[String(value)] ?? String(value);
  }
  return String(value);
}

/** The text an edit control starts with for a value. */
export function editText(
  path: ExtractionFieldPath,
  value: string | number | null,
): string {
  if (value === null) return "";
  if (fieldKind(path).type === "amount" && typeof value === "number") {
    return String(Math.floor(value / 100)).replace(
      /\B(?=(\d{3})+(?!\d))/g,
      ".",
    );
  }
  return String(value);
}

export type EditResult =
  { ok: true; value: string | number } | { ok: false; message: string };

/** Reads an edited value and checks it against the draft field's schema. */
export function parseEdit(path: ExtractionFieldPath, text: string): EditResult {
  const kind = fieldKind(path);
  let value: string | number;
  if (kind.type === "amount") {
    const euros = parseEuros(text);
    if (euros.kind === "empty") {
      return { ok: false, message: "Enter an amount, or clear the value." };
    }
    if (euros.kind === "invalid") return { ok: false, message: euros.message };
    value = euros.cents;
  } else {
    value = text.trim();
    if (!value) {
      return { ok: false, message: "Enter a value, or clear it instead." };
    }
  }
  if (!isFieldValue(path, value)) {
    return {
      ok: false,
      message:
        kind.type === "date"
          ? "Enter a valid date."
          : "This value is not valid for the field.",
    };
  }
  return { ok: true, value };
}

/** Every extracted value starts undecided; absent fields need no decision. */
export function initialDecisions(fields: readonly FieldReview[]): Decisions {
  return Object.fromEntries(
    fields
      .filter(({ status }) => status !== "absent")
      .map(({ path }) => [path, { kind: "pending" }]),
  );
}

/** Accepts every verified value that is still undecided. */
export function acceptAllVerified(
  fields: readonly FieldReview[],
  decisions: Decisions,
): Decisions {
  const next = { ...decisions };
  for (const field of fields) {
    if (field.status === "verified" && next[field.path]?.kind === "pending") {
      next[field.path] = { kind: "accepted" };
    }
  }
  return next;
}

/** Fields that still need a decision, in form order. */
export function pendingFields(
  fields: readonly FieldReview[],
  decisions: Decisions,
): FieldReview[] {
  return fields.filter(({ path }) => decisions[path]?.kind === "pending");
}

/** The value a decision puts into the draft, or `undefined` for none. */
export function decidedValue(
  field: FieldReview,
  decision: Decision | undefined,
): string | number | undefined {
  if (decision?.kind === "edited") return decision.value;
  if (decision?.kind === "accepted" && field.value !== null) return field.value;
  return undefined;
}

/** The draft that confirming creates: accepted and edited values only. */
export function draftFromDecisions(
  fields: readonly FieldReview[],
  decisions: Decisions,
): MusterprotokollDraft {
  let draft: MusterprotokollDraft = {};
  for (const field of fields) {
    const value = decidedValue(field, decisions[field.path]);
    if (value !== undefined) draft = setAt(draft, field.path, value);
  }
  return draft;
}
