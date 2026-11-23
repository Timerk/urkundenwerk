import type {
  DocumentBlock,
  DocumentModel,
  InlineRun,
  TemplateMetadata,
} from "../../documents/model";
import {
  formatEuroAmount,
  formatEuroInWords,
  formatGermanDate,
} from "../../formatting";
import {
  musterprotokollSchema,
  type MusterprotokollData,
  type MusterprotokollInput,
} from "./schema";

// "a)" in Anlage 1 only enumerates the annex variants; it is not part of the deed.
const heading =
  "Musterprotokoll\nfür die Gründung einer Einpersonengesellschaft";

export const musterprotokollMetadata = {
  id: "musterprotokoll-einpersonen",
  version: "2022-08-01",
  legalBasis: "Anlage 1 a) zu § 2 Abs. 1a GmbHG",
  sourceUrl: "https://www.gesetze-im-internet.de/gmbhg/anlage_1.html",
} as const satisfies TemplateMetadata;

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

type Founder = MusterprotokollData["founder"];
type PersonName = {
  firstName: string;
  lastName: string;
  salutation: "Herr" | "Frau" | null;
};

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
    founder.kind === "natural_person"
      ? [
          ...personName(founder, "founder"),
          ", geboren am ",
          field("founder.birthDate", formatGermanDate(founder.birthDate)),
          ",\nwohnhaft in ",
          field("founder.address.street", founder.address.street),
          ", ",
          field("founder.address.postalCode", founder.address.postalCode),
          " ",
          field("founder.address.city", founder.address.city),
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

function directorDetails({
  founder,
  managingDirector,
}: MusterprotokollData): RunInput[] {
  if (managingDirector.kind === "other") {
    return [
      ...personName(managingDirector, "managingDirector"),
      ", geboren am ",
      field(
        "managingDirector.birthDate",
        formatGermanDate(managingDirector.birthDate),
      ),
      ", wohnhaft in ",
      field("managingDirector.residence", managingDirector.residence),
    ];
  }
  if (founder.kind !== "natural_person") {
    throw new Error(
      "Validated founder acting as managing director must be a natural person",
    );
  }
  return [
    ...personName(founder, "founder"),
    ", geboren am ",
    field("founder.birthDate", formatGermanDate(founder.birthDate)),
    ", wohnhaft in ",
    field("founder.address.city", founder.address.city),
  ];
}

/** Validate structured input and assemble the versioned statutory template. */
export function buildMusterprotokoll(
  input: MusterprotokollInput,
): DocumentModel {
  const data = musterprotokollSchema.parse(input);
  const {
    notarisation,
    founder,
    company,
    shareCapitalCents,
    contribution,
    notaryNotes,
  } = data;
  const video =
    notarisation.mode === "video"
      ? [field("notarisation.mode", " mittels Videokommunikation")]
      : [];
  const subscriber =
    founder.kind === "natural_person"
      ? personName(founder, "founder", "dative")
      : [field("founder.name", founder.name)];
  const payment =
    contribution === "full"
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
        field(
          "notarisation.date",
          notarisation.date && formatGermanDate(notarisation.date),
        ),
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
        field("shareCapitalCents", formatEuroAmount(shareCapitalCents)),
        " (i. W. ",
        field("shareCapitalCents", formatEuroInWords(shareCapitalCents / 100)),
        " Euro) und wird vollständig von ",
        ...subscriber,
        " (Geschäftsanteil Nr. 1) übernommen. Die Einlage ist in Geld zu erbringen, und zwar ",
        field("contribution", payment),
        ".",
      ),
      clause(
        4,
        "Zum Geschäftsführer der Gesellschaft wird ",
        ...directorDetails(data),
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
    ],
  };
}

export const musterprotokollTemplate = {
  metadata: musterprotokollMetadata,
  schema: musterprotokollSchema,
  build: buildMusterprotokoll,
} as const;
