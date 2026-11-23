"use client";

import { useActionState } from "react";
import { FormError } from "../../../components/form-error";
import { FormField } from "../../../components/form-field";
import { SubmitButton } from "../../../components/submit-button";
import { initialFormState } from "../../../lib/auth/form-state";
import { createFirm } from "../actions";

export function CreateFirmForm() {
  const [state, formAction] = useActionState(createFirm, initialFormState);

  return (
    <form action={formAction} noValidate className="max-w-sm space-y-4">
      <FormError message={state.error} />
      <FormField
        name="firmName"
        label="Firm name"
        autoComplete="organization"
        defaultValue={state.values?.firmName}
        errors={state.fieldErrors?.firmName}
        minLength={2}
        maxLength={120}
      />
      <SubmitButton pendingLabel="Creating…">Create firm</SubmitButton>
    </form>
  );
}
