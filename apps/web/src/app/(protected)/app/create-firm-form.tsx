"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { FormError } from "../../../components/form-error";
import { FormField } from "../../../components/form-field";
import { SubmitButton } from "../../../components/submit-button";
import { initialFormState } from "../../../lib/auth/form-state";
import { createFirm } from "../actions";

export function CreateFirmForm() {
  const [state, formAction] = useActionState(createFirm, initialFormState);
  const t = useTranslations();

  return (
    <form action={formAction} noValidate className="max-w-sm space-y-4">
      <FormError message={state.error} />
      <FormField
        name="firmName"
        label={t("auth.firmName")}
        autoComplete="organization"
        defaultValue={state.values?.firmName}
        errors={state.fieldErrors?.firmName}
        minLength={2}
        maxLength={120}
      />
      <SubmitButton pendingLabel={t("dashboard.creating")}>
        {t("dashboard.createFirm")}
      </SubmitButton>
    </form>
  );
}
