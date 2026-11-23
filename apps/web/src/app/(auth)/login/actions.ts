"use server";

import { redirect } from "next/navigation";
import {
  type FormState,
  invalidFormState,
  readFields,
} from "../../../lib/auth/form-state";
import { loginSchema } from "../../../lib/auth/schemas";
import { authErrorTranslator } from "../../../lib/auth/translate";
import { createClient } from "../../../lib/supabase/server";

export async function signIn(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const fields = readFields(formData, ["email", "password"]);
  const parsed = loginSchema.safeParse(fields);
  const values = { email: fields.email };
  const translate = await authErrorTranslator();
  if (!parsed.success) {
    return invalidFormState(parsed.error, values, translate);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return {
      error: translate(
        error.code === "invalid_credentials"
          ? "invalidCredentials"
          : "signInFailed",
      ),
      values: { email: parsed.data.email },
    };
  }

  redirect("/app");
}
