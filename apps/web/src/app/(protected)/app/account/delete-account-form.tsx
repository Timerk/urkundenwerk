"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { FormError } from "../../../../components/form-error";
import { Button } from "../../../../components/ui/button";
import { deleteAccount } from "./actions";

export function DeleteAccountForm({
  firms,
}: {
  firms: { id: string; name: string }[];
}) {
  const t = useTranslations("account");
  const [state, action, pending] = useActionState(deleteAccount, {});
  return (
    <form action={action} className="space-y-4">
      <FormError message={state.error} />
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-1 accent-stamp"
          name="confirmed"
          value="yes"
          required
        />
        {t("confirm")}
      </label>
      {firms.length ? (
        <div className="space-y-2">
          <p className="text-sm text-ink-soft">{t("soleFirms")}</p>
          <ul className="list-disc space-y-1 pl-6 text-sm">
            {firms.map(({ id, name }) => (
              <li key={id}>
                <input type="hidden" name="firmId" value={id} />
                {name}
              </li>
            ))}
          </ul>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1 accent-stamp"
              name="soleTenants"
              value="yes"
              required
            />
            {t("confirmSole")}
          </label>
        </div>
      ) : null}
      <Button type="submit" variant="danger" disabled={pending}>
        {t("delete")}
      </Button>
    </form>
  );
}
