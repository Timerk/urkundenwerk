import { z } from "zod";

/*
 * Turns stored audit events into what the activity panel and the audit page
 * show. Kept free of React and Supabase so it can be tested alone. Metadata
 * comes from the database, so it is parsed here like any external data; an
 * event whose metadata does not match is still shown, without details.
 */

export const AUDIT_ACTIONS = [
  "document.created",
  "document.updated",
  "document.deleted",
  "document.exported",
  "document.imported",
  "membership.added",
  "membership.role_changed",
  "membership.removed",
  "tenant.renamed",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const auditActionSchema = z.enum(AUDIT_ACTIONS);

const roleSchema = z.enum(["admin", "editor", "viewer"]);
export type AuditRole = z.infer<typeof roleSchema>;
const statusSchema = z.enum(["draft", "final"]);
const countsSchema = z.object({
  accepted: z.number(),
  edited: z.number(),
  cleared: z.number(),
});

const metadataSchemas = {
  "document.created": z.object({
    templateVersion: z.string().optional(),
  }),
  "document.updated": z.object({
    fields: z.array(z.string()).default([]),
    fieldsTruncated: z.boolean().optional(),
    status: z.object({ from: statusSchema, to: statusSchema }).optional(),
  }),
  "document.deleted": z.object({}),
  "document.exported": z.object({
    format: z.enum(["pdf", "docx", "xml"]),
    document: z.enum(["musterprotokoll", "anmeldung"]),
    templateVersion: z.string().optional(),
  }),
  "document.imported": z.object({
    model: z.string(),
    promptVersion: z.string(),
    counts: z.object({
      verified: countsSchema,
      unverified: countsSchema,
      absent: countsSchema,
    }),
  }),
  "membership.added": z.object({ role: roleSchema }),
  "membership.role_changed": z.object({ from: roleSchema, to: roleSchema }),
  "membership.removed": z.object({
    role: roleSchema,
    reason: z.literal("account_deleted").optional(),
  }),
  "tenant.renamed": z.object({}),
} satisfies Record<AuditAction, z.ZodType>;

type Details = {
  [A in AuditAction]: z.infer<(typeof metadataSchemas)[A]>;
};

/** A stored row as the Data API returns it. */
export type AuditEventRow = {
  id: string;
  action: string;
  actor_id: string | null;
  subject_user_id: string | null;
  entity_type: string;
  entity_id: string | null;
  occurred_at: string;
  metadata: unknown;
};

/** A colleague from `list_tenant_members`. */
export type Person = {
  userId: string;
  displayName: string | null;
  email: string | null;
};

/**
 * Who did something or whom it concerned. Someone who left the firm is
 * no longer listed; an event without a user came from the operator or from
 * an account that has since been deleted.
 */
export type PersonLabel =
  | { kind: "person"; name: string; email: string | null }
  | { kind: "former" }
  | { kind: "none" };

export type AuditEntry = {
  [A in AuditAction]: {
    id: string;
    action: A;
    occurredAt: string;
    actor: PersonLabel;
    /** The member a membership event is about. */
    subject: PersonLabel;
    /** The document an event is about, if any. */
    documentId: string | null;
    /** `null` when the stored metadata has an unexpected shape. */
    details: Details[A] | null;
  };
}[AuditAction];

export function personLabel(
  userId: string | null,
  people: ReadonlyMap<string, Person>,
): PersonLabel {
  if (!userId) return { kind: "none" };
  const person = people.get(userId);
  if (!person) return { kind: "former" };
  const name = person.displayName?.trim() || person.email;
  if (!name) return { kind: "former" };
  return {
    kind: "person",
    name,
    email: person.email,
  };
}

/** Maps a row to an entry, or `null` for an action this version does not know. */
export function toAuditEntry(
  row: AuditEventRow,
  people: ReadonlyMap<string, Person>,
): AuditEntry | null {
  const action = auditActionSchema.safeParse(row.action);
  if (!action.success) return null;
  const details = metadataSchemas[action.data].safeParse(row.metadata);
  return {
    id: row.id,
    action: action.data,
    occurredAt: row.occurred_at,
    actor: personLabel(row.actor_id, people),
    subject: personLabel(row.subject_user_id, people),
    documentId: row.entity_type === "document" ? row.entity_id : null,
    details: details.success ? details.data : null,
  } as AuditEntry;
}

export function toAuditEntries(
  rows: readonly AuditEventRow[],
  people: ReadonlyMap<string, Person>,
): AuditEntry[] {
  return rows.flatMap((row) => toAuditEntry(row, people) ?? []);
}

/** The draft paths and the title an update changed, in a stable order. */
export function changedFields(entry: AuditEntry): string[] {
  if (entry.action !== "document.updated" || !entry.details) return [];
  return entry.details.fields;
}

/** All decisions of an import, summed over the extraction statuses. */
export function importTotals(counts: Details["document.imported"]["counts"]): {
  accepted: number;
  edited: number;
  cleared: number;
} {
  const statuses = [counts.verified, counts.unverified, counts.absent];
  return {
    accepted: statuses.reduce((sum, c) => sum + c.accepted, 0),
    edited: statuses.reduce((sum, c) => sum + c.edited, 0),
    cleared: statuses.reduce((sum, c) => sum + c.cleared, 0),
  };
}
