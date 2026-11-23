import type { ExtractionFieldPath } from "./result";

/**
 * How a field's value is written, normalised, and checked against its quote.
 * Classification fields (`enum`) are derived from wording rather than copied,
 * so only some of them have reliable cues to check.
 */
export type FieldKind =
  | { type: "text" }
  | { type: "freeText" }
  | { type: "date" }
  | { type: "amount" }
  | { type: "enum"; values: readonly string[] };

export interface FieldSpec {
  kind: FieldKind;
  /** What the field means, for the extraction prompt. */
  description: string;
}

const text = { type: "text" } as const;
const freeText = { type: "freeText" } as const;
const date = { type: "date" } as const;
const salutation = { type: "enum", values: ["Herr", "Frau"] } as const;

/**
 * Every extractable field with its kind and meaning. The paths are the
 * single list in `result.ts`; `satisfies` keeps the two in step.
 */
export const FIELD_SPECS = {
  "notarisation.mode": {
    kind: { type: "enum", values: ["in_person", "video"] },
    description:
      "How the deed was notarised: in_person (the founder appeared before the notary) or video (by video communication, § 16a BeurkG).",
  },
  "notarisation.deedNumber": {
    kind: text,
    description:
      "The deed's roll number without its label, e.g. 123/2025 from 'UR. Nr. 123/2025' or 'UVZ 123/2025'.",
  },
  "notarisation.date": {
    kind: date,
    description: "The date of the notarisation (the day of the deed).",
  },
  "notarisation.notaryName": {
    kind: text,
    description:
      "The notary's name with any academic title, without the word Notar or Notarin.",
  },
  "notarisation.notarySeat": {
    kind: text,
    description: "The notary's official seat (Amtssitz), a place name.",
  },
  "founder.kind": {
    kind: { type: "enum", values: ["natural_person", "legal_entity"] },
    description:
      "Whether the single founder (Gründer, Gesellschafter) is a natural_person or a legal_entity such as a GmbH.",
  },
  "founder.salutation": {
    kind: salutation,
    description:
      "The founder's salutation, Herr or Frau (write Herrn as Herr).",
  },
  "founder.firstName": {
    kind: text,
    description: "The founder's first name(s), for a natural person.",
  },
  "founder.lastName": {
    kind: text,
    description: "The founder's last name, for a natural person.",
  },
  "founder.birthDate": {
    kind: date,
    description: "The founder's date of birth, for a natural person.",
  },
  "founder.address.street": {
    kind: text,
    description: "Street and house number of the founder's address.",
  },
  "founder.address.postalCode": {
    kind: text,
    description: "Postcode of the founder's address, digits as written.",
  },
  "founder.address.city": {
    kind: text,
    description: "Town or city of the founder's address.",
  },
  "founder.name": {
    kind: text,
    description:
      "The full name of the founding legal entity, including its legal form.",
  },
  "founder.registerCourt": {
    kind: text,
    description:
      "The register court of the founding entity in the nominative, e.g. 'Amtsgericht Musterstadt'.",
  },
  "founder.registerNumber": {
    kind: text,
    description:
      "The founding entity's register number with its prefix, e.g. 'HRB 12345'.",
  },
  "founder.seat": {
    kind: text,
    description: "The registered seat of the founding entity, a place name.",
  },
  "founder.identificationDetails": {
    kind: freeText,
    description:
      "How the founder was identified, or who represents a founding entity, copied as written, e.g. 'ausgewiesen durch Personalausweis' or 'vertreten durch …'.",
  },
  "company.name": {
    kind: text,
    description:
      "The Firma of the company being formed, with its legal form, e.g. 'Muster GmbH' or 'Muster UG (haftungsbeschränkt)'.",
  },
  "company.seat": {
    kind: text,
    description:
      "The registered seat (Sitz) of the company being formed, a place name.",
  },
  "company.purpose": {
    kind: freeText,
    description:
      "The business purpose (Gegenstand des Unternehmens), copied as written, starting with its article, e.g. 'die Entwicklung von Software'. Only the purpose itself, not 'Gegenstand des Unternehmens ist'.",
  },
  shareCapitalCents: {
    kind: { type: "amount" },
    description:
      "The share capital (Stammkapital) in euros, written as digits only, e.g. 25000 for 25.000 € or fünfundzwanzigtausend Euro.",
  },
  contribution: {
    kind: { type: "enum", values: ["full", "half"] },
    description:
      "How the cash contribution is paid: full (immediately in full) or half (half immediately, the rest when called).",
  },
  "managingDirector.kind": {
    kind: { type: "enum", values: ["founder", "other"] },
    description:
      "Who is appointed managing director (Geschäftsführer): founder if the founder is appointed, other if a different natural person is.",
  },
  "managingDirector.salutation": {
    kind: salutation,
    description:
      "Salutation of a managing director who is not the founder, Herr or Frau.",
  },
  "managingDirector.firstName": {
    kind: text,
    description: "First name(s) of a managing director who is not the founder.",
  },
  "managingDirector.lastName": {
    kind: text,
    description: "Last name of a managing director who is not the founder.",
  },
  "managingDirector.birthDate": {
    kind: date,
    description: "Date of birth of a managing director who is not the founder.",
  },
  "managingDirector.residence": {
    kind: text,
    description:
      "Place of residence of a managing director who is not the founder.",
  },
  notaryNotes: {
    kind: freeText,
    description:
      "Notes and advice the notary gave (Hinweise), copied as written. Leave out dotted placeholders.",
  },
} as const satisfies Record<ExtractionFieldPath, FieldSpec>;

export function fieldKind(path: ExtractionFieldPath): FieldKind {
  return FIELD_SPECS[path].kind;
}
