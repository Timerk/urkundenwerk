"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { FormError } from "../../../components/form-error";
import { FormField } from "../../../components/form-field";
import { SubmitButton } from "../../../components/submit-button";
import { initialFormState } from "../../../lib/auth/form-state";
import type { DemoAccounts } from "../../../lib/auth/demo";
import { signIn } from "./actions";

export function LoginForm({
  accounts,
  passwordHint,
  invite,
}: {
  accounts: DemoAccounts;
  passwordHint?: string;
  invite?: boolean;
}) {
  const [state, formAction, pending] = useActionState(signIn, initialFormState);
  const t = useTranslations("auth");

  return (
    <div className="space-y-8">
      <form action={formAction} noValidate className="space-y-4">
        {invite ? <input type="hidden" name="next" value="invite" /> : null}
        <FormError message={state.error} />
        <FormField
          name="email"
          label={t("email")}
          type="email"
          autoComplete="email"
          defaultValue={state.values?.email}
          errors={state.fieldErrors?.email}
        />
        <FormField
          name="password"
          label={t("password")}
          type="password"
          autoComplete="current-password"
          errors={state.fieldErrors?.password}
        />
        <SubmitButton pendingLabel={t("login.pending")} className="w-full">
          {t("login.submit")}
        </SubmitButton>
      </form>
      {accounts.length > 0 ? (
        <section
          aria-labelledby="demo-accounts"
          className="space-y-3 border-t border-rule pt-6"
        >
          <h2 id="demo-accounts" className="text-sm font-medium">
            {t("login.demoAccounts")}
          </h2>
          <form action={formAction}>
            {invite ? <input type="hidden" name="next" value="invite" /> : null}
            <ul className="divide-y divide-rule rounded-sm border border-rule">
              {accounts.map((account) => (
                <li key={account.email}>
                  <button
                    type="submit"
                    name="demo"
                    value={account.email}
                    disabled={pending}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-surface"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {account.email}
                      </span>
                      <span className="block text-xs text-ink-faint">
                        {t(`login.accounts.${account.description}`)}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs font-medium text-stamp">
                      {t("login.signInAs")}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </form>
          {passwordHint ? (
            <p className="text-xs text-ink-faint">
              {t("login.demoPassword")} <code>{passwordHint}</code>
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
