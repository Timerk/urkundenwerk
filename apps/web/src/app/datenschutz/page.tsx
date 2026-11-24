import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { LegalPage } from "../../components/legal-page";

const SECTIONS = [
  "controller",
  "processing",
  "providers",
  "cookies",
  "retention",
  "rights",
] as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal");
  return { title: `${t("privacyTitle")} · Urkundenwerk` };
}

export default async function PrivacyPage() {
  const t = await getTranslations("legal");
  return (
    <LegalPage
      title={t("privacyTitle")}
      lead={t("intro")}
      contents={
        <nav aria-label={t("contents")} className="text-sm">
          <p className="mb-2 font-medium text-ink-soft">{t("contents")}</p>
          <ol className="space-y-1.5 border-l border-rule">
            {SECTIONS.map((section) => (
              <li key={section}>
                <a
                  href={`#${section}`}
                  className="-ml-px block border-l border-transparent py-0.5 pl-3 text-ink-soft hover:border-ink hover:text-ink"
                >
                  {t(`sections.${section}.title`)}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      }
    >
      {SECTIONS.map((section) => (
        <section
          key={section}
          id={section}
          aria-labelledby={`${section}-heading`}
          className="scroll-mt-6 space-y-2 border-t border-rule pt-6"
        >
          <h2
            id={`${section}-heading`}
            className="text-lg font-semibold tracking-tight"
          >
            {t(`sections.${section}.title`)}
          </h2>
          <p className="leading-relaxed text-ink">
            {t(`sections.${section}.body`)}
          </p>
          {section === "controller" || section === "rights" ? (
            <Link
              href="/impressum"
              className="inline-block text-sm font-medium text-stamp underline decoration-stamp/30 underline-offset-4 hover:decoration-stamp"
            >
              {t("toImprint")}
            </Link>
          ) : null}
        </section>
      ))}
    </LegalPage>
  );
}
