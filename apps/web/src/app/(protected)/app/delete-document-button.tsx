"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { SubmitButton } from "../../../components/submit-button";
import { type ActionResult, deleteDocument } from "./documents/actions";

const initialState: ActionResult = { ok: true };

export function DeleteDocumentButton({
  documentId,
  title,
}: {
  documentId: string;
  title: string;
}) {
  const [state, formAction] = useActionState(deleteDocument, initialState);
  const t = useTranslations("dashboard");

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!window.confirm(t("confirmDelete", { title }))) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="documentId" value={documentId} />
      <SubmitButton variant="danger" pendingLabel={t("deleting")}>
        {t("delete")}
        <span className="sr-only"> {title}</span>
      </SubmitButton>
      {state.ok ? null : (
        <p role="alert" className="mt-1 text-xs text-alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
