import { DATE_PATTERNS, formatIsoDate } from "../i18n/format";
import type { Locale } from "../i18n/locale";

export type DateParse =
  | { kind: "empty" }
  | { kind: "valid"; iso: string }
  /** `format`: not a date; `date`: no such day; `range`: before 1900 or after 2099. */
  | { kind: "invalid"; reason: "format" | "date" | "range" };

export const MIN_YEAR = 1900;
export const MAX_YEAR = 2099;

/**
 * Reads a date typed by a user. Both UI languages write the day first, so
 * the input accepts `07.03.1990`, `7.3.1990`, `07/03/1990`, `07-03-1990`,
 * `07031990`, and ISO `1990-03-07` in either language. Two-digit years are
 * refused: for a date of birth, the century cannot be guessed safely.
 */
export function parseDateInput(text: string): DateParse {
  const value = text.trim();
  if (value === "") return { kind: "empty" };

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value);
  const dayFirst =
    /^(\d{1,2})\s*[./-]\s*(\d{1,2})\s*[./-]\s*(\d{4})$/.exec(value) ??
    /^(\d{2})(\d{2})(\d{4})$/.exec(value);
  const parts = iso
    ? { year: iso[1]!, month: iso[2]!, day: iso[3]! }
    : dayFirst
      ? { day: dayFirst[1]!, month: dayFirst[2]!, year: dayFirst[3]! }
      : undefined;
  if (!parts) return { kind: "invalid", reason: "format" };

  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    month < 1 ||
    month > 12 ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return { kind: "invalid", reason: "date" };
  }
  if (year < MIN_YEAR || year > MAX_YEAR) {
    return { kind: "invalid", reason: "range" };
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return { kind: "valid", iso: `${parts.year}-${pad(month)}-${pad(day)}` };
}

/** The text a date input shows for a stored ISO date. */
export function dateInputText(locale: Locale, iso: string | undefined): string {
  return iso ? formatIsoDate(locale, iso) : "";
}

export function dateInputHint(locale: Locale): string {
  return DATE_PATTERNS[locale].hint;
}
