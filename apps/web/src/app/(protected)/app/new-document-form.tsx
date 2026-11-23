"use client";

import { useActionState } from "react";
import { SubmitButton } from "../../../components/submit-button";
import { Notice } from "../../../components/ui/notice";
import { type ActionResult, createDocument } from "./documents/actions";

const initialState: ActionResult = { ok: true };

export function NewDocumentForm({ tenantId }: { tenantId: string }) {
  const [state, formAction] = useActionState(createDocument, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="tenantId" value={tenantId} />
      <SubmitButton pendingLabel="Creating…">
        <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3.5">
          <path
            d="M8 3v10M3 8h10"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
        New Musterprotokoll
      </SubmitButton>
      {state.ok ? null : <Notice tone="error">{state.error}</Notice>}
    </form>
  );
}
