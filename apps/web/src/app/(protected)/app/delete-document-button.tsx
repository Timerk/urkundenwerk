"use client";

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

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!window.confirm(`Delete “${title}”? This cannot be undone.`)) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="documentId" value={documentId} />
      <SubmitButton variant="danger" pendingLabel="Deleting…">
        Delete<span className="sr-only"> {title}</span>
      </SubmitButton>
      {state.ok ? null : (
        <p role="alert" className="mt-1 text-xs text-alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
