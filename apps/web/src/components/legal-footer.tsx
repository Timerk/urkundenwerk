import { useTranslations } from "next-intl";
import Link from "next/link";

const link =
  "rounded-sm underline decoration-rule-strong underline-offset-4 hover:text-ink hover:decoration-ink";

export function LegalFooter() {
  const t = useTranslations("legal");
  return (
    <footer className="border-t border-rule bg-paper px-4 py-3 sm:px-6">
      <nav
        aria-label={t("nav")}
        className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-soft"
      >
        <Link className={link} href="/datenschutz">
          {t("privacyTitle")}
        </Link>
        <Link className={link} href="/impressum">
          {t("imprintTitle")}
        </Link>
      </nav>
    </footer>
  );
}
