import "server-only";
import { z } from "zod";
import type { AppSupabaseClient } from "../documents/repository";
import type { AuditAction, AuditEventRow, Person } from "./presentation";
import { toAuditEntries } from "./presentation";

const rows = z.array(
  z.object({
    id: z.uuid(),
    action: z.string(),
    actor_id: z.uuid().nullable(),
    subject_user_id: z.uuid().nullable(),
    entity_type: z.string(),
    entity_id: z.uuid().nullable(),
    occurred_at: z.iso.datetime({ offset: true }),
    metadata: z.unknown(),
  }),
);

const people = z.array(
  z.object({
    user_id: z.uuid(),
    display_name: z.string().nullable(),
    email: z.string().nullable(),
    role: z.enum(["admin", "editor", "viewer"]),
  }),
);

export async function listTenantMembers(
  client: AppSupabaseClient,
  tenantId: string,
) {
  const { data, error } = await client.rpc("list_tenant_members", {
    target_tenant_id: tenantId,
  });
  if (error) throw new Error("Loading firm members failed.");
  return people.parse(data);
}

export async function listAudit(
  client: AppSupabaseClient,
  options: {
    tenantId: string;
    documentId?: string;
    action?: AuditAction;
    offset?: number;
    limit: number;
  },
) {
  const offset = options.offset ?? 0;
  let query = client
    .from("audit_events")
    .select(
      "id,action,actor_id,subject_user_id,entity_type,entity_id,occurred_at,metadata",
    )
    .eq("tenant_id", options.tenantId)
    .order("occurred_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + options.limit);
  if (options.documentId)
    query = query
      .eq("entity_type", "document")
      .eq("entity_id", options.documentId);
  if (options.action) query = query.eq("action", options.action);

  const [result, members] = await Promise.all([
    query,
    listTenantMembers(client, options.tenantId),
  ]);
  if (result.error) throw new Error("Loading activity failed.");
  const events: AuditEventRow[] = rows.parse(result.data);
  const directory = new Map<string, Person>(
    members.map((member) => [
      member.user_id,
      {
        userId: member.user_id,
        displayName: member.display_name,
        email: member.email,
      },
    ]),
  );
  return {
    entries: toAuditEntries(events.slice(0, options.limit), directory),
    hasNext: events.length > options.limit,
  };
}
