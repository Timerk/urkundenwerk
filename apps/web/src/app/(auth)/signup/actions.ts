"use server";

import { notFound, redirect } from "next/navigation";
import {
  type FormState,
  invalidFormState,
  readFields,
} from "../../../lib/auth/form-state";
import { signupSchema } from "../../../lib/auth/schemas";
import { isSignupEnabled } from "../../../lib/auth/signup";
import { authErrorTranslator } from "../../../lib/auth/translate";
import { createClient } from "../../../lib/supabase/server";

export async function signUp(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!isSignupEnabled()) notFound();
  const fields = readFields(formData, ["firmName", "email", "password"]);
  const parsed = signupSchema.safeParse(fields);
  const values = { firmName: fields.firmName, email: fields.email };
  const translate = await authErrorTranslator();
  if (!parsed.success) {
    return invalidFormState(parsed.error, values, translate);
  }
  const { firmName, email, password } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) {
    return {
      error: translate(
        error.code === "weak_password" ? "weakPassword" : "signUpFailed",
      ),
      values: { firmName, email },
    };
  }

  // With email confirmation enabled there is no session yet. The firm is then
  // created from the app after the first sign-in.
  if (!data.session) {
    return {
      notice: translate("confirmEmail"),
    };
  }

  const { error: tenantError } = await supabase.rpc("create_tenant", {
    name: firmName,
  });
  if (tenantError) {
    // The account exists; the app offers to create the firm again.
    redirect("/app?setup=failed");
  }

  redirect("/app");
}
