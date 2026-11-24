import { getTranslations } from "next-intl/server";
import { getVerifiedUser } from "../../lib/supabase/server";
import { Invitation } from "./invitation";

export default async function InvitePage() {
  const [user, t] = await Promise.all([
    getVerifiedUser(),
    getTranslations("invite"),
  ]);
  return (
    <main className="mx-auto w-full max-w-xl flex-1 space-y-4 px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="text-ink-soft">{t("body")}</p>
      {user?.email ? (
        <p className="break-words text-sm">
          {t("signedInAs", { email: user.email })}
        </p>
      ) : null}
      <Invitation signedIn={!!user} />
    </main>
  );
}
