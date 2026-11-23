import type {
  DocumentBlock,
  DocumentModel,
  InlineRun,
  SignaturesBlock,
} from "../../documents/model";
import {
  formatEuroAmount,
  formatEuroInWords,
  formatGermanDate,
} from "../../formatting";
import type { RuleContext } from "../../rules/types";
import {
  type MusterprotokollCandidate,
  type MusterprotokollDraft,
  normaliseDraft,
} from "./draft";
import { musterprotokollMetadata } from "./metadata";
import { musterprotokollRules } from "./rules";
import { musterprotokollSchema, type MusterprotokollInput } from "./schema";
import {
  checkMusterprotokoll,
  MusterprotokollValidationError,
  validateMusterprotokoll,
} from "./validate";

export { musterprotokollMetadata };

// "a)" in Anlage 1 only enumerates the annex variants; it is not part of the deed.
const heading =
  "Musterprotokoll\nfür die Gründung einer Einpersonengesellschaft";

type RunInput = InlineRun | string;

function runs(content: RunInput[]): InlineRun[] {
  return content.map((part) =>
    typeof part === "string" ? { kind: "text", text: part } : part,
  );
}

function field(path: string, text: string | undefined): InlineRun {
  return text === undefined
    ? { kind: "blank", path }
    : { kind: "field", path, text };
}

function paragraph(...content: RunInput[]): DocumentBlock {
  return { kind: "paragraph", runs: runs(content) };
}

function clause(number: number, ...content: RunInput[]): DocumentBlock {
  return { kind: "clause", number, runs: runs(content) };
}

type Founder = NonNullable<MusterprotokollCandidate["founder"]>;
type PersonName = Pick<Founder, "salutation" | "firstName" | "lastName">;
type Director = NonNullable<MusterprotokollCandidate["managingDirector"]>;
/**
 * The data the template assembles. Validated input satisfies it. A preview of
 * an incomplete draft leaves values out, and the template shows them as blanks.
 */
type DeedData = MusterprotokollCandidate;

const germanDate = (isoDate: string | undefined) =>
  isoDate === undefined ? undefined : formatGermanDate(isoDate);

function personName(
  person: PersonName,
  path: string,
  grammaticalCase: "nominative" | "dative" = "nominative",
): RunInput[] {
  const salutation =
    grammaticalCase === "dative" && person.salutation === "Herr"
      ? "Herrn"
      : person.salutation;
  return [
    ...(salutation ? [field(`${path}.salutation`, salutation), " "] : []),
    field(`${path}.firstName`, person.firstName),
    " ",
    field(`${path}.lastName`, person.lastName),
  ];
}

function founderIdentity(founder: Founder): RunInput[] {
  const details =
    founder.kind !== "legal_entity"
      ? [
          ...personName(founder, "founder"),
          ", geboren am ",
          field("founder.birthDate", germanDate(founder.birthDate)),
          ",\nwohnhaft in ",
          field("founder.address.street", founder.address?.street),
          ", ",
          field("founder.address.postalCode", founder.address?.postalCode),
          " ",
          field("founder.address.city", founder.address?.city),
        ]
      : [
          field("founder.name", founder.name),
          ", mit Sitz in ",
          field("founder.seat", founder.seat),
          ", eingetragen beim ",
          field("founder.registerCourt", founder.registerCourt),
          " unter ",
          field("founder.registerNumber", founder.registerNumber),
        ];
  return founder.identificationDetails
    ? [
        ...details,
        ", ",
        field("founder.identificationDetails", founder.identificationDetails),
      ]
    : details;
}

function directorDetails(founder: Founder, director: Director): RunInput[] {
  if (director.kind === "other") {
    return [
      ...personName(director, "managingDirector"),
      ", geboren am ",
      field("managingDirector.birthDate", germanDate(director.birthDate)),
      ", wohnhaft in ",
      field("managingDirector.residence", director.residence),
    ];
  }
  // Validation rejects a legal entity as director; a preview leaves it blank.
  if (director.kind === undefined || founder.kind === "legal_entity") {
    return [field("managingDirector.kind", undefined)];
  }
  return [
    ...personName(founder, "founder"),
    ", geboren am ",
    field("founder.birthDate", germanDate(founder.birthDate)),
    ", wohnhaft in ",
    field("founder.address.city", founder.address?.city),
  ];
}

// Procedural closing under § 13 Abs. 1 BeurkG, outside the statutory model text.
function signatures(founder: Founder): SignaturesBlock {
  const name =
    founder.kind === "legal_entity"
      ? founder.name
      : [founder.firstName, founder.lastName].filter(Boolean).join(" ");
  return {
    kind: "signatures",
    closing: runs(["Vorgelesen, genehmigt und eigenhändig unterschrieben:"]),
    signatories: [
      { label: name || "Gesellschafter/in" },
      { label: "Notar/in" },
    ],
  };
}

function shareCapital(cents: number | undefined) {
  if (cents === undefined || !Number.isSafeInteger(cents)) return {};
  const euros = cents / 100;
  return {
    amount: formatEuroAmount(cents),
    words:
      Number.isInteger(euros) && euros >= 1
        ? formatEuroInWords(euros)
        : undefined,
  };
}

