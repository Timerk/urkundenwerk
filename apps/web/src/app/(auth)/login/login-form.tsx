"use client";

import { useTranslations } from "next-intl";
import { useActionState, useRef } from "react";
import { FormError } from "../../../components/form-error";
import { FormField } from "../../../components/form-field";
import { SubmitButton } from "../../../components/submit-button";
import { initialFormState } from "../../../lib/auth/form-state";
import { signIn } from "./actions";

// Fictional users from supabase/seed.sql. The password exists only there.
const DEMO_PASSWORD = "demo-password-123";
const DEMO_ACCOUNTS = [
  { email: "erik.editor@demo.test", description: "erik" },
  { email: "victor.viewer@demo.test", description: "victor" },
  { email: "sara.admin@demo.test", description: "sara" },
  { email: "mia.multi@demo.test", description: "mia" },
] as const;

export function LoginForm() {
  const [state, formAction] = useActionState(signIn, initialFormState);
  const form = useRef<HTMLFormElement>(null);
  const t = useTranslations("auth");

  const signInAs = (email: string) => {
    const fields = form.current?.elements;
    const emailInput = fields?.namedItem("email");
    const passwordInput = fields?.namedItem("password");
    if (
      emailInput instanceof HTMLInputElement &&
      passwordInput instanceof HTMLInputElement
    ) {
      emailInput.value = email;
      passwordInput.value = DEMO_PASSWORD;
      form.current?.requestSubmit();
    }
  };

  return (
    <div className="space-y-8">
      <form ref={form} action={formAction} noValidate className="space-y-4">
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
      <section
        aria-labelledby="demo-accounts"
        className="space-y-3 border-t border-rule pt-6"
      >
        <h2 id="demo-accounts" className="text-sm font-medium">
          {t("login.demoAccounts")}
        </h2>
        <ul className="divide-y divide-rule rounded-sm border border-rule">
          {DEMO_ACCOUNTS.map((account) => (
            <li key={account.email}>
              <button
                type="button"
                onClick={() => signInAs(account.email)}
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
        <p className="text-xs text-ink-faint">
          {t("login.demoPassword")} <code>{DEMO_PASSWORD}</code>
        </p>
      </section>
    </div>
  );
}
