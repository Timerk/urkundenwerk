import type { Database } from "@urkundenwerk/core/db";

/** Remembers the selected firm. Validated against memberships on every read. */
export const TENANT_COOKIE = "uw-tenant";

export const ROLE_LABELS = {
  admin: "Admin",
  editor: "Editor",
  viewer: "Viewer",
} as const satisfies Record<Database["public"]["Enums"]["tenant_role"], string>;

/** Mirrors the document write policies; RLS enforces them regardless. */
export function canEditDocuments(
  role: Database["public"]["Enums"]["tenant_role"],
): boolean {
  return role === "admin" || role === "editor";
}
