import { useTranslations } from "next-intl";

/**
 * Every draft path the builder edits. Its label and the `blank` that marks
 * a missing value in the preview live in the catalogues under `fields`,
 * nested by the path's segments (`fields.founder.address.city.label`).
 */
export const FIELD_PATHS = [
  "notarisation.mode",
  "notarisation.deedNumber",
  "notarisation.date",
  "notarisation.notaryName",
  "notarisation.notarySeat",
  "founder.kind",
  "founder.salutation",
  "founder.firstName",
  "founder.lastName",
  "founder.birthDate",
  "founder.address.street",
  "founder.address.postalCode",
  "founder.address.city",
  "founder.name",
  "founder.registerCourt",
  "founder.registerNumber",
  "founder.seat",
  "founder.identificationDetails",
  "company.name",
  "company.seat",
  "company.purpose",
  "shareCapitalCents",
  "contribution",
  "managingDirector.kind",
  "managingDirector.salutation",
  "managingDirector.firstName",
  "managingDirector.lastName",
  "managingDirector.birthDate",
  "managingDirector.residence",
  "notaryNotes",
  "filing.registerCourt",
  "filing.businessAddress.street",
  "filing.businessAddress.postalCode",
  "filing.businessAddress.city",
  "filing.paidCents",
  "filing.fundsAtFreeDisposal",
  "filing.noDisqualification",
  "filing.instructedOnDisclosure",
  "filing.paymentEvidenceAttached",
] as const;

export type FieldPath = (typeof FIELD_PATHS)[number];

const FIELD_PATH_SET: ReadonlySet<string> = new Set(FIELD_PATHS);

export function isFieldPath(path: string): path is FieldPath {
  return FIELD_PATH_SET.has(path);
}

export type FieldLabels = {
  /** The field's label, e.g. "Firma" or "Firma (company name)". */
  label: (path: string) => string;
  /** The placeholder for a missing value on the sheet. */
  blank: (path: string) => string;
};

/** Field names in the UI language, for client and server components. */
export function useFieldLabels(): FieldLabels {
  const t = useTranslations("fields");
  return {
    label: (path) => (isFieldPath(path) ? t(`${path}.label`) : path),
    blank: (path) => (isFieldPath(path) ? t(`${path}.blank`) : "…"),
  };
}

/** The DOM id of the control for a path. */
export function controlId(path: string): string {
  return `field-${path.replaceAll(".", "-")}`;
}
