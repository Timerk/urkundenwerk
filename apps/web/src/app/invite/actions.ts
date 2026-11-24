"use server";

import { getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { createClient, getVerifiedUser } from "../../lib/supabase/server";
import { invitationToken } from "../../lib/tenants/invitations";
import { TENANT_COOKIE } from "../../lib/tenants/selection";

export async function acceptInvitation(value: unknown) {
  const t = await getTranslations("invite");
  const token = invitationToken.safeParse(value);
  if (!token.success || !(await getVerifiedUser()))
    return { error: t("invalid") };
  const client = await createClient();
  const { data, error } = await client.rpc("accept_invitation", {
    token: token.data,
  });
  const tenantId = z.uuid().safeParse(data);
  if (error || !tenantId.success) return { error: t("invalid") };

  (await cookies()).set(TENANT_COOKIE, tenantId.data, {
    httpOnly: true,
    sameSite: "lax",
    path: "/app",
  });
  revalidatePath("/app", "layout");
  return {};
}
