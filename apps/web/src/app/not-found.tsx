import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Wordmark } from "../components/brand";
import { buttonClasses } from "../components/ui/button";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  return { title: `${t("notFound")} · Urkundenwerk` };
}

export default function NotFound() {
  const t = useTranslations("notFound");
  return (
    <main className="mx-auto w-full max-w-xl space-y-6 px-4 py-16 sm:px-6">
      <Wordmark />
      <h1 className="font-serif text-3xl">{t("title")}</h1>
      <p className="text-ink-soft">{t("body")}</p>
      <Link href="/" className={buttonClasses({ variant: "secondary" })}>
        {t("home")}
      </Link>
    </main>
  );
}
