import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { LOCALE_COOKIE, resolveLocale } from "./locale";
import { MESSAGES } from "./messages";
import type { en } from "./messages/en";

/**
 * The UI language of each request, without a URL prefix: the cookie set by
 * the language switcher, then `Accept-Language`, then German (ADR-0012).
 */
export default getRequestConfig(async () => {
  const locale = resolveLocale({
    cookie: (await cookies()).get(LOCALE_COOKIE)?.value,
    acceptLanguage: (await headers()).get("accept-language"),
  });
  return {
    locale,
    // Both catalogues have the reference shape; the keys and ICU arguments
    // are typed from the English one (see app-config.d.ts).
    messages: MESSAGES[locale] as typeof en,
    timeZone: "Europe/Berlin",
  };
});
