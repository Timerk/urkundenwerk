"use client";

import { useTranslations } from "next-intl";
import { type ReactNode, useActionState, useRef, useState } from "react";
import { useAnnounce } from "../../../components/announcer";
import { FormError } from "../../../components/form-error";
import { Button } from "../../../components/ui/button";
import { ConfirmPanel } from "../../../components/ui/confirm";
import { type ActionResult, deleteDocument } from "./documents/actions";

/**
 * A row of the document list. For editors it ends with Delete, which opens
 * a confirmation in a row of its own below, spanning the table, so the
 * question sits next to the document it names.
 */
export function DocumentRow({
  documentId,
  title,
  firmName,
  columns,
  canDelete,
  children,
}: {
  documentId: string;
  title: string;
  firmName: string;
  /** All columns of the table, including the actions column. */
  columns: number;
  canDelete: boolean;
  /** The row's cells before the actions column. */
  children: ReactNode;
}) {
  const t = useTranslations("dashboard");
  const announce = useAnnounce();
  const [state, action, pending] = useActionState(
    async (previous: ActionResult, form: FormData) => {
      const result = await deleteDocument(previous, form);
      if (result.ok) announce(t("deleted", { title }));
      return result;
    },
    { ok: true },
  );
  const [confirming, setConfirming] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);

  function cancel() {
    setConfirming(false);
    requestAnimationFrame(() => trigger.current?.focus());
  }

  return (
    <>
      <tr
        className={`group hover:bg-surface ${confirming ? "border-b-0 bg-surface" : ""}`}
      >
        {children}
        {canDelete ? (
          <td className="px-4 py-2.5 text-right align-top">
            <Button
              ref={trigger}
              variant="danger"
              size="sm"
              aria-expanded={confirming}
              aria-label={`${t("delete")}: ${title}`}
              onClick={() => (confirming ? cancel() : setConfirming(true))}
              disabled={pending}
            >
              {t("delete")}
            </Button>
          </td>
        ) : null}
      </tr>
      {confirming ? (
        <tr className="bg-surface">
          <td colSpan={columns} className="px-4 pt-0 pb-3.5">
            <form action={action} className="space-y-2">
              <input type="hidden" name="documentId" value={documentId} />
              <ConfirmPanel
                title={t("confirmDeleteTitle", { title })}
                confirmLabel={t("delete")}
                pendingLabel={t("deleting")}
                cancelLabel={t("cancel")}
                pending={pending}
                onCancel={cancel}
              >
                {t("confirmDeleteBody", { firm: firmName })}
              </ConfirmPanel>
              <FormError message={state.ok ? undefined : state.error} />
            </form>
          </td>
        </tr>
      ) : null}
    </>
  );
}
