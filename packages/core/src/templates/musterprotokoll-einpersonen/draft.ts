import { z } from "zod";
import { isoDateSchema, MAX_EUROS_IN_WORDS } from "../../formatting";
import { musterprotokollSchema } from "./schema";

// Enumerations come from the full schema so that drafts cannot drift from it.
const { notarisation, founder, managingDirector, contribution } =
  musterprotokollSchema.shape;
const [naturalPerson, legalEntity] = founder.options;
const [founderDirector, otherDirector] = managingDirector.options;

// Drafts keep text exactly as typed, including whitespace, within a limit.
const shortText = z.string().max(200);
const longText = z.string().max(2000);

const personFields = {
  salutation: naturalPerson.shape.salutation,
  firstName: shortText,
  lastName: shortText,
  birthDate: isoDateSchema,
};

/**
 * Possibly incomplete input for the Musterprotokoll, as saved while a form is
 * being filled in. Every field is optional and unknown keys are rejected. The
 * founder and the managing director carry the fields of both alternatives, so
 * switching between them keeps what was typed.
 */
export const musterprotokollDraftSchema = z
  .strictObject({
    notarisation: z
      .strictObject({
        mode: notarisation.shape.mode,
        deedNumber: shortText,
        date: isoDateSchema,
        notaryName: shortText,
        notarySeat: shortText,
      })
      .partial(),
    founder: z
      .strictObject({
        kind: z.enum([
          naturalPerson.shape.kind.value,
          legalEntity.shape.kind.value,
        ]),
        ...personFields,
        address: z
          .strictObject({
            street: shortText,
            postalCode: shortText,
            city: shortText,
          })
          .partial(),
        name: shortText,
        registerCourt: shortText,
        registerNumber: shortText,
        seat: shortText,
        identificationDetails: longText,
      })
      .partial(),
    company: z
      .strictObject({ name: shortText, seat: shortText, purpose: longText })
      .partial(),
    shareCapitalCents: z
      .int()
      .min(0)
      .max(MAX_EUROS_IN_WORDS * 100),
    contribution,
    managingDirector: z
      .strictObject({
        kind: z.enum([
          founderDirector.shape.kind.value,
          otherDirector.shape.kind.value,
        ]),
        ...personFields,
        residence: shortText,
      })
      .partial(),
    notaryNotes: longText,
  })
  .partial();

export type MusterprotokollDraft = z.infer<typeof musterprotokollDraftSchema>;

/** Blank text counts as missing, so optional notarial fields become dotted blanks. */
function filled(value: string | undefined): string | undefined {
  return value === undefined || value.trim() === "" ? undefined : value;
}

function compact<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as Partial<T>;
}

/**
 * Selects the fields of the chosen founder and director alternatives and drops
 * blank text. The result is a candidate for `musterprotokollSchema`, which
 * reports whatever is still missing or invalid.
 */
export function draftToInput(draft: MusterprotokollDraft) {
  const founder = draft.founder ?? {};
  const director = draft.managingDirector ?? {};
  const person = (source: typeof founder | typeof director) =>
    compact({
      salutation: source.salutation,
      firstName: filled(source.firstName),
      lastName: filled(source.lastName),
      birthDate: source.birthDate,
    });

  return compact({
    notarisation: compact({
      mode: draft.notarisation?.mode,
      deedNumber: filled(draft.notarisation?.deedNumber),
      date: draft.notarisation?.date,
      notaryName: filled(draft.notarisation?.notaryName),
      notarySeat: filled(draft.notarisation?.notarySeat),
    }),
    founder:
      founder.kind === "legal_entity"
        ? compact({
            kind: founder.kind,
            name: filled(founder.name),
            registerCourt: filled(founder.registerCourt),
            registerNumber: filled(founder.registerNumber),
            seat: filled(founder.seat),
            identificationDetails: filled(founder.identificationDetails),
          })
        : compact({
            kind: founder.kind,
            ...person(founder),
            address: compact({
              street: filled(founder.address?.street),
              postalCode: filled(founder.address?.postalCode),
              city: filled(founder.address?.city),
            }),
            identificationDetails: filled(founder.identificationDetails),
          }),
    company: compact({
      name: filled(draft.company?.name),
      seat: filled(draft.company?.seat),
      purpose: filled(draft.company?.purpose),
    }),
    shareCapitalCents: draft.shareCapitalCents,
    contribution: draft.contribution,
    managingDirector:
      director.kind === "other"
        ? compact({
            kind: director.kind,
            ...person(director),
            residence: filled(director.residence),
          })
        : compact({ kind: director.kind }),
    notaryNotes: filled(draft.notaryNotes),
  });
}

/** Validates a draft against the full schema. */
export function parseDraftAsInput(draft: MusterprotokollDraft) {
  return musterprotokollSchema.safeParse(draftToInput(draft));
}
