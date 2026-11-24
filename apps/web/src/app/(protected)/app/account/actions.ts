"use server";

import { getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient, getVerifiedUser } from "../../../../lib/supabase/server";
import { TENANT_COOKIE } from "../../../../lib/tenants/selection";

const confirmation = z.object({
  confirmed: z.literal("yes"),
  soleTenants: z.literal("yes").nullable(),
  firmIds: z.array(z.uuid()),
});

export async function deleteAccount(
  _: { error?: string },
  form: FormData,
): Promise<{ error?: string }> {
  const t = await getTranslations("account");
  if (!(await getVerifiedUser())) redirect("/login");
  const parsed = confirmation.safeParse({
    confirmed: form.get("confirmed"),
    soleTenants: form.get("soleTenants"),
    firmIds: form.getAll("firmId"),
  });
  if (!parsed.success) return { error: t("confirmRequired") };

  const client = await createClient();
  const { error } = await client.rpc("delete_my_account", {
    confirm_sole_tenants:
      parsed.data.soleTenants === "yes" ? parsed.data.firmIds : [],
  });
  if (error) {
    return {
      error: t(
        error.code === "PT409"
          ? "lastAdmin"
          : error.code === "PT412"
            ? "confirmFirms"
            : error.code === "PT403"
              ? "protected"
              : "failed",
      ),
    };
  }

  await client.auth.signOut({ scope: "local" });
  (await cookies()).delete({ name: TENANT_COOKIE, path: "/app" });
  redirect("/");
}
