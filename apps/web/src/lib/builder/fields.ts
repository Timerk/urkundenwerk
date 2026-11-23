/**
 * Names for every draft path, in the English UI with the German term of art
 * where it is the precise one. `blank` labels a missing value in the preview.
 */
export const FIELD_LABELS = {
  "notarisation.mode": { label: "Form of notarisation", blank: "form" },
  "notarisation.deedNumber": {
    label: "Deed number (UR. Nr.)",
    blank: "deed no.",
  },
  "notarisation.date": { label: "Date of notarisation", blank: "date" },
  "notarisation.notaryName": { label: "Notary", blank: "notary" },
  "notarisation.notarySeat": {
    label: "Official seat (Amtssitz)",
    blank: "Amtssitz",
  },
  "founder.kind": { label: "The founder is", blank: "founder" },
  "founder.salutation": { label: "Salutation", blank: "salutation" },
  "founder.firstName": { label: "First name", blank: "first name" },
  "founder.lastName": { label: "Last name", blank: "last name" },
  "founder.birthDate": { label: "Date of birth", blank: "date of birth" },
  "founder.address.street": { label: "Street and number", blank: "street" },
  "founder.address.postalCode": { label: "Postcode", blank: "postcode" },
  "founder.address.city": { label: "Town or city", blank: "town" },
  "founder.name": { label: "Name of the entity", blank: "entity" },
  "founder.registerCourt": {
    label: "Register court",
    blank: "register court",
  },
  "founder.registerNumber": {
    label: "Register number",
    blank: "register no.",
  },
  "founder.seat": { label: "Seat of the entity", blank: "seat" },
  "founder.identificationDetails": {
    label: "Identification details",
    blank: "identification",
  },
  "company.name": { label: "Firma (company name)", blank: "Firma" },
  "company.seat": { label: "Sitz (registered seat)", blank: "Sitz" },
  "company.purpose": {
    label: "Unternehmensgegenstand (business purpose)",
    blank: "Unternehmensgegenstand",
  },
  shareCapitalCents: {
    label: "Stammkapital (share capital)",
    blank: "Stammkapital",
  },
  contribution: { label: "Payment of the contribution", blank: "payment" },
  "managingDirector.kind": {
    label: "Geschäftsführer (managing director)",
    blank: "Geschäftsführer",
  },
  "managingDirector.salutation": { label: "Salutation", blank: "salutation" },
  "managingDirector.firstName": { label: "First name", blank: "first name" },
  "managingDirector.lastName": { label: "Last name", blank: "last name" },
  "managingDirector.birthDate": {
    label: "Date of birth",
    blank: "date of birth",
  },
  "managingDirector.residence": {
    label: "Place of residence",
    blank: "residence",
  },
  notaryNotes: { label: "Notary's notes (Hinweise)", blank: "notes" },
  ...filingMessages.fields,
} as const satisfies Record<string, { label: string; blank: string }>;

export type FieldPath = keyof typeof FIELD_LABELS;

export function isFieldPath(path: string): path is FieldPath {
  return Object.hasOwn(FIELD_LABELS, path);
}

export function fieldLabel(path: string): string {
  return isFieldPath(path) ? FIELD_LABELS[path].label : path;
}

export function blankLabel(path: string): string {
  return isFieldPath(path) ? FIELD_LABELS[path].blank : "…";
}

/** The DOM id of the control for a path. */
export function controlId(path: string): string {
  return `field-${path.replaceAll(".", "-")}`;
}
import { filingMessages } from "./filing-messages";
