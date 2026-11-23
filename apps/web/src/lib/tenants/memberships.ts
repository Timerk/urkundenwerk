import "server-only";
import type { Database } from "@urkundenwerk/core/db";
import { cookies } from "next/headers";
import { cache } from "react";
import { createClient, getVerifiedUser } from "../supabase/server";
import { TENANT_COOKIE } from "./selection";

export type TenantRole = Database["public"]["Enums"]["tenant_role"];

export type Membership = {
  tenantId: string;
  name: string;
  role: TenantRole;
};

/** The signed-in user's memberships, oldest first. Shared within a request. */
export const getMemberships = cache(async (): Promise<Membership[]> => {
  const user = await getVerifiedUser();
  if (!user) return [];

  // RLS limits rows to the caller's tenants; the filter keeps the caller's own
  // memberships rather than those of colleagues.
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tenant_memberships")
    .select("role, tenant:tenants (id, name)")
    .eq("user_id", user.id)
    .order("created_at")
    .order("tenant_id");
  if (error) throw new Error("Loading your firms failed.");

  return data.map(({ role, tenant }) => ({
    tenantId: tenant.id,
    name: tenant.name,
    role,
  }));
});

/**
 * The firm the user is working in: the one chosen in the switcher if the user
 * still belongs to it, otherwise their first firm. The cookie is only a
 * preference; access is always checked against the memberships.
 */
export async function getCurrentMembership(): Promise<Membership | undefined> {
  const memberships = await getMemberships();
  const selected = (await cookies()).get(TENANT_COOKIE)?.value;
  return (
    memberships.find(({ tenantId }) => tenantId === selected) ?? memberships[0]
  );
}
