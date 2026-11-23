import {
  musterprotokollDraftSchema,
  type MusterprotokollDraft,
} from "@urkundenwerk/core";
import { z } from "zod";
import { citationSchema } from "./citations";

type LeafPaths<T> = {
  [K in keyof T & string]-?: NonNullable<T[K]> extends object
    ? `${K}.${LeafPaths<NonNullable<T[K]>>}`
    : K;
}[keyof T & string];

const draft = musterprotokollDraftSchema.shape;
const notarisation = draft.notarisation.unwrap().shape;
const founder = draft.founder.unwrap().shape;
const address = founder.address.unwrap().shape;
const company = draft.company.unwrap().shape;
const director = draft.managingDirector.unwrap().shape;

const schemas = {
  "notarisation.mode": notarisation.mode.unwrap(),
  "notarisation.deedNumber": notarisation.deedNumber.unwrap(),
  "notarisation.date": notarisation.date.unwrap(),
  "notarisation.notaryName": notarisation.notaryName.unwrap(),
  "notarisation.notarySeat": notarisation.notarySeat.unwrap(),
  "founder.kind": founder.kind.unwrap(),
  "founder.salutation": founder.salutation.unwrap(),
  "founder.firstName": founder.firstName.unwrap(),
  "founder.lastName": founder.lastName.unwrap(),
  "founder.birthDate": founder.birthDate.unwrap(),
  "founder.address.street": address.street.unwrap(),
  "founder.address.postalCode": address.postalCode.unwrap(),
  "founder.address.city": address.city.unwrap(),
  "founder.name": founder.name.unwrap(),
  "founder.registerCourt": founder.registerCourt.unwrap(),
  "founder.registerNumber": founder.registerNumber.unwrap(),
  "founder.seat": founder.seat.unwrap(),
  "founder.identificationDetails": founder.identificationDetails.unwrap(),
  "company.name": company.name.unwrap(),
  "company.seat": company.seat.unwrap(),
  "company.purpose": company.purpose.unwrap(),
  shareCapitalCents: draft.shareCapitalCents.unwrap(),
  contribution: draft.contribution.unwrap(),
  "managingDirector.kind": director.kind.unwrap(),
  "managingDirector.salutation": director.salutation.unwrap(),
  "managingDirector.firstName": director.firstName.unwrap(),
  "managingDirector.lastName": director.lastName.unwrap(),
  "managingDirector.birthDate": director.birthDate.unwrap(),
  "managingDirector.residence": director.residence.unwrap(),
  notaryNotes: draft.notaryNotes.unwrap(),
} satisfies Record<LeafPaths<Omit<MusterprotokollDraft, "filing">>, z.ZodType>;

export type ExtractionFieldPath = keyof typeof schemas;
export const extractionFieldPaths: readonly ExtractionFieldPath[] =
  Object.freeze(Object.keys(schemas) as ExtractionFieldPath[]);
export const extractionFieldPathSchema = z.enum(extractionFieldPaths);
const fieldValueSchema = z.union([z.string().trim().min(1), z.int(), z.null()]);
export type ExtractionFieldValue = z.infer<typeof fieldValueSchema>;

export function isFieldValue(
  path: ExtractionFieldPath,
  value: ExtractionFieldValue,
): boolean {
  return schemas[path].safeParse(value).success;
}

export const extractedFieldSchema = z
  .strictObject({
    path: extractionFieldPathSchema,
    value: fieldValueSchema,
    citation: citationSchema.nullable(),
    confidence: z.number().min(0).max(1).optional(),
  })
  .refine(({ path, value }) => isFieldValue(path, value), {
    path: ["value"],
    message: "Value does not match the Musterprotokoll draft field",
  });

export const extractionResultSchema = z
  .strictObject({
    fields: z.array(extractedFieldSchema).max(extractionFieldPaths.length),
    documentId: z.string().regex(/^[a-f0-9]{64}$/u),
    model: z.string().min(1).optional(),
    promptVersion: z.string().min(1).optional(),
  })
  .refine(
    ({ fields }) =>
      new Set(fields.map(({ path }) => path)).size === fields.length,
    {
      path: ["fields"],
      message: "Field paths must be unique",
    },
  );

export type ExtractedField = z.infer<typeof extractedFieldSchema>;
export type ExtractionResult = z.infer<typeof extractionResultSchema>;
export type Predictor = (
  doc: import("./source").SourceDocument,
) => Promise<ExtractionResult>;
