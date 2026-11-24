"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { SubmitButton } from "../../../components/submit-button";
import { Notice } from "../../../components/ui/notice";
import { type ActionResult, createDocument } from "./documents/actions";

const initialState: ActionResult = { ok: true };

export function NewDocumentForm({ tenantId }: { tenantId: string }) {
  const [state, formAction] = useActionState(createDocument, initialState);
  const t = useTranslations("dashboard");

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="tenantId" value={tenantId} />
      <SubmitButton pendingLabel={t("creating")}>
        <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3.5">
          <path
            d="M8 3v10M3 8h10"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
        {t("newDocument")}
      </SubmitButton>
      {state.ok ? null : <Notice tone="error">{state.error}</Notice>}
    </form>
  );
}
