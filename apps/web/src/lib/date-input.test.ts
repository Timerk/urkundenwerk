import { describe, expect, it } from "vitest";
import { formatDateTime, formatEuroCents, formatTime } from "../i18n/format";
import { dateInputHint, dateInputText, parseDateInput } from "./date-input";

describe("parseDateInput", () => {
  it.each([
    ["07.03.1990", "1990-03-07"],
    ["7.3.1990", "1990-03-07"],
    [" 07.03.1990 ", "1990-03-07"],
    ["07/03/1990", "1990-03-07"],
    ["07-03-1990", "1990-03-07"],
    ["07. 03. 1990", "1990-03-07"],
    ["07031990", "1990-03-07"],
    ["1990-03-07", "1990-03-07"],
    ["29.02.2024", "2024-02-29"],
    ["31.12.2099", "2099-12-31"],
    ["01.01.1900", "1900-01-01"],
  ])("reads %j as %s", (text, iso) => {
    expect(parseDateInput(text)).toEqual({ kind: "valid", iso });
  });

  it("treats blank input as empty", () => {
    expect(parseDateInput("   ")).toEqual({ kind: "empty" });
  });

  it.each([
    ["07.03.90"],
    ["7.3."],
    ["1990"],
    ["03/07/1990x"],
    ["heute"],
    ["07.03.19900"],
    ["0703199"],
  ])("rejects %j as not a date", (text) => {
    expect(parseDateInput(text)).toEqual({
      kind: "invalid",
      reason: "format",
    });
  });

  it.each([["31.02.2024"], ["29.02.2023"], ["00.01.2024"], ["01.13.2024"]])(
    "rejects %j as a day that does not exist",
    (text) => {
      expect(parseDateInput(text)).toEqual({ kind: "invalid", reason: "date" });
    },
  );

  it.each([["31.12.1899"], ["01.01.2100"]])(
    "rejects %j as out of range",
    (text) => {
      expect(parseDateInput(text)).toEqual({
        kind: "invalid",
        reason: "range",
      });
    },
  );
});

describe("date display", () => {
  it("writes stored ISO dates in each UI language's order", () => {
    expect(dateInputText("de", "1990-03-07")).toBe("07.03.1990");
    expect(dateInputText("en", "1990-03-07")).toBe("07/03/1990");
    expect(dateInputText("de", undefined)).toBe("");
    expect(dateInputHint("de")).toBe("TT.MM.JJJJ");
    expect(dateInputHint("en")).toBe("DD/MM/YYYY");
  });
});

describe("UI formatting", () => {
  it("formats euros and German time with the UI language", () => {
    expect(formatEuroCents("de", 2_500_000)).toBe("25.000 €");
    expect(formatEuroCents("en", 2_500_000)).toBe("€25,000");
    expect(formatEuroCents("de", 1_250_050)).toBe("12.500,50 €");
    expect(formatTime("de", "2026-11-20T13:30:00Z")).toBe("14:30");
    expect(formatDateTime("de", "2026-11-20T13:30:00Z")).toBe(
      "20.11.2026, 14:30",
    );
    expect(formatDateTime("en", "2026-11-20T13:30:00Z")).toBe(
      "20 Nov 2026, 14:30",
    );
  });
});
