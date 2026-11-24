import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
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
        <section aria-labelledby="provider-heading" className="space-y-3">
          <h2
            id="provider-heading"
            className="text-sm font-medium text-ink-soft"
          >
            {t("provider")}
          </h2>
          <address className="space-y-3 border-l-[3px] border-ink pl-4 not-italic [overflow-wrap:anywhere]">
            <p className="text-lg font-semibold text-ink">{imprint.name}</p>
            <p className="leading-relaxed whitespace-pre-line text-ink">
              {imprint.address}
            </p>
            <p>
              <span className="text-sm text-ink-soft">{t("email")} </span>
              <a
                href={`mailto:${imprint.email}`}
                className="text-stamp underline decoration-stamp/30 underline-offset-4 hover:decoration-stamp"
              >
                {imprint.email}
              </a>
            </p>
          </address>
        </section>
      ) : (
        <div className="rounded-md border border-dashed border-rule-strong bg-paper px-6 py-10">
          <p className="font-serif text-xl text-ink">{t("unconfigured")}</p>
          <p className="mt-2 max-w-prose text-sm text-ink-soft">
            {t("unconfiguredHelp")}
          </p>
          <p className="mt-3 max-w-prose text-sm text-ink-faint">
            {t.rich("unconfiguredOperator", {
              code: (chunks) => (
                <code className="rounded-xs bg-surface px-1 py-px text-[0.92em] text-ink">
                  {chunks}
                </code>
              ),
            })}
          </p>
        </div>
      )}
      <p className="border-t border-rule pt-6 text-sm">
        <Link
          href="/datenschutz"
          className="font-medium text-stamp underline decoration-stamp/30 underline-offset-4 hover:decoration-stamp"
        >
          {t("toPrivacy")}
        </Link>
      </p>
    </LegalPage>
  );
}
