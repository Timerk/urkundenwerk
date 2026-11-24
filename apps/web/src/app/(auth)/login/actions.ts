"use server";

import { redirect } from "next/navigation";
import { demoLogin } from "../../../lib/auth/demo";
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
  const translate = await authErrorTranslator();
  const demoEmail = formData.get("demo");
  const demo = demoEmail === null ? null : demoLogin();
  if (
    demoEmail !== null &&
    !demo?.accounts.some(({ email }) => email === demoEmail)
  ) {
    return { error: translate("signInFailed") };
  }
  const fields = demo
    ? { email: demoEmail, password: demo.password }
    : readFields(formData, ["email", "password"]);
  const parsed = loginSchema.safeParse(fields);
  if (!parsed.success) {
    return invalidFormState(
      parsed.error,
      { email: typeof fields.email === "string" ? fields.email : "" },
      translate,
    );
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

  redirect(formData.get("next") === "invite" ? "/invite" : "/app");
}
