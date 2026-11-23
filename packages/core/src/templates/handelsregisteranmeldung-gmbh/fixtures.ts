import {
  exampleCase,
  exampleDirector,
  exampleEntity,
} from "../musterprotokoll-einpersonen/fixtures";
import type { RegisterFilingData } from "./schema";

export const exampleFiling = {
  ...exampleCase,
  filing: {
    registerCourt: "Musterstadt",
    businessAddress: {
      street: "Musterkai 4",
      postalCode: "12345",
      city: "Musterstadt",
    },
    paidCents: 2_500_000,
    fundsAtFreeDisposal: true,
    noDisqualification: true,
    instructedOnDisclosure: true,
    paymentEvidenceAttached: false,
  },
} as const satisfies RegisterFilingData;

export const exampleEntityFiling = {
  ...exampleFiling,
  founder: exampleEntity,
  company: { ...exampleCase.company, name: "Küste & <Kai> GmbH" },
  managingDirector: exampleDirector,
  contribution: "half",
  filing: {
    ...exampleFiling.filing,
    paidCents: 1_250_001,
    paymentEvidenceAttached: true,
  },
} as const satisfies RegisterFilingData;
