import {
  checkMusterprotokoll,
  getRule,
  type MusterprotokollDraft,
  type MusterprotokollIssue,
  musterprotokollDraftSchema,
  musterprotokollMetadata,
} from "@urkundenwerk/core";
import { z } from "zod";
import { ToolError } from "./errors";
import type { Membership, StoredDocument, TenantRole } from "./store";

/*
 * Domain helpers shared by the tools. They follow the web app's rules so a
 * draft looks the same whichever client wrote it: the limits and defaults
 * match apps/web/src/lib/documents/schemas.ts and lib/builder/form-model.ts.
 */

/** Same limit as the web app; the database allows 64 KiB as a backstop. */
export const MAX_DRAFT_BYTES = 32 * 1024;

export const DEFAULT_DOCUMENT_TITLE = "Untitled Musterprotokoll";

export const documentTitleSchema = z
  .string()
  .trim()
  .min(1, { error: "Enter a title." })
  .max(120, { error: "The title can have at most 120 characters." });

const berlinDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Berlin",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Today's date in Germany as an ISO date, the rules' reference date. */
export function todayInGermany(now: Date = new Date()): string {
  return berlinDate.format(now);
}

// ---------------------------------------------------------------------------
// Firms and roles
// ---------------------------------------------------------------------------

export function canEditDocuments(role: TenantRole): boolean {
  return role === "admin" || role === "editor";
}

function describeFirms(memberships: readonly Membership[]): string {
  return memberships
    .map(({ slug, name, role }) => `"${slug}" (${name}, ${role})`)
    .join(", ");
}

/**
 * Picks the firm a tool works in: the one named by slug or id, or the only
 * one. The choice is checked against the user's memberships; RLS enforces it
 * again on every query.
 */
export function resolveTenant(
  memberships: readonly Membership[],
  tenant: string | undefined,
): Membership {
  if (memberships.length === 0) {
    throw new ToolError(
      "You are not a member of any firm. Create a firm in the Urkundenwerk web app or ask an admin to add you.",
    );
  }
  if (tenant === undefined) {
    if (memberships.length === 1) return memberships[0]!;
    throw new ToolError(
      `You belong to several firms. Pass "tenant" as one of: ${describeFirms(memberships)}.`,
      {
        firms: memberships.map(({ slug, name, role }) => ({
          slug,
          name,
          role,
        })),
      },
    );
  }
  const wanted = tenant.trim().toLowerCase();
  const match = memberships.find(
    ({ tenantId, slug }) => tenantId === wanted || slug === wanted,
  );
  if (!match) {
    throw new ToolError(
      `You are not a member of a firm "${tenant}". Your firms: ${describeFirms(memberships)}.`,
    );
  }
  return match;
}

export function membershipFor(
  memberships: readonly Membership[],
  tenantId: string,
): Membership | undefined {
  return memberships.find((membership) => membership.tenantId === tenantId);
}

// ---------------------------------------------------------------------------
// Drafts
// ---------------------------------------------------------------------------

/** Choices every new Musterprotokoll starts from, as in the web builder. */
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

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Merges a patch into a draft. Objects merge key by key at every depth; any
 * other value, including `null` (a valid "no salutation"), replaces the old
 * one. Keys are removed only through `unset`.
 */
export function mergeDraft(base: unknown, patch: unknown): unknown {
  if (!isObject(base) || !isObject(patch)) return patch;
  const result: JsonObject = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    result[key] = mergeDraft(base[key], value);
  }
  return result;
}

/** Removes the value at a dot-separated path. Empty parent objects are kept. */
export function unsetPath(draft: unknown, path: string): unknown {
  const [key, ...rest] = path.split(".");
  if (!key || !isObject(draft) || !Object.hasOwn(draft, key)) return draft;
  const result: JsonObject = { ...draft };
  if (rest.length === 0) delete result[key];
  else result[key] = unsetPath(draft[key], rest.join("."));
  return result;
}

