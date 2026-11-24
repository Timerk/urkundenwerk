import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { LegalPage } from "../../components/legal-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal");
  return { title: `${t("privacyTitle")} · Urkundenwerk` };
}

export default async function PrivacyPage() {
  const t = await getTranslations("legal");
  return (
    <LegalPage title={t("privacyTitle")}>
      <p className="text-ink-soft">{t("intro")}</p>
      {(
        [
          "controller",
          "processing",
          "providers",
          "cookies",
          "retention",
          "rights",
        ] as const
      ).map((section) => (
        <section className="space-y-2 border-t border-rule pt-4" key={section}>
          <h2 className="font-semibold">{t(`sections.${section}.title`)}</h2>
          <p className="text-ink-soft">{t(`sections.${section}.body`)}</p>
          {section === "controller" || section === "rights" ? (
            <Link
              href="/impressum"
              className="inline-block text-stamp underline underline-offset-2"
            >
              {t("imprintTitle")}
            </Link>
          ) : null}
        </section>
      ))}
    </LegalPage>
  );
}
