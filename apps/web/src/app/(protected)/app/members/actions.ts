"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "../../../../lib/supabase/server";
import {
  invitationToken,
  memberRole,
  type FormResult,
} from "../../../../lib/tenants/invitations";
import { getCurrentMembership } from "../../../../lib/tenants/memberships";

export async function createInvitation(
  tenantId: string,
  _: FormResult,
  form: FormData,
): Promise<FormResult> {
  const firm = await getCurrentMembership();
  if (firm?.role !== "admin" || firm.tenantId !== tenantId)
    return { error: "forbidden" };
  const email = z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email().max(254))
    .safeParse(form.get("email"));
  const role = memberRole.safeParse(form.get("role"));
  if (!email.success || !role.success) return { error: "invalid" };

  const client = await createClient();
  const { data, error } = await client.rpc("create_invitation", {
    target_tenant_id: firm.tenantId,
    invitee_email: email.data,
    invitee_role: role.data,
  });
  const token = invitationToken.safeParse(data);
  if (error || !token.success) {
    return {
      error:
        error?.code === "PT429"
          ? "quota"
          : error?.code === "PT409"
            ? "duplicate"
            : "failed",
    };
  }
  revalidatePath("/app/members");
  return { token: token.data };
}

export async function revokeInvitation(
  tenantId: string,
  id: string,
): Promise<FormResult> {
  const firm = await getCurrentMembership();
  if (firm?.role !== "admin" || firm.tenantId !== tenantId)
    return { error: "forbidden" };
  if (!z.uuid().safeParse(id).success) return { error: "invalid" };

  const client = await createClient();
  const { error } = await client.rpc("revoke_invitation", {
    invitation_id: id,
  });
  if (error) return { error: "failed" };
  revalidatePath("/app/members");
  return { success: "revoked" };
}

export async function changeMembership(
  tenantId: string,
  userId: string,
  _: FormResult,
  form: FormData,
): Promise<FormResult> {
  const firm = await getCurrentMembership();
  if (firm?.role !== "admin" || firm.tenantId !== tenantId)
    return { error: "forbidden" };
  if (!z.uuid().safeParse(userId).success) return { error: "invalid" };

  const client = await createClient();
  const role = memberRole.safeParse(form.get("role"));
  const remove = form.get("intent") === "remove";
  if (!remove && !role.success) return { error: "invalid" };
  const write = remove
    ? client.from("tenant_memberships").delete()
    : client.from("tenant_memberships").update({ role: role.data });
  const { data, error } = await write
    .eq("tenant_id", firm.tenantId)
    .eq("user_id", userId)
    .select("user_id")
    .maybeSingle();
  if (error?.code === "23514") return { error: "lastAdmin" };
  // The shared hosted demo admin keeps its role in the sandbox firm.
  if (error?.code === "PT403") return { error: "protectedAdmin" };
  if (error || !data) return { error: "failed" };
  revalidatePath("/app", "layout");
  return { success: remove ? "removed" : "roleSaved" };
}
