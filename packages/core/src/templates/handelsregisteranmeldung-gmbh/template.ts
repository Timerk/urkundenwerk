import type {
  DocumentBlock,
  DocumentModel,
  InlineRun,
} from "../../documents/model";
import { formatEuroAmount, formatGermanDate } from "../../formatting";
import type { RuleContext } from "../../rules/types";
import type { MusterprotokollDraft } from "../musterprotokoll-einpersonen/draft";
import { appointedDirector } from "./director";
import { registerFilingMetadata } from "./metadata";
import { registerFilingRules, type RegisterFilingCandidate } from "./rules";
import { registerFilingSchema } from "./schema";
import {
  checkRegisterFiling,
  normaliseRegisterFiling,
  RegisterFilingValidationError,
  validateRegisterFiling,
} from "./validate";

export { registerFilingMetadata };

type RunInput = string | InlineRun;

function runs(parts: RunInput[]): InlineRun[] {
  return parts.map((part) =>
    typeof part === "string" ? { kind: "text", text: part } : part,
  );
}

function paragraph(...parts: RunInput[]): DocumentBlock {
  return { kind: "paragraph", runs: runs(parts) };
}

function field(path: string, value: string | undefined): InlineRun {
  return value ? { kind: "field", path, text: value } : { kind: "blank", path };
}

function assurance(
  path: string,
  confirmed: boolean | undefined,
  wording: string,
): InlineRun {
  return field(path, confirmed ? wording : undefined);
}

function assemble(data: RegisterFilingCandidate): DocumentModel {
  const title = "Handelsregisteranmeldung";
  const { company, filing } = data;
  const address = filing.businessAddress;
  const director = appointedDirector(data);
  const source = director?.source ?? "managingDirector";
  const feminine = director?.salutation === "Frau";
  const role = feminine ? "Geschäftsführerin" : "Geschäftsführer";
  const directorIdentity: RunInput[] = director
    ? [
        field(`${source}.firstName`, director.firstName),
        " ",
        field(`${source}.lastName`, director.lastName),
        ", geboren am ",
        field(
          `${source}.birthDate`,
          director.birthDate ? formatGermanDate(director.birthDate) : undefined,
        ),
        ", wohnhaft in ",
        field(
          source === "founder"
            ? "founder.address.city"
            : "managingDirector.residence",
          director.residence,
        ),
      ]
    : [field("managingDirector.kind", undefined)];

  return {
    title,
    templateId: registerFilingMetadata.id,
    templateVersion: registerFilingMetadata.version,
    blocks: [
      paragraph(
        "An das Amtsgericht ",
        field("filing.registerCourt", filing.registerCourt),
        "\n– Registergericht –",
      ),
      { kind: "heading", runs: runs([title]) },
      paragraph(
        "Zur Eintragung in das Handelsregister melde ich die Gesellschaft unter der Firma ",
        field("company.name", company?.name),
        " mit Sitz in ",
        field("company.seat", company?.seat),
        feminine
          ? " und meine Bestellung zur Geschäftsführerin an.\n"
          : " und meine Bestellung zum Geschäftsführer an.\n",
        `${role}: `,
        ...directorIdentity,
        ".",
      ),
      paragraph(
        "Allgemeine Vertretungsregelung: Ist nur ein Geschäftsführer bestellt, vertritt er die Gesellschaft allein. Sind mehrere Geschäftsführer bestellt, vertreten sie die Gesellschaft gemeinschaftlich.",
      ),
      paragraph(
        "Konkrete Vertretungsbefugnis: Ich vertrete die Gesellschaft allein. Ich bin von den Beschränkungen des § 181 BGB befreit.",
      ),
      paragraph(
        "Die inländische Geschäftsanschrift lautet: ",
        field("filing.businessAddress.street", address?.street),
        ", ",
        field("filing.businessAddress.postalCode", address?.postalCode),
        " ",
        field("filing.businessAddress.city", address?.city),
        ".",
      ),
      paragraph(
        "Ich versichere, dass auf den Geschäftsanteil Nr. 1 ",
        field(
          "filing.paidCents",
          filing.paidCents === undefined
            ? undefined
            : formatEuroAmount(filing.paidCents),
        ),
        " als Geldeinlage geleistet worden sind. ",
        assurance(
          "filing.fundsAtFreeDisposal",
          filing.fundsAtFreeDisposal,
          "Die für die Anmeldung erforderliche Einlage ist damit bewirkt. Der eingezahlte Betrag steht endgültig zu meiner freien Verfügung.",
        ),
      ),
      paragraph(
        assurance(
          "filing.noDisqualification",
          filing.noDisqualification,
          "Ich versichere, dass meiner Bestellung keine Umstände nach § 6 Abs. 2 Satz 2 Nr. 2 und 3 sowie Satz 3 und 4 GmbHG entgegenstehen.",
        ),
        " ",
        assurance(
          "filing.instructedOnDisclosure",
          filing.instructedOnDisclosure,
          "Über meine unbeschränkte Auskunftspflicht gegenüber dem Gericht nach § 53 Abs. 2 BZRG bin ich belehrt worden.",
        ),
      ),
      paragraph(
        "Anlagen\n– Musterprotokoll mit Geschäftsführerbestellung, zugleich Gesellschafterliste nach § 2 Abs. 1a Satz 4 GmbHG",
        ...(filing.paymentEvidenceAttached
          ? [field("filing.paymentEvidenceAttached", "\n– Einzahlungsnachweis")]
          : []),
      ),
      {
        kind: "signatures",
        closing: runs(["Ort, Datum: _________________________"]),
        signatories: [
          {
            label: feminine
              ? "Unterschrift der Geschäftsführerin"
              : "Unterschrift des Geschäftsführers",
          },
        ],
      },
      paragraph(
        "Beglaubigungsvermerk (vom Notariat auszufüllen)\n________________________________________________",
      ),
    ],
  };
}

/** Assembles a filing after checking the deed, filing fields and assurances. */
export function buildRegisterFiling(
  draft: MusterprotokollDraft,
  context: RuleContext,
): DocumentModel {
  const result = validateRegisterFiling(draft, context);
  if (!result.success) throw new RegisterFilingValidationError(result.issues);
  return assemble(result.data);
}

/** Renders an incomplete draft with field-linked blanks for unconfirmed values. */
export function buildRegisterFilingPreview(
  draft: MusterprotokollDraft,
): DocumentModel {
  return assemble(normaliseRegisterFiling(draft));
}

export const registerFilingTemplate = {
  metadata: registerFilingMetadata,
  schema: registerFilingSchema,
  rules: registerFilingRules,
  check: checkRegisterFiling,
  validate: validateRegisterFiling,
  build: buildRegisterFiling,
  preview: buildRegisterFilingPreview,
} as const;
