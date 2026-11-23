import { z } from "zod";
import { isoDateSchema, MAX_EUROS_IN_WORDS } from "../../formatting";

const nonemptyText = z
  .string()
  .trim()
  .min(1)
  .transform((value) => value.replace(/\r\n?/g, "\n"));

const salutationSchema = z.enum(["Herr", "Frau"]).nullable();
const personFields = {
  salutation: salutationSchema,
  firstName: nonemptyText,
  lastName: nonemptyText,
  birthDate: isoDateSchema,
};

const notarisationSchema = z.object({
  mode: z.enum(["in_person", "video"]),
  deedNumber: nonemptyText.optional(),
  date: isoDateSchema.optional(),
  notaryName: nonemptyText.optional(),
  notarySeat: nonemptyText.optional(),
});

const founderSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("natural_person"),
    ...personFields,
    address: z.object({
      street: nonemptyText,
      postalCode: nonemptyText,
      city: nonemptyText,
    }),
    identificationDetails: nonemptyText.optional(),
  }),
  z.object({
    kind: z.literal("legal_entity"),
    name: nonemptyText,
    registerCourt: nonemptyText,
    registerNumber: nonemptyText,
    seat: nonemptyText,
    identificationDetails: nonemptyText.optional(),
  }),
]);

const managingDirectorSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("founder") }),
  z.object({
    kind: z.literal("other"),
    ...personFields,
    residence: nonemptyText,
  }),
]);

/**
 * The structure of complete Musterprotokoll input: required fields, types,
 * formats, and ranges. Cross-field and legal consistency rules live in the
 * rule engine (`./rules.ts`, ADR-0006), so a value is checked in one place.
 * Use `validateMusterprotokoll` to apply both.
 */
export const musterprotokollSchema = z.object({
  notarisation: notarisationSchema,
  founder: founderSchema,
  company: z.object({
    name: nonemptyText,
    seat: nonemptyText,
    purpose: nonemptyText,
  }),
  shareCapitalCents: z
    .int()
    .min(100)
    .max(MAX_EUROS_IN_WORDS * 100),
  contribution: z.enum(["full", "half"]),
  managingDirector: managingDirectorSchema,
  notaryNotes: nonemptyText.optional(),
});
export type MusterprotokollInput = z.input<typeof musterprotokollSchema>;
export type MusterprotokollData = z.output<typeof musterprotokollSchema>;