function jsonByteLength(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value) ?? "").length;
}

function zodIssues(error: z.ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    code: issue.code,
    message: issue.message,
  }));
}

/** Validates draft data with the core draft schema and the size limit. */
export function parseDraft(value: unknown): MusterprotokollDraft {
  if (jsonByteLength(value) > MAX_DRAFT_BYTES) {
    throw new ToolError(
      `The draft exceeds ${MAX_DRAFT_BYTES / 1024} KiB of JSON. Shorten long text fields.`,
    );
  }
  const result = musterprotokollDraftSchema.safeParse(value);
  if (!result.success) {
    throw new ToolError(
      "The draft data does not match the Musterprotokoll draft schema. Fix the listed paths; the schema is the urkundenwerk://templates/musterprotokoll-einpersonen/draft-schema resource.",
      { issues: zodIssues(result.error) },
    );
  }
  return result.data;
}

/** Documents of other templates or versions are not handled by these tools yet. */
export function assertSupportedTemplate(document: StoredDocument): void {
  if (
    document.templateId !== musterprotokollMetadata.id ||
    document.templateVersion !== musterprotokollMetadata.version
  ) {
    throw new ToolError(
      `This document uses template ${document.templateId}@${document.templateVersion}, which the MCP server does not support yet. Open it in the web app.`,
    );
  }
}

/** The stored draft, or a tool error if the stored data no longer parses. */
export function storedDraft(document: StoredDocument): MusterprotokollDraft {
  assertSupportedTemplate(document);
  const result = musterprotokollDraftSchema.safeParse(document.data);
  if (!result.success) {
    throw new ToolError(
      "The stored data is not a valid draft. Correct it with urkundenwerk_update_draft or in the web app.",
      { issues: zodIssues(result.error) },
    );
  }
  return result.data;
}

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

export type ReportedIssue = {
  code: string;
  severity: MusterprotokollIssue["severity"];
  paths: string[];
  message: string;
  legalReference: string | null;
};

export function reportIssues(
  issues: readonly MusterprotokollIssue[],
): ReportedIssue[] {
  return issues.map((issue) => ({
    code: issue.code,
    severity: issue.severity,
    paths: [...issue.paths],
    message: issue.message,
    legalReference:
      getRule(musterprotokollMetadata.id, issue.code)?.legalReference ?? null,
  }));
}

export type Completeness = {
  /** No rule reports an error, so the document can be exported. */
  ready: boolean;
  /** Fields that still have an error, counted as in the web builder. */
  outstandingFields: number;
  errors: number;
  warnings: number;
  notes: number;
};

export function completenessOf(
  issues: readonly MusterprotokollIssue[],
): Completeness {
  const errors = issues.filter((issue) => issue.severity === "error");
  const fields = new Set(
    errors.map((issue) => issue.paths[0]).filter((path) => path !== undefined),
  );
  return {
    ready: errors.length === 0,
    outstandingFields: fields.size,
    errors: errors.length,
    warnings: issues.filter((issue) => issue.severity === "warning").length,
    notes: issues.filter((issue) => issue.severity === "info").length,
  };
}

export function checkDraft(
  draft: MusterprotokollDraft,
  referenceDate: string,
): MusterprotokollIssue[] {
  return checkMusterprotokoll(draft, { referenceDate });
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

const TRANSLITERATIONS: Record<string, string> = {
  ä: "ae",
  ö: "oe",
  ü: "ue",
  Ä: "Ae",
  Ö: "Oe",
  Ü: "Ue",
  ß: "ss",
};

/** An ASCII-only filename, built as in the web app's export route. */
export function exportFilename(title: string, format: "pdf" | "docx"): string {
  const base = title
    .replace(/[äöüÄÖÜß]/g, (char) => TRANSLITERATIONS[char] ?? "")
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/, "");
  return `Musterprotokoll${base ? `-${base}` : ""}.${format}`;
}
