import { z } from "zod";

/** A signed EUR amount represented in whole cents. */
export const eurAmountSchema = z.object({
  currency: z.literal("EUR"),
  cents: z.int(),
});

export type EurAmount = z.infer<typeof eurAmountSchema>;
