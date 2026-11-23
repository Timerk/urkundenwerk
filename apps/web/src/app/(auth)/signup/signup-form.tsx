"use client";

import { useActionState } from "react";
import { FormError, FormNotice } from "../../../components/form-error";
import { FormField } from "../../../components/form-field";
import { SubmitButton } from "../../../components/submit-button";
import { initialFormState } from "../../../lib/auth/form-state";
import { signUp } from "./actions";

export function SignupForm() {
  const [state, formAction] = useActionState(signUp, initialFormState);

  return (
    <form action={formAction} noValidate className="space-y-4">
      <FormError message={state.error} />
      <FormNotice message={state.notice} />
      <FormField
        name="firmName"
        label="Firm name"
        autoComplete="organization"
        defaultValue={state.values?.firmName}
        errors={state.fieldErrors?.firmName}
        minLength={2}
        maxLength={120}
      />
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
        autoComplete="new-password"
        errors={state.fieldErrors?.password}
        minLength={8}
        maxLength={72}
      />
      <SubmitButton>Create account</SubmitButton>
    </form>
  );
}
