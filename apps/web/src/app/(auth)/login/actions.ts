"use server";

import { redirect } from "next/navigation";
import {
  type FormState,
  invalidFormState,
  readFields,
} from "../../../lib/auth/form-state";
import { loginSchema } from "../../../lib/auth/schemas";
import { createClient } from "../../../lib/supabase/server";

export async function signIn(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const fields = readFields(formData, ["email", "password"]);
  const parsed = loginSchema.safeParse(fields);
  const values = { email: fields.email };
  if (!parsed.success) {
    return invalidFormState(parsed.error, values);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return {
      error:
        error.code === "invalid_credentials"
          ? "The email address or password is incorrect."
          : "Signing in failed. Please try again.",
      values: { email: parsed.data.email },
    };
  }

  redirect("/app");
}
