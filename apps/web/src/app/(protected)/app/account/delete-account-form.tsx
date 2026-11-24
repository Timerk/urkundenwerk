"use client";

import { useTranslations } from "next-intl";
import { useActionState, useRef, useState } from "react";
import { FormError } from "../../../../components/form-error";
import { Button } from "../../../../components/ui/button";
import { ConfirmPanel } from "../../../../components/ui/confirm";
import { submitKeepingValues } from "../../../../lib/forms";
import { deleteAccount } from "./actions";

export function DeleteAccountForm({
  firms,
}: {
  firms: { id: string; name: string }[];
}) {
  const t = useTranslations("account");
  const [state, action, pending] = useActionState(deleteAccount, {});
  const [confirming, setConfirming] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);

  return (
    <form onSubmit={submitKeepingValues(action)} className="space-y-4">
      {firms.length ? (
        <div className="rounded-sm border-y border-r border-l-[3px] border-hint-rule bg-hint-wash px-4 py-3 text-sm text-hint">
          <p className="font-medium">{t("soleFirmsTitle")}</p>
          <p className="mt-0.5">{t("soleFirms")}</p>
          <ul className="mt-2 space-y-0.5">
            {firms.map(({ id, name }) => (
              <li
                key={id}
                className="font-medium text-ink [overflow-wrap:anywhere]"
              >
                <input type="hidden" name="firmId" value={id} />
                {name}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <FormError message={state.error} />
      {confirming ? (
        <ConfirmPanel
          title={t("confirmTitle")}
          confirmLabel={t("deleteFinal")}
          pendingLabel={t("deleting")}
          cancelLabel={t("cancel")}
          pending={pending}
          onCancel={() => {
            setConfirming(false);
            requestAnimationFrame(() => trigger.current?.focus());
          }}
        >
          <div className="space-y-2.5 pt-1">
            <Checkbox name="confirmed" label={t("confirm")} />
            {firms.length ? (
              <Checkbox name="soleTenants" label={t("confirmSole")} />
            ) : null}
          </div>
        </ConfirmPanel>
      ) : (
        <Button
          ref={trigger}
          variant="danger"
          className="-ml-3"
          onClick={() => setConfirming(true)}
        >
          {t("delete")}
        </Button>
      )}
    </form>
  );
}

function Checkbox({ name, label }: { name: string; label: string }) {
  return (
    <label className="flex items-start gap-2.5 text-ink">
      <input
        type="checkbox"
        className="mt-0.5 size-4 shrink-0 accent-alert"
        name={name}
        value="yes"
        required
      />
      <span>{label}</span>
    </label>
  );
}
