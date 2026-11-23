import type { en } from "./messages/en";
import type { Locale } from "./locale";

// Type-safe message keys and ICU arguments for `useTranslations` and
// `getTranslations`, checked against the English reference catalogue.
declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: typeof en;
  }
}
