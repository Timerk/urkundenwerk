import type { MusterprotokollInput } from "./schema";

export const exampleFounder = {
  kind: "natural_person",
  salutation: "Frau",
  firstName: "Erika",
  lastName: "Mustermann",
  birthDate: "1990-03-07",
  address: { street: "Musterweg 12", postalCode: "12345", city: "Musterstadt" },
} as const satisfies MusterprotokollInput["founder"];

export const exampleDirector = {
  kind: "other",
  salutation: "Herr",
  firstName: "Max",
  lastName: "Mustermann",
  birthDate: "1987-02-10",
  residence: "Musterstadt",
} as const satisfies MusterprotokollInput["managingDirector"];

export const exampleCase = {
  notarisation: {
    mode: "in_person",
    deedNumber: "123/2026",
    date: "2026-11-23",
    notaryName: "Dr. Nora Musterfrau",
    notarySeat: "Musterstadt",
  },
  founder: exampleFounder,
  company: {
    name: "Musterlicht Software GmbH",
    seat: "Musterstadt",
    purpose: "die Entwicklung und der Vertrieb von Software",
  },
  shareCapitalCents: 2_500_000,
  contribution: "full",
  managingDirector: { kind: "founder" },
  notaryNotes: "Die Hinweise werden im Beurkundungstermin ergänzt.",
} as const satisfies MusterprotokollInput;

export const exampleEntity = {
  kind: "legal_entity",
  name: "Musterlicht Beteiligungen GmbH",
  registerCourt: "Amtsgericht Musterstadt",
  registerNumber: "HRB 12345",
  seat: "Musterstadt",
  identificationDetails: "vertreten durch Erika Mustermann",
} as const satisfies MusterprotokollInput["founder"];

/** The reference date of the tests: the day of the example notarisation. */
export const exampleContext = { referenceDate: "2026-11-23" } as const;
