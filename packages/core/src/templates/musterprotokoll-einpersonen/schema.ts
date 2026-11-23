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

const gmbhSuffix = /(?:^|\s)(?:GmbH|Gesellschaft mit beschränkter Haftung)$/u;
const ugSuffix =
  /(?:^|\s)(?:UG|Unternehmergesellschaft) \(haftungsbeschränkt\)$/u;
const minimumGmbhCapitalCents = 2_500_000;

export type MusterprotokollRuleCode =
  | "company_legal_form_suffix"
  | "share_capital_whole_euros"
  | "gmbh_capital_minimum"
  | "ug_capital_below_gmbh_minimum"
  | "ug_contribution_full"
  | "director_founder_natural_person";

export const musterprotokollSchema = z
  .object({
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
  })
  .superRefine((input, context) => {
    const issue = (
      rule: MusterprotokollRuleCode,
      path: string[],
      message: string,
    ) => context.addIssue({ code: "custom", params: { rule }, path, message });

    const isUg = ugSuffix.test(input.company.name);
    const isGmbh = gmbhSuffix.test(input.company.name);

    if (!isUg && !isGmbh) {
      issue(
        "company_legal_form_suffix",
        ["company", "name"],
        "Expected a GmbH or UG legal form suffix",
      );
    }
    if (input.shareCapitalCents % 100 !== 0) {
      issue(
        "share_capital_whole_euros",
        ["shareCapitalCents"],
        "Share capital must be in whole euros",
      );
    }
    if (isGmbh && input.shareCapitalCents < minimumGmbhCapitalCents) {
      issue(
        "gmbh_capital_minimum",
        ["shareCapitalCents"],
        "GmbH share capital must be at least 25,000 euros",
      );
    }
    if (isUg && input.shareCapitalCents >= minimumGmbhCapitalCents) {
      issue(
        "ug_capital_below_gmbh_minimum",
        ["shareCapitalCents"],
        "UG share capital must be below 25,000 euros",
      );
    }
    if (isUg && input.contribution !== "full") {
      issue(
        "ug_contribution_full",
        ["contribution"],
        "UG share capital must be paid in full",
      );
    }
    if (
      input.managingDirector.kind === "founder" &&
      input.founder.kind !== "natural_person"
    ) {
      issue(
        "director_founder_natural_person",
        ["managingDirector", "kind"],
        "A founder acting as managing director must be a natural person",
      );
    }
  });

export type MusterprotokollInput = z.input<typeof musterprotokollSchema>;
export type MusterprotokollData = z.output<typeof musterprotokollSchema>;
