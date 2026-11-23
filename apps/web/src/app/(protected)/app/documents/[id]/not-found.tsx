import { useTranslations } from "next-intl";
import Link from "next/link";
import { buttonClasses } from "../../../../../components/ui/button";

export default function DocumentNotFound() {
  const t = useTranslations();
  return (
    <div className="mx-auto w-full max-w-xl space-y-4 px-4 py-16 sm:px-6">
      <h1 className="font-serif text-3xl">{t("documents.notFound.title")}</h1>
      <p className="text-ink-soft">{t("documents.notFound.body")}</p>
      <Link href="/app" className={buttonClasses({ variant: "secondary" })}>
        {t("common.backToDocuments")}
      </Link>
    </div>
  );
}
