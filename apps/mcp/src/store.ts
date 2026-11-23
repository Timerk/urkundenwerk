import type { MusterprotokollDraft } from "@urkundenwerk/core";
import type { Database } from "@urkundenwerk/core/db";
import type { AppSupabaseClient } from "./session";

/*
 * Data access for the MCP tools. It mirrors apps/web/src/lib/documents/
 * repository.ts (ADR-0010 says why it is not shared yet): every query runs
 * through the signed-in user's client, so row-level security decides which
 * rows exist and which writes succeed.
 */

export type TenantRole = Database["public"]["Enums"]["tenant_role"];
export type DocumentStatus = Database["public"]["Enums"]["document_status"];

export type Membership = {
  tenantId: string;
  name: string;
  slug: string;
  role: TenantRole;
};

export type StoredDocument = {
  id: string;
  tenantId: string;
  templateId: string;
  templateVersion: string;
  title: string;
  /** Stored JSON; validated with the draft schema before use. */
  data: unknown;
  status: DocumentStatus;
  createdAt: string;
  updatedAt: string;
};

export type DocumentPage = { total: number; documents: StoredDocument[] };

/** What the tools need from the database. Tests replace it with a fake. */
export interface DocumentStore {
  /** The signed-in user's own memberships, oldest first. */
  listMemberships(): Promise<Membership[]>;
  listDocuments(
    tenantId: string,
    page: { limit: number; offset: number },
  ): Promise<DocumentPage>;
  /** `null` if the document does not exist or is not visible to the user. */
  getDocument(id: string): Promise<StoredDocument | null>;
  /** `null` if the user may not create documents in the tenant. */
  insertDocument(values: {
    tenantId: string;
    templateId: string;
    templateVersion: string;
    title: string;
    data: MusterprotokollDraft;
  }): Promise<StoredDocument | null>;
  /**
   * `null` if the document does not exist, the user may not change it, or it
   * was changed after `expectedUpdatedAt`.
   */
  updateDocument(
    id: string,
    changes: { title?: string; data?: MusterprotokollDraft },
    expectedUpdatedAt?: string,
  ): Promise<StoredDocument | null>;
  /** `false` if nothing was deleted. */
  deleteDocument(id: string): Promise<boolean>;
}

/** Raised for failures other than "not found" or "not permitted". */
export class StoreError extends Error {
  /** The Postgres or PostgREST error code; never the message, which can quote row values. */
  readonly code: string | undefined;

  constructor(operation: string, code: string | undefined) {
    super(`Could not ${operation}.`);
    this.name = "StoreError";
    this.code = code;
  }
}

const INSUFFICIENT_PRIVILEGE = "42501";

const COLUMNS =
  "id, tenant_id, template_id, template_version, title, data, status, created_at, updated_at";

type Row = Pick<
  Database["public"]["Tables"]["documents"]["Row"],
  | "id"
  | "tenant_id"
  | "template_id"
  | "template_version"
  | "title"
  | "data"
  | "status"
  | "created_at"
  | "updated_at"
>;

function toDocument(row: Row): StoredDocument {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    templateId: row.template_id,
    templateVersion: row.template_version,
    title: row.title,
    data: row.data,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createSupabaseStore(
  client: AppSupabaseClient,
  userId: string,
): DocumentStore {
  return {
    async listMemberships() {
      // RLS returns the memberships of colleagues too; keep the user's own.
      const { data, error } = await client
        .from("tenant_memberships")
        .select("role, tenant:tenants (id, name, slug)")
        .eq("user_id", userId)
        .order("created_at")
        .order("tenant_id");
      if (error) throw new StoreError("load your firms", error.code);
      return data.map(({ role, tenant }) => ({
        tenantId: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        role,
      }));
    },

    async listDocuments(tenantId, { limit, offset }) {
      const { data, error, count } = await client
        .from("documents")
        .select(COLUMNS, { count: "exact" })
        .eq("tenant_id", tenantId)
        .order("updated_at", { ascending: false })
        .order("id")
        .range(offset, offset + limit - 1);
      if (error) throw new StoreError("list the documents", error.code);
      return { total: count ?? data.length, documents: data.map(toDocument) };
    },

    async getDocument(id) {
      const { data, error } = await client
        .from("documents")
        .select(COLUMNS)
        .eq("id", id)
        .maybeSingle();
      if (error) throw new StoreError("load the document", error.code);
      return data ? toDocument(data) : null;
    },

    async insertDocument(values) {
      const { data, error } = await client
        .from("documents")
        .insert({
          tenant_id: values.tenantId,
          template_id: values.templateId,
          template_version: values.templateVersion,
          title: values.title,
          created_by: userId,
          data: values.data,
        })
        .select(COLUMNS)
        .single();
      if (error?.code === INSUFFICIENT_PRIVILEGE) return null;
      if (error) throw new StoreError("create the document", error.code);
      return toDocument(data);
    },

    async updateDocument(id, changes, expectedUpdatedAt) {
      let query = client.from("documents").update(changes).eq("id", id);
      if (expectedUpdatedAt) query = query.eq("updated_at", expectedUpdatedAt);
      const { data, error } = await query.select(COLUMNS).maybeSingle();
      if (error) throw new StoreError("save the document", error.code);
      return data ? toDocument(data) : null;
    },

    async deleteDocument(id) {
      const { data, error } = await client
        .from("documents")
        .delete()
        .eq("id", id)
        .select("id");
      if (error) throw new StoreError("delete the document", error.code);
      return data.length > 0;
    },
  };
}
