"use client";

import { useActionState } from "react";
import { FormError } from "../../../components/form-error";
import { FormField } from "../../../components/form-field";
import { SubmitButton } from "../../../components/submit-button";
import { initialFormState } from "../../../lib/auth/form-state";
import { signIn } from "./actions";

export function LoginForm() {
  const [state, formAction] = useActionState(signIn, initialFormState);

  return (
    <form action={formAction} noValidate className="space-y-4">
      <FormError message={state.error} />
      <FormField
        name="email"
        label="Email address"
        type="email"
        autoComplete="email"
        defaultValue={state.values?.email}
        errors={state.fieldErrors?.email}
      />
      <FormField
        name="password"
        label="Password"
        type="password"
        autoComplete="current-password"
        errors={state.fieldErrors?.password}
      />
      <SubmitButton>Sign in</SubmitButton>
    </form>
  );
}
