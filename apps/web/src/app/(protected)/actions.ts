"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  type FormState,
  invalidFormState,
  readFields,
} from "../../lib/auth/form-state";
import { createFirmSchema } from "../../lib/auth/schemas";
import { authErrorTranslator } from "../../lib/auth/translate";
import { createClient } from "../../lib/supabase/server";
import { getMemberships } from "../../lib/tenants/memberships";
import { TENANT_COOKIE } from "../../lib/tenants/selection";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  (await cookies()).delete({ name: TENANT_COOKIE, path: "/app" });
  redirect("/login");
}

export async function createFirm(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const fields = readFields(formData, ["firmName"]);
  const parsed = createFirmSchema.safeParse(fields);
  const translate = await authErrorTranslator();
  if (!parsed.success) {
    return invalidFormState(parsed.error, fields, translate);
  }

  // create_tenant takes the caller from the JWT, so no user id is passed.
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_tenant", {
    name: parsed.data.firmName,
  });
  if (error) {
    return {
      error: translate(
        error.code === "PT409"
          ? "firmLimit"
          : error.code === "PT403"
            ? "demoFirmDisabled"
            : "firmFailed",
      ),
      values: { firmName: parsed.data.firmName },
    };
  }

  redirect("/app");
}

/** Switches the dashboard to another firm the user belongs to. */
export async function selectTenant(formData: FormData) {
  const tenantId = z.uuid().safeParse(formData.get("tenantId"));
  const memberships = await getMemberships();
  if (
    tenantId.success &&
    memberships.some((membership) => membership.tenantId === tenantId.data)
  ) {
    // A preference, not a credential: every read checks it against the
    // memberships again.
    (await cookies()).set(TENANT_COOKIE, tenantId.data, {
      httpOnly: true,
      sameSite: "lax",
      path: "/app",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  redirect("/app");
}
