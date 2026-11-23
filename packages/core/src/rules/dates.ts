// Calendar arithmetic on ISO dates (YYYY-MM-DD) without time zones or clocks.

const parts = (iso: string) =>
  [
    Number(iso.slice(0, 4)),
    Number(iso.slice(5, 7)),
    Number(iso.slice(8, 10)),
  ] as const;

const isLeapYear = (year: number) =>
  (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

const pad = (value: number, length = 2) => String(value).padStart(length, "0");

/**
 * The date on which someone born on `birthDate` completes `years` years of
 * life. The day of birth counts as a full day (§ 187 Abs. 2 Satz 2 BGB), so a
 * person is of that age from the start of the anniversary. Someone born on
 * 29 February reaches it on 1 March in common years, because the period ends
 * with the last day of February (§ 188 Abs. 2 and 3 BGB).
 */
export function anniversary(birthDate: string, years: number): string {
  const [year, month, day] = parts(birthDate);
  const target = year + years;
  if (month === 2 && day === 29 && !isLeapYear(target)) {
    return `${pad(target, 4)}-03-01`;
  }
  return `${pad(target, 4)}-${pad(month)}-${pad(day)}`;
}

/** Whether someone born on `birthDate` has reached `years` on `date`. */
export function hasReachedAge(
  birthDate: string,
  years: number,
  date: string,
): boolean {
  // ISO dates compare correctly as strings.
  return date >= anniversary(birthDate, years);
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  const utc = (iso: string) => {
    const [year, month, day] = parts(iso);
    return Date.UTC(year, month - 1, day);
  };
  return Math.round((utc(to) - utc(from)) / 86_400_000);
}
