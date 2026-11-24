import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { buttonClasses } from "../../../../components/ui/button";
import { deletionOptions } from "../../../../lib/auth/account";
import { createClient, getVerifiedUser } from "../../../../lib/supabase/server";
import { DeleteAccountForm } from "./delete-account-form";

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
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-10 sm:px-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="break-words text-sm text-ink-soft">{user.email}</p>
      </header>
      <section
        aria-labelledby="data-heading"
        className="space-y-3 rounded-md border border-rule bg-paper p-4 sm:p-6"
      >
        <h2 id="data-heading" className="text-lg font-semibold">
          {t("dataTitle")}
        </h2>
        <p className="text-sm text-ink-soft">{t("dataHelp")}</p>
        <a
          href="/app/account/data"
          download
          className={buttonClasses({ variant: "secondary" })}
        >
          {t("download")}
        </a>
      </section>
      <section
        aria-labelledby="delete-heading"
        className="space-y-3 rounded-md border border-rule bg-paper p-4 sm:p-6"
      >
        <h2 id="delete-heading" className="text-lg font-semibold">
          {t("delete")}
        </h2>
        {options.protected ? (
          <p className="text-sm text-ink-soft">{t("protected")}</p>
        ) : (
          <>
            <p className="text-sm text-ink-soft">{t("deleteHelp")}</p>
            <DeleteAccountForm firms={options.soleFirms} />
          </>
        )}
      </section>
    </div>
  );
}
