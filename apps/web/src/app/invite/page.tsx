import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Wordmark } from "../../components/brand";
import { LanguageSwitcher } from "../../components/language-switcher";
import { getVerifiedUser } from "../../lib/supabase/server";
import { Invitation } from "./invitation";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("invite");
  return { title: `${t("title")} · Urkundenwerk` };
}

/** Laid out like the sign-in page, which an invitee usually comes from. */
export default async function InvitePage() {
  const [user, t] = await Promise.all([
    getVerifiedUser(),
    getTranslations("invite"),
  ]);
  return (
    <main className="mx-auto w-full max-w-md flex-1 space-y-10 px-4 pt-12 pb-16 sm:px-6 sm:pt-20">
      <div className="flex items-center justify-between gap-4">
        <Wordmark href={user ? "/app" : "/"} />
        <LanguageSwitcher />
      </div>
      <div className="space-y-5 rounded-md border border-rule bg-paper px-5 py-7 sm:px-8">
        <div className="space-y-2">
          <h1 className="font-serif text-2xl leading-tight text-ink">
            {t("title")}
          </h1>
          <p className="text-sm text-ink-soft">{t("body")}</p>
        </div>
        {user?.email ? (
          <p className="rounded-sm border border-rule bg-surface px-3 py-2 text-sm [overflow-wrap:anywhere]">
            {t.rich("signedInAs", {
              email: user.email,
              strong: (chunks) => (
                <span className="font-medium text-ink">{chunks}</span>
              ),
            })}
          </p>
        ) : null}
        <Invitation signedIn={!!user} />
      </div>
    </main>
  );
}
