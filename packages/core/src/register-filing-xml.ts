import { readFileSync } from "node:fs";
import { create } from "xmlbuilder2";
import type { XMLBuilder } from "xmlbuilder2/lib/interfaces";
import { validateXML } from "xmllint-wasm/index-node.js";
import { z } from "zod";
import { requireAppointedDirector } from "./templates/handelsregisteranmeldung-gmbh/director";
import { registerFilingMetadata } from "./templates/handelsregisteranmeldung-gmbh/metadata";
import type { RegisterFilingData } from "./templates/handelsregisteranmeldung-gmbh/schema";
import { musterprotokollMetadata } from "./templates/musterprotokoll-einpersonen/metadata";

export const registerFilingXmlNamespace =
  "urn:urkundenwerk:registeranmeldung:1";
const xsd = readFileSync(
  new URL("../schemas/registeranmeldung-v1.xsd", import.meta.url),
  "utf8",
);
const timestamp = z.iso.datetime({ offset: true });

function elements(
  parent: XMLBuilder,
  values: Record<string, string | boolean>,
) {
  for (const [name, value] of Object.entries(values)) {
    parent.ele(name).txt(String(value));
  }
}

function euros(parent: XMLBuilder, name: string, cents: number) {
  parent.ele(name, { waehrung: "EUR" }).txt((cents / 100).toFixed(2));
}

function address(
  parent: XMLBuilder,
  value: { street: string; postalCode: string; city: string },
) {
  elements(parent, {
    strasseUndHausnummer: value.street,
    postleitzahl: value.postalCode,
    ort: value.city,
  });
}

function person(
  parent: XMLBuilder,
  value: { firstName: string; lastName: string; birthDate: string },
) {
  elements(parent, {
    vorname: value.firstName,
    nachname: value.lastName,
    geburtsdatum: value.birthDate,
  });
}

/**
 * Serializes the result of `validateRegisterFiling` to deterministic UTF-8 XML.
 * Supply the generation time explicitly and validate the XML before download.
 */
export function buildRegisterFilingXml(
  data: RegisterFilingData,
  { generatedAt }: { generatedAt: string },
): string {
  const generatedUtc = new Date(timestamp.parse(generatedAt)).toISOString();
  const director = requireAppointedDirector(data);
  const { founder, filing } = data;
  const root = create({ version: "1.0", encoding: "UTF-8" }).ele(
    registerFilingXmlNamespace,
    "registeranmeldung",
  );

  elements(root.ele("registergericht"), {
    gerichtsart: "Amtsgericht",
    ort: filing.registerCourt,
  });
  const company = root.ele("gesellschaft");
  elements(company, {
    firma: data.company.name,
    sitz: data.company.seat,
    gegenstand: data.company.purpose,
  });
  euros(company, "stammkapital", data.shareCapitalCents);
  const businessAddress = company.ele("geschaeftsanschrift");
  address(businessAddress, filing.businessAddress);
  businessAddress.ele("land").txt("DE");
  elements(company.ele("allgemeineVertretungsregelung"), {
    beiEinemGeschaeftsfuehrer: "einzeln",
    beiMehrerenGeschaeftsfuehrern: "gemeinschaftlich",
  });

  const shareholder = root.ele("gesellschafterliste").ele("gesellschafter");
  if (founder.kind === "natural_person") {
    const naturalPerson = shareholder.ele("natuerlichePerson");
    person(naturalPerson, founder);
    address(naturalPerson.ele("anschrift"), founder.address);
  } else {
    elements(shareholder.ele("juristischePerson"), {
      name: founder.name,
      sitz: founder.seat,
      registergericht: founder.registerCourt,
      registernummer: founder.registerNumber,
    });
  }

  const management = root.ele("geschaeftsfuehrung").ele("geschaeftsfuehrer");
  person(management, director);
  management.ele("wohnort").txt(director.residence);
  elements(management.ele("konkreteVertretungsbefugnis"), {
    vertretungsart: "einzeln",
    befreitVonParagraf181BGB: true,
  });
  elements(management.ele("versicherungen"), {
    einlageZurFreienVerfuegung: filing.fundsAtFreeDisposal,
    keineBestellungshindernisse: filing.noDisqualification,
    ueberAuskunftspflichtBelehrt: filing.instructedOnDisclosure,
  });

  const payment = root.ele("einzahlung");
  payment
    .ele("vereinbarteSofortzahlung")
    .txt(data.contribution === "full" ? "voll" : "halb");
  euros(payment, "eingezahlt", filing.paidCents);
  const attachments = root.ele("anlagen");
  attachments.ele("musterprotokoll").txt("zugleichGesellschafterliste");
  if (filing.paymentEvidenceAttached)
    attachments.ele("einzahlungsnachweis").txt("beigefuegt");
  elements(root.ele("generator"), {
    anmeldungTemplateId: registerFilingMetadata.id,
    anmeldungTemplateVersion: registerFilingMetadata.version,
    musterprotokollTemplateId: musterprotokollMetadata.id,
    musterprotokollTemplateVersion: musterprotokollMetadata.version,
    generatedAt: generatedUtc,
  });
  return root.end({ prettyPrint: true, wellFormed: true });
}

/**
 * Validates generated XML against the bundled XSD. The result omits diagnostics
 * because libxml2 may include personal values in its error messages.
 * A validator runtime failure rejects the promise.
 */
export async function validateRegisterFilingXml(xml: string): Promise<boolean> {
  if (xml.includes("<!DOCTYPE")) return false;
  const result = await validateXML({
    xml: [{ fileName: "registeranmeldung.xml", contents: xml }],
    schema: [{ fileName: "registeranmeldung-v1.xsd", contents: xsd }],
  });
  return result.valid;
}
