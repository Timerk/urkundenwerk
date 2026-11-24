import { INTL_LOCALES, type Locale } from "./locale";

// Formatting for the UI with `Intl`. German shows `20.11.2026` and
// `25.000 €`, English `20/11/2026` and `€25,000`. Times are German time,
// where the firms work. The deed keeps its own German formatting in core.

const TIME_ZONE = "Europe/Berlin";

const cache = new Map<string, Intl.DateTimeFormat | Intl.NumberFormat>();

function cached<T extends Intl.DateTimeFormat | Intl.NumberFormat>(
  key: string,
  create: () => T,
): T {
  let format = cache.get(key) as T | undefined;
  if (!format) {
    format = create();
    cache.set(key, format);
  }
  return format;
}

/** Euro cents as currency; whole euros without decimals. */
export function formatEuroCents(locale: Locale, cents: number): string {
  const whole = cents % 100 === 0;
  return cached(
    `eur-${locale}-${whole}`,
    () =>
      new Intl.NumberFormat(INTL_LOCALES[locale], {
        style: "currency",
        currency: "EUR",
        minimumFractionDigits: whole ? 0 : 2,
        maximumFractionDigits: whole ? 0 : 2,
      }),
  ).format(cents / 100);
}

export function formatNumber(
  locale: Locale,
  value: number,
  maximumFractionDigits = 0,
): string {
  return cached(
    `num-${locale}-${maximumFractionDigits}`,
    () =>
      new Intl.NumberFormat(INTL_LOCALES[locale], { maximumFractionDigits }),
  ).format(value);
}

/** A moment, e.g. a document's last change: `20.11.2026, 14:30`. */
export function formatDateTime(locale: Locale, value: Date | string): string {
  return cached(
    `datetime-${locale}`,
    () =>
      new Intl.DateTimeFormat(INTL_LOCALES[locale], {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: TIME_ZONE,
      }),
  ).format(new Date(value));
}

/** The time of day, e.g. of the last save: `14:30`. */
export function formatTime(locale: Locale, value: Date | string): string {
  return cached(
    `time-${locale}`,
    () =>
      new Intl.DateTimeFormat(INTL_LOCALES[locale], {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: TIME_ZONE,
      }),
  ).format(new Date(value));
}

/** A calendar date stored as ISO `YYYY-MM-DD`, shown as `20.11.2026`. */
export function formatIsoDate(locale: Locale, iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  const [, year, month, day] = match;
  return DATE_PATTERNS[locale].format(day!, month!, year!);
}

/** How each language writes a date, for display and as the input hint. */
export const DATE_PATTERNS: Record<
  Locale,
  {
    /** The format as users read it, e.g. `TT.MM.JJJJ`. */
    hint: string;
    format: (day: string, month: string, year: string) => string;
  }
> = {
  de: { hint: "TT.MM.JJJJ", format: (d, m, y) => `${d}.${m}.${y}` },
  en: { hint: "DD/MM/YYYY", format: (d, m, y) => `${d}/${m}/${y}` },
};
