import { z } from "zod";
import { MAX_EUROS_IN_WORDS } from "../../formatting";
import { musterprotokollSchema } from "../musterprotokoll-einpersonen/schema";

const text = z.string().max(200);
const requiredText = text.trim().min(1);
const amount = z
  .int()
  .min(0)
  .max(MAX_EUROS_IN_WORDS * 100);

export const filingDraftSchema = z
  .strictObject({
    registerCourt: text, // § 7 Abs. 1 GmbHG, Amtsgericht for the registered seat
    businessAddress: z
      .strictObject({
        street: text,
        postalCode: text,
        city: text,
      })
      .partial(), // § 8 Abs. 4 Nr. 1 GmbHG, domestic address
    paidCents: amount, // § 7 Abs. 2, § 8 Abs. 2 GmbHG
    fundsAtFreeDisposal: z.boolean(), // § 8 Abs. 2 GmbHG
    noDisqualification: z.boolean(), // § 8 Abs. 3 GmbHG
    instructedOnDisclosure: z.boolean(), // § 8 Abs. 3 GmbHG, § 53 Abs. 2 BZRG
    paymentEvidenceAttached: z.boolean(), // § 8 Abs. 2 Satz 2 GmbHG, if required
  })
  .partial();

export const filingSchema = z.strictObject({
  registerCourt: requiredText,
  businessAddress: z.strictObject({
    street: requiredText,
    postalCode: requiredText.regex(/^\d{5}$/),
    city: requiredText,
  }),
  paidCents: amount,
  fundsAtFreeDisposal: z.boolean(),
  noDisqualification: z.boolean(),
  instructedOnDisclosure: z.boolean(),
  paymentEvidenceAttached: z.boolean().default(false),
});

export const registerFilingSchema = musterprotokollSchema.extend({
  filing: filingSchema,
});

export type FilingDraft = z.infer<typeof filingDraftSchema>;
export type RegisterFilingData = z.output<typeof registerFilingSchema>;

export function normaliseFiling(filing: FilingDraft | undefined): FilingDraft {
  const { businessAddress, registerCourt, ...other } = filing ?? {};
  return {
    ...other,
    registerCourt: registerCourt?.trim(),
    businessAddress: {
      street: businessAddress?.street?.trim(),
      postalCode: businessAddress?.postalCode?.trim(),
      city: businessAddress?.city?.trim(),
    },
  };
}