function assemble(data: DeedData): DocumentModel {
  const notarisation = data.notarisation ?? {};
  const founder = data.founder ?? {};
  const company = data.company ?? {};
  const { contribution, notaryNotes } = data;
  const capital = shareCapital(data.shareCapitalCents);
  const video =
    notarisation.mode === "video"
      ? [field("notarisation.mode", " mittels Videokommunikation")]
      : [];
  const subscriber =
    founder.kind !== "legal_entity"
      ? personName(founder, "founder", "dative")
      : [field("founder.name", founder.name)];
  const payment =
    contribution === undefined
      ? undefined
      : contribution === "full"
        ? "sofort in voller Höhe"
        : "zu 50 Prozent sofort, im Übrigen sobald die Gesellschafterversammlung ihre Einforderung beschließt";

  return {
    templateId: musterprotokollMetadata.id,
    templateVersion: musterprotokollMetadata.version,
    title: heading.replace("\n", " "),
    blocks: [
      { kind: "heading", runs: runs([heading]) },
      paragraph(
        "UR. Nr. ",
        field("notarisation.deedNumber", notarisation.deedNumber),
      ),
      paragraph(
        "Heute, den ",
        field("notarisation.date", germanDate(notarisation.date)),
        ",\nerschien",
        ...video,
        " vor mir, ",
        field("notarisation.notaryName", notarisation.notaryName),
        ",\nNotar/in mit dem Amtssitz in ",
        field("notarisation.notarySeat", notarisation.notarySeat),
        ",",
      ),
      paragraph(...founderIdentity(founder), "."),
      clause(
        1,
        "Der Erschienene errichtet hiermit nach § 2 Abs. 1a GmbHG eine Gesellschaft mit beschränkter Haftung",
        ...video,
        " unter der Firma ",
        field("company.name", company.name),
        " mit dem Sitz in ",
        field("company.seat", company.seat),
        ".",
      ),
      clause(
        2,
        "Gegenstand des Unternehmens ist ",
        field("company.purpose", company.purpose),
        ".",
      ),
      clause(
        3,
        "Das Stammkapital der Gesellschaft beträgt ",
        field("shareCapitalCents", capital.amount),
        " (i. W. ",
        field("shareCapitalCents", capital.words),
        " Euro) und wird vollständig von ",
        ...subscriber,
        " (Geschäftsanteil Nr. 1) übernommen. Die Einlage ist in Geld zu erbringen, und zwar ",
        field("contribution", payment),
        ".",
      ),
      clause(
        4,
        "Zum Geschäftsführer der Gesellschaft wird ",
        ...directorDetails(founder, data.managingDirector ?? {}),
        ", bestellt. Der Geschäftsführer ist von den Beschränkungen des § 181 des Bürgerlichen Gesetzbuchs befreit.",
      ),
      clause(
        5,
        "Die Gesellschaft trägt die mit der Gründung verbundenen Kosten bis zu einem Gesamtbetrag von 300 €, höchstens jedoch bis zum Betrag ihres Stammkapitals. Darüber hinausgehende Kosten trägt der Gesellschafter.",
      ),
      clause(
        6,
        "Von dieser Urkunde erhält eine Ausfertigung der Gesellschafter, beglaubigte Ablichtungen die Gesellschaft und das Registergericht (in elektronischer Form) sowie eine einfache Abschrift das Finanzamt – Körperschaftsteuerstelle –.",
      ),
      clause(
        7,
        "Der Erschienene wurde vom Notar/von der Notarin insbesondere auf Folgendes hingewiesen: ",
        field("notaryNotes", notaryNotes),
      ),
      // Video notarisation uses qualified electronic signatures outside this export (§ 16b Abs. 3 BeurkG).
      ...(notarisation.mode === "video" ? [] : [signatures(founder)]),
    ],
  };
}

/**
 * Validates structured input with the schema and the rules and assembles the
 * versioned deed. Throws `MusterprotokollValidationError` if any rule reports
 * an error. The reference date is today's date, which date rules compare to.
 */
export function buildMusterprotokoll(
  input: MusterprotokollInput,
  context: RuleContext,
): DocumentModel {
  const result = validateMusterprotokoll(input, context);
  if (!result.success) throw new MusterprotokollValidationError(result.issues);
  return assemble(result.data);
}

/**
 * Assembles a best-effort preview of a possibly incomplete draft without
 * validating it. Missing values become blank runs with their field path.
 * Exports must use `buildMusterprotokoll`, which validates the input.
 */
export function buildMusterprotokollPreview(
  draft: MusterprotokollDraft,
): DocumentModel {
  return assemble(normaliseDraft(draft));
}

export const musterprotokollTemplate = {
  metadata: musterprotokollMetadata,
  schema: musterprotokollSchema,
  rules: musterprotokollRules,
  check: checkMusterprotokoll,
  validate: validateMusterprotokoll,
  build: buildMusterprotokoll,
  preview: buildMusterprotokollPreview,
} as const;
