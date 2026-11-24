import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { PageHeader } from "../../../../components/page-header";
import { SettingsRow } from "../../../../components/settings-row";
import { buttonClasses } from "../../../../components/ui/button";
import { deletionOptions } from "../../../../lib/auth/account";
import { createClient, getVerifiedUser } from "../../../../lib/supabase/server";
import { DeleteAccountForm } from "./delete-account-form";

const DATA_ITEMS = [
  "profile",
  "memberships",
  "invitations",
  "events",
  "drafts",
] as const;

const DELETE_EFFECTS = ["account", "memberships", "drafts", "audit"] as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account");
  return { title: `${t("title")} · Urkundenwerk` };
}

export default async function AccountPage() {
  const user = await getVerifiedUser();
  if (!user) redirect("/login");
  const client = await createClient();
  const [t, { data, error }] = await Promise.all([
    getTranslations("account"),
    client.rpc("account_deletion_options"),
  ]);
  if (error) throw new Error("Loading account options failed.");
  const options = deletionOptions.parse(data);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-10 px-4 py-10 sm:px-6">
      <PageHeader
        title={t("title")}
        description={t("signedInAs", { email: user.email ?? "" })}
      />
      <div className="divide-y divide-rule border-y border-rule">
        <SettingsRow
          id="data-heading"
          title={t("dataTitle")}
          description={t("dataHelp")}
        >
          <div className="space-y-4 rounded-md border border-rule bg-paper p-4 sm:p-5">
            <div>
              <p className="text-sm font-medium text-ink">
                {t("dataIncludes")}
              </p>
              <ul className="mt-2 grid gap-x-6 gap-y-1.5 text-sm text-ink-soft sm:grid-cols-2">
                {DATA_ITEMS.map((item) => (
                  <li key={item} className="flex gap-2">
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 16 16"
                      className="mt-[3px] size-3.5 shrink-0 text-ok"
                    >
                      <path
                        d="m3.5 8.5 3 3 6-7"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    {t(`dataItems.${item}`)}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-sm text-ink-faint">{t("dataExcludes")}</p>
            </div>
            <a
              href="/app/account/data"
              download
              className={buttonClasses({ variant: "secondary" })}
            >
              <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3.5">
                <path
                  d="M8 2.5v8m0 0L4.75 7.25M8 10.5l3.25-3.25M3 13.5h10"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {t("download")}
            </a>
          </div>
        </SettingsRow>
        <SettingsRow
          id="delete-heading"
          title={t("deleteTitle")}
          description={t("deleteHelp")}
        >
          {options.protected ? (
            <div className="flex gap-3 rounded-md border border-rule bg-paper p-4 text-sm sm:p-5">
              <svg
                aria-hidden="true"
                viewBox="0 0 16 16"
                className="mt-0.5 size-4 shrink-0 text-ink-soft"
              >
                <rect
                  x="3"
                  y="7"
                  width="10"
                  height="7"
                  rx="1.25"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                />
                <path
                  d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                />
              </svg>
              <div>
                <p className="font-medium text-ink">{t("protectedTitle")}</p>
                <p className="mt-0.5 text-ink-soft">{t("protected")}</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4 rounded-md border border-rule bg-paper p-4 sm:p-5">
              <div>
                <p className="text-sm font-medium text-ink">
                  {t("deleteEffectsTitle")}
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-soft marker:text-rule-strong">
                  {DELETE_EFFECTS.map((effect) => (
                    <li key={effect}>{t(`deleteEffects.${effect}`)}</li>
                  ))}
                </ul>
              </div>
              <DeleteAccountForm firms={options.soleFirms} />
            </div>
          )}
        </SettingsRow>
      </div>
    </div>
  );
}
