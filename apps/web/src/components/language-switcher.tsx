import { useLocale, useTranslations } from "next-intl";
import { setLocale } from "../i18n/actions";
import { LOCALES } from "../i18n/locale";

/**
 * DE | EN, drawn like the builder's pane toggle. Each language is a submit
 * button of a Server Action form, so it works before hydration and without
 * JavaScript. The current language is pressed. The visible code is the
 * accessible name, so voice control can say it; the title spells it out.
 */
export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const t = useTranslations("language");
  const current = useLocale();

  return (
    <form action={setLocale} className={className}>
      <div
        role="group"
        aria-label={t("label")}
        className="inline-grid grid-cols-2 rounded-sm border border-rule-strong bg-paper p-0.5 text-xs"
      >
        {LOCALES.map((locale) => {
          const active = locale === current;
          return (
            <button
              key={locale}
              type="submit"
              name="locale"
              value={locale}
              lang={locale}
              title={t(locale)}
              aria-pressed={active}
              className={`h-7 min-w-9 rounded-[3px] px-2 font-medium tracking-wide transition-colors ${
                active
                  ? "bg-ink text-white"
                  : "text-ink-soft hover:bg-surface hover:text-ink"
              }`}
            >
              {locale.toUpperCase()}
            </button>
          );
        })}
      </div>
    </form>
  );
}
