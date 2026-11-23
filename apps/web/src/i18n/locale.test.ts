import { describe, expect, it } from "vitest";
import { preferredLocale, resolveLocale } from "./locale";

describe("preferredLocale", () => {
  it.each([
    ["de-DE,de;q=0.9,en;q=0.8", "de"],
    ["en-GB,en;q=0.9,de;q=0.8", "en"],
    ["de-AT", "de"],
    ["EN-us", "en"],
    // Quality decides before order.
    ["en;q=0.5, de;q=0.9", "de"],
    // An unsupported language is skipped for the next supported one.
    ["fr-FR,fr;q=0.9,en;q=0.8,de;q=0.7", "en"],
    // Equal quality keeps the header's order.
    ["en, de", "en"],
  ])("reads %j as %s", (header, locale) => {
    expect(preferredLocale(header)).toBe(locale);
  });

  it.each([
    [null],
    [""],
    ["fr-FR,it;q=0.8"],
    ["*"],
    ["de;q=0, en;q=0"],
    ["de;q=abc"],
    ["de;q=2"],
  ])("finds no supported language in %j", (header) => {
    expect(preferredLocale(header)).toBeUndefined();
  });
});

describe("resolveLocale", () => {
  it("prefers the language chosen in the cookie", () => {
    expect(resolveLocale({ cookie: "en", acceptLanguage: "de-DE" })).toBe("en");
    expect(resolveLocale({ cookie: "de", acceptLanguage: "en-GB" })).toBe("de");
  });

  it("ignores an unknown cookie and uses the browser's preference", () => {
    expect(resolveLocale({ cookie: "fr", acceptLanguage: "en-GB" })).toBe("en");
  });

  it("falls back to German", () => {
    expect(resolveLocale({ cookie: undefined, acceptLanguage: null })).toBe(
      "de",
    );
    expect(resolveLocale({ cookie: undefined, acceptLanguage: "fr" })).toBe(
      "de",
    );
  });
});
