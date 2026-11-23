import { createTranslator, NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import type { Locale } from "../i18n/locale";
import { MESSAGES } from "../i18n/messages";
import type { en } from "../i18n/messages/en";
import type { RulesTranslator } from "../i18n/rule-messages";

/** Wraps a tree in the provider the root layout renders. English by default. */
export function withIntl(ui: ReactNode, locale: Locale = "en") {
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={MESSAGES[locale] as typeof en}
      timeZone="Europe/Berlin"
    >
      {ui}
    </NextIntlClientProvider>
  );
}

/** The whole catalogue of a language as a translator, outside React. */
export function translator(locale: Locale = "en") {
  return createTranslator({
    locale,
    messages: MESSAGES[locale] as typeof en,
  });
}

/** The `rules` namespace, as components get it from `useTranslations`. */
export function rulesTranslator(locale: Locale = "en"): RulesTranslator {
  return createTranslator({
    locale,
    messages: MESSAGES[locale] as typeof en,
    namespace: "rules",
  }) as unknown as RulesTranslator;
}

/**
 * A stand-in for `next-intl/server` in Server Action tests, which run
 * without a Next.js request: `vi.mock("next-intl/server", () => serverIntl())`.
 */
export function serverIntl(locale: Locale = "en") {
  return {
    getLocale: async () => locale,
    getTranslations: async (namespace?: string) =>
      createTranslator({
        locale,
        messages: MESSAGES[locale] as typeof en,
        namespace: namespace as never,
      }),
  };
}

/** For Testing Library's `render(ui, { wrapper: EnglishUi })`. */
export function EnglishUi({ children }: { children: ReactNode }) {
  return withIntl(children, "en");
}
