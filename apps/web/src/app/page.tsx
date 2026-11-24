import {
  buildMusterprotokollPreview,
  musterprotokollMetadata,
  type MusterprotokollDraft,
} from "@urkundenwerk/core";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { BrandMark } from "../components/brand";
import { DocumentPreview } from "../components/document-preview";
import { LanguageSwitcher } from "../components/language-switcher";
import { buttonClasses } from "../components/ui/button";
import { isSignupEnabled } from "../lib/auth/signup";

// Fictional case data for the excerpt on this page.
const exampleDraft: MusterprotokollDraft = {
  notarisation: {
    mode: "in_person",
    deedNumber: "117/2026",
    date: "2026-11-20",
    notaryName: "Dr. Nora Musterfrau",
    notarySeat: "Musterstadt",
  },
  founder: {
    kind: "natural_person",
    salutation: "Frau",
    firstName: "Erika",
    lastName: "Mustermann",
    birthDate: "1990-03-07",
    address: {
      street: "Musterweg 12",
      postalCode: "12345",
      city: "Musterstadt",
    },
  },
  company: {
    name: "Nordmuster Logistik GmbH",
    seat: "Musterstadt",
    purpose: "die Planung und Vermittlung von Logistikdienstleistungen",
  },
  shareCapitalCents: 2_500_000,
  contribution: "full",
  managingDirector: { kind: "founder" },
};

const POINTS = ["wording", "checks", "exports", "firms"] as const;

export default function Home() {
  const t = useTranslations("landing");
  const model = buildMusterprotokollPreview(exampleDraft);

  return (
    <main className="relative grid flex-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      {/* Top right, where a language switch is expected; clear of content. */}
      <LanguageSwitcher className="absolute top-3 right-4 z-10 sm:right-6" />
      <div className="flex flex-col justify-center px-5 py-12 sm:px-10 lg:py-16 xl:px-16">
        <div className="max-w-xl space-y-8">
          <div className="flex items-center gap-3">
            <BrandMark className="size-10" />
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Urkundenwerk
            </h1>
          </div>
          <p className="text-xl leading-relaxed text-ink">{t("lede")}</p>
          <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
            {POINTS.map((point) => (
              <div key={point} className="space-y-1">
                <dt className="text-sm font-semibold">
                  {t(`points.${point}.title`)}
                </dt>
                <dd className="text-sm leading-relaxed text-ink-soft">
                  {t(`points.${point}.body`, {
                    legalBasis: musterprotokollMetadata.legalBasis,
                  })}
                </dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/login"
              className={buttonClasses({ className: "h-11 px-5 text-base" })}
            >
              {t("signIn")}
            </Link>
            {isSignupEnabled() ? (
              <Link
                href="/signup"
                className={buttonClasses({
                  variant: "quiet",
                  className: "h-11 text-base",
                })}
              >
                {t("signUp")}
              </Link>
            ) : null}
          </div>
          <p className="max-w-prose border-t border-rule pt-5 text-sm text-ink-faint">
            {t("disclaimer")}
          </p>
        </div>
      </div>

      <div
        aria-label={t("excerpt")}
        role="figure"
        className="relative overflow-hidden bg-desk px-5 pt-10 max-lg:max-h-[34rem] sm:px-10 lg:pt-16"
      >
        <div className="deed-sheet deed-write mx-auto max-w-[44rem] lg:mr-0 lg:ml-6 xl:ml-12">
          <DocumentPreview
            model={model}
            blockFilter={(block) =>
              block.kind !== "signatures" &&
              (block.kind !== "clause" || block.number <= 4)
            }
          />
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-desk to-transparent"
        />
      </div>
    </main>
  );
}
