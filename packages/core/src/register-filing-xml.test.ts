import { describe, expect, it } from "vitest";
import {
  buildRegisterFilingXml,
  registerFilingXmlNamespace,
  validateRegisterFilingXml,
} from "./register-filing-xml";
import {
  exampleEntityFiling,
  exampleFiling,
} from "./templates/handelsregisteranmeldung-gmbh/fixtures";
import { validateRegisterFiling } from "./templates/handelsregisteranmeldung-gmbh/validate";
import { exampleContext } from "./templates/musterprotokoll-einpersonen/fixtures";

const generatedAt = "2026-11-23T12:00:00Z";

function xmlFor(
  draft: typeof exampleFiling | typeof exampleEntityFiling,
): string {
  const result = validateRegisterFiling(draft, exampleContext);
  if (!result.success) throw new Error("Invalid XML fixture");
  return buildRegisterFilingXml(result.data, { generatedAt });
}

describe("register filing XML", () => {
  it.each([
    ["natural-person", exampleFiling],
    ["legal-entity", exampleEntityFiling],
  ] as const)("matches and validates the %s fixture", async (name, draft) => {
    const xml = xmlFor(draft);
    expect(await validateRegisterFilingXml(xml)).toBe(true);
    expect(xmlFor(draft)).toBe(xml);
    await expect(xml).toMatchFileSnapshot(`./xml-goldens/${name}.xml`);
  });

  it("preserves umlauts and escapes markup in company names", () => {
    expect(xmlFor(exampleEntityFiling)).toContain(
      "<firma>Küste &amp; &lt;Kai&gt; GmbH</firma>",
    );
  });

  it.each([
    [
      "namespace",
      registerFilingXmlNamespace,
      "urn:urkundenwerk:registeranmeldung:2",
    ],
    ["date", "1990-03-07", "1990-02-30"],
    ["postcode", "<postleitzahl>12345", "<postleitzahl>DE-12345"],
    ["amount precision", "25000.00", "25000.001"],
    ["currency", 'waehrung="EUR"', 'waehrung="USD"'],
    ["payment option", ">voll<", ">sofort<"],
    [
      "assurance",
      "<einlageZurFreienVerfuegung>true",
      "<einlageZurFreienVerfuegung>false",
    ],
    ["required company", "<sitz>Musterstadt</sitz>", ""],
    ["timestamp", "2026-11-23T12:00:00.000Z", "2026-11-23"],
  ])("rejects a mutated %s", async (_name, before, after) => {
    const xml = xmlFor(exampleFiling);
    const mutated = xml.replace(before, after);
    expect(mutated).not.toBe(xml);
    expect(await validateRegisterFilingXml(mutated)).toBe(false);
  });
});
