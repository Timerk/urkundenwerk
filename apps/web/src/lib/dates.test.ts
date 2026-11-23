import { expect, it } from "vitest";
import { todayInGermany } from "./dates";

it.each([
  ["2026-11-23T10:00:00Z", "2026-11-23"],
  // 23:30 UTC is already the next day in Berlin (CET, UTC+1).
  ["2026-11-23T23:30:00Z", "2026-11-24"],
  // Summer time is UTC+2.
  ["2026-06-30T22:30:00Z", "2026-07-01"],
])("reads %s as %s in Germany", (instant, expected) => {
  expect(todayInGermany(new Date(instant))).toBe(expected);
});
