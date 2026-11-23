import { describe, expect, it } from "vitest";
import { formatEuroAmount, formatEuroInWords, formatGermanDate } from "./index";

describe("formatEuroAmount", () => {
  it.each([
    [0, "0 €"],
    [1, "0,01 €"],
    [-110, "-1,10 €"],
    [2_500_000, "25.000 €"],
    [99_999_999_900, "999.999.999 €"],
  ])("formats %i cents", (cents, expected) => {
    expect(formatEuroAmount(cents)).toBe(expected);
  });

  it.each([NaN, 2.5, Number.MAX_SAFE_INTEGER + 1])("rejects %s", (cents) => {
    expect(() => formatEuroAmount(cents)).toThrow(RangeError);
  });
});

describe("formatEuroInWords", () => {
  it.each([
    [1, "eins"],
    [11, "elf"],
    [16, "sechzehn"],
    [17, "siebzehn"],
    [21, "einundzwanzig"],
    [30, "dreißig"],
    [61, "einundsechzig"],
    [100, "einhundert"],
    [101, "einhunderteins"],
    [1_000, "eintausend"],
    [1_001, "eintausendeins"],
    [12_500, "zwölftausendfünfhundert"],
    [25_000, "fünfundzwanzigtausend"],
    [100_000, "einhunderttausend"],
    [101_000, "einhunderteintausend"],
    [1_000_000, "eine Million"],
    [1_000_001, "eine Million eins"],
    [2_000_012, "zwei Millionen zwölf"],
    [
      999_999_999,
      "neunhundertneunundneunzig Millionen neunhundertneunundneunzigtausendneunhundertneunundneunzig",
    ],
  ])("spells %i euros", (euros, expected) => {
    expect(formatEuroInWords(euros)).toBe(expected);
  });

  it.each([0, -1, 1.5, 1_000_000_000, Infinity])("rejects %s", (euros) => {
    expect(() => formatEuroInWords(euros)).toThrow(RangeError);
  });
});

describe("formatGermanDate", () => {
  it.each([
    ["2026-11-23", "23. November 2026"],
    ["2000-02-29", "29. Februar 2000"],
    ["2026-03-01", "1. März 2026"],
    ["0099-01-01", "1. Januar 0099"],
  ])("formats %s", (date, expected) => {
    expect(formatGermanDate(date)).toBe(expected);
  });

  it.each(["1900-02-29", "2026-04-31", "23.11.2026", "2026-11-23T00:00:00Z"])(
    "rejects %s",
    (date) => {
      expect(() => formatGermanDate(date)).toThrow();
    },
  );
});
