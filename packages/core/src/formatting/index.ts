import { z } from "zod";

export const isoDateSchema = z.iso.date();

/** Format signed integer cents without rounding or depending on the host locale. */
export function formatEuroAmount(cents: number): string {
  if (!Number.isSafeInteger(cents)) {
    throw new RangeError(
      "Expected integer cents within the safe integer range",
    );
  }

  const amount = Math.abs(cents);
  const euros = String(Math.floor(amount / 100)).replace(
    /\B(?=(\d{3})+(?!\d))/g,
    ".",
  );
  const remainder = amount % 100;
  const fraction =
    remainder === 0 ? "" : `,${String(remainder).padStart(2, "0")}`;
  return `${cents < 0 ? "-" : ""}${euros}${fraction} €`;
}

const units = [
  "",
  "eins",
  "zwei",
  "drei",
  "vier",
  "fünf",
  "sechs",
  "sieben",
  "acht",
  "neun",
];
const teens = [
  "zehn",
  "elf",
  "zwölf",
  "dreizehn",
  "vierzehn",
  "fünfzehn",
  "sechzehn",
  "siebzehn",
  "achtzehn",
  "neunzehn",
];
const tens = [
  "",
  "",
  "zwanzig",
  "dreißig",
  "vierzig",
  "fünfzig",
  "sechzig",
  "siebzig",
  "achtzig",
  "neunzig",
];

function unitPrefix(value: number): string {
  return value === 1 ? "ein" : units[value]!;
}

function underThousand(value: number): string {
  const hundreds = Math.floor(value / 100);
  const prefix = hundreds === 0 ? "" : `${unitPrefix(hundreds)}hundert`;
  const remainder = value % 100;

  if (remainder < 10) return prefix + units[remainder]!;
  if (remainder < 20) return prefix + teens[remainder - 10]!;

  const unit = remainder % 10;
  return (
    prefix +
    (unit === 0 ? "" : `${unitPrefix(unit)}und`) +
    tens[Math.floor(remainder / 10)]!
  );
}

function underMillion(value: number): string {
  const thousands = Math.floor(value / 1000);
  const remainder = underThousand(value % 1000);
  if (thousands === 0) return remainder;

  // The terminal "-eins" becomes "-ein" when followed by "tausend".
  return `${underThousand(thousands).replace(/eins$/, "ein")}tausend${remainder}`;
}

export const MAX_EUROS_IN_WORDS = 999_999_999;

/** Use "einhundert" and "eintausend", "eins" at the end and "ein" in compounds. */
export function formatEuroInWords(euros: number): string {
  if (!Number.isInteger(euros) || euros < 1 || euros > MAX_EUROS_IN_WORDS) {
    throw new RangeError("Expected between 1 and 999,999,999 whole euros");
  }

  const millions = Math.floor(euros / 1_000_000);
  const remainder = underMillion(euros % 1_000_000);
  if (millions === 0) return remainder;

  const prefix =
    millions === 1 ? "eine Million" : `${underThousand(millions)} Millionen`;
  return remainder ? `${prefix} ${remainder}` : prefix;
}

const months = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
];

/** Format an ISO calendar date without applying a time zone. */
export function formatGermanDate(isoDate: string): string {
  const date = isoDateSchema.parse(isoDate);
  const month = months[Number(date.slice(5, 7)) - 1];
  return `${Number(date.slice(8, 10))}. ${month} ${date.slice(0, 4)}`;
}
