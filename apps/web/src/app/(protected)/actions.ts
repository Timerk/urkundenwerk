"use server";

import { redirect } from "next/navigation";
import {
  type FormState,
  invalidFormState,
  readFields,
} from "../../lib/auth/form-state";
import { createFirmSchema } from "../../lib/auth/schemas";
import { createClient } from "../../lib/supabase/server";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function createFirm(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const fields = readFields(formData, ["firmName"]);
  const parsed = createFirmSchema.safeParse(fields);
  if (!parsed.success) {
    return invalidFormState(parsed.error, fields);
  }

  // create_tenant takes the caller from the JWT, so no user id is passed.
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_tenant", {
    name: parsed.data.firmName,
  });
  if (error) {
    return {
      error: "The firm could not be created. Please try again.",
      values: { firmName: parsed.data.firmName },
    };
  }

  redirect("/app");
}
