/**
 * The UI languages. German is the default because the users are German law
 * firms and notaries. Generated documents are always German, whatever the
 * UI language.
 */
export const LOCALES = ["de", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "de";

/** Remembers the chosen UI language for a year. Not a credential. */
export const LOCALE_COOKIE = "uw-locale";
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isLocale(value: unknown): value is Locale {
  return (
    typeof value === "string" && (LOCALES as readonly string[]).includes(value)
  );
}

/**
 * The first supported language in an `Accept-Language` header, by quality
 * and then by order. Region subtags are ignored (`de-AT` is German), and
 * ranges with `q=0`, a malformed quality, or `*` never match.
 */
export function preferredLocale(
  header: string | null | undefined,
): Locale | undefined {
  if (!header) return undefined;
  const ranges = header
    .split(",")
    .map((part, index) => {
      const [tag = "", ...params] = part.split(";").map((p) => p.trim());
      const q = params.find((param) => /^q=/i.test(param));
      const quality = q === undefined ? 1 : Number(q.slice(2));
      return {
        primary: tag.toLowerCase().split("-")[0] ?? "",
        quality: Number.isFinite(quality) && quality <= 1 ? quality : 0,
        index,
      };
    })
    .filter(({ quality }) => quality > 0)
    .sort((a, b) => b.quality - a.quality || a.index - b.index);
  return ranges.find(({ primary }) => isLocale(primary))?.primary as
    Locale | undefined;
}

/**
 * The UI language for a request: an explicit choice in the cookie, then the
 * browser's preference, then German.
 */
export function resolveLocale({
  cookie,
  acceptLanguage,
}: {
  cookie: string | null | undefined;
  acceptLanguage: string | null | undefined;
}): Locale {
  if (isLocale(cookie)) return cookie;
  return preferredLocale(acceptLanguage) ?? DEFAULT_LOCALE;
}

/** The BCP 47 tag used for `Intl` formatting in each UI language. */
export const INTL_LOCALES: Record<Locale, string> = {
  de: "de-DE",
  en: "en-GB",
};
