import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LegalPage } from "../../components/legal-page";
import { getImprint } from "../../lib/legal/imprint";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal");
  return { title: `${t("imprintTitle")} · Urkundenwerk` };
}

export default async function ImprintPage() {
  const t = await getTranslations("legal");
  const imprint = getImprint();
  return (
    <LegalPage title={t("imprintTitle")}>
      {imprint ? (
        <address className="space-y-1 rounded-md border border-rule bg-paper p-4 not-italic [overflow-wrap:anywhere]">
          <p className="font-medium">{imprint.name}</p>
          <p className="whitespace-pre-line">{imprint.address}</p>
          <a
            href={`mailto:${imprint.email}`}
            className="text-stamp underline underline-offset-2"
          >
            {imprint.email}
          </a>
        </address>
      ) : (
        <p className="text-ink-soft">{t("unconfigured")}</p>
      )}
    </LegalPage>
  );
}
