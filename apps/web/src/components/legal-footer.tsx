import { useTranslations } from "next-intl";
import Link from "next/link";

export function LegalFooter() {
  const t = useTranslations("legal");
  return (
    <footer className="border-t border-rule bg-paper px-4 py-3 sm:px-6">
      <nav
        aria-label={t("nav")}
        className="mx-auto flex max-w-5xl flex-wrap gap-x-4 gap-y-2 text-sm text-ink-soft"
      >
        <Link
          className="underline underline-offset-4 hover:text-ink"
          href="/datenschutz"
        >
          {t("privacyTitle")}
        </Link>
        <Link
          className="underline underline-offset-4 hover:text-ink"
          href="/impressum"
        >
          {t("imprintTitle")}
        </Link>
      </nav>
    </footer>
  );
}
