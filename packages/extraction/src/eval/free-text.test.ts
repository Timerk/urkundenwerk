import { expect, it } from "vitest";
import { matchesFreeText } from "./free-text";

it("folds case and punctuation and removes a leading German article", () => {
  expect(
    matchesFreeText(
      "Die Wartung kleiner Werkstattkräne.",
      "wartung kleiner werkstattkra\u0308ne",
    ),
  ).toBe(true);
  expect(
    matchesFreeText(
      "Eine Prüfung der Register-Unterlagen",
      "Prüfung der Register Unterlagen.",
    ),
  ).toBe(true);
});

it("accepts token F1 of exactly 0.8 and rejects larger omissions", () => {
  const clause = "die Reparatur kleiner Pumpen für örtliche Werkstätten";
  expect(matchesFreeText(clause, "Reparatur kleiner Pumpen für")).toBe(true);
  expect(matchesFreeText(clause, "Reparatur kleiner Pumpen")).toBe(false);
});

it("counts repeating words once per occurrence in the evidence and rejects empty token sets", () => {
  expect(
    matchesFreeText(
      "Prüfung Prüfung Registereintrag",
      "Prüfung Registereintrag Registereintrag",
    ),
  ).toBe(false);
  expect(matchesFreeText("Die, ...", "die!")).toBe(false);
  expect(
    matchesFreeText("Wartung kleiner Pumpen", "Einbau neuer Leuchten"),
  ).toBe(false);
});
