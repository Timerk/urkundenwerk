import type { FakeResponder } from "@urkundenwerk/ai";
import type { ExtractionFieldPath } from "../result";
import type { ExtractionOutput } from "./prompt";

type Field = ExtractionOutput["fields"][number];

/** Reads the segments back from the user turn built by `extractionUserMessage`. */
function readSegments(user: string) {
  const block = /<document[^>]*>\n([\s\S]*)\n<\/document>/u.exec(user)?.[1];
  if (block === undefined) return undefined;
  const segments: { id: string; start: number }[] = [];
  const texts: string[] = [];
  let offset = 0;
  for (const line of block.split("\n")) {
    const match = /^\[(s\d+)\] (.*)$/u.exec(line);
    if (!match) return undefined;
    segments.push({ id: match[1]!, start: offset });
    texts.push(match[2]!);
    offset += match[2]!.length + 1;
  }
  return { segments, text: texts.join("\n") };
}

const NAME = String.raw`(?:Dr\. )?\p{Lu}[\p{L}-]+(?: \p{Lu}[\p{L}-]+)*`;
const DATE = String.raw`\d{1,2}\.\s?(?:\d{1,2}\.\s?\d{4}|\p{L}+ \d{4})`;
const PERSON = String.raw`\b(Herrn?|Frau) (\p{Lu}[\p{L}-]+(?: \p{Lu}[\p{L}-]+)*) (\p{Lu}[\p{L}-]+), geboren am (${DATE})`;

/**
 * Answers extraction requests without a model, for end-to-end tests and
 * local development without a key (`AI_PROVIDER=fake`). It finds a few
 * fields with fixed patterns for common German formation wording and quotes
 * them verbatim, so the review flow can be shown and tested. It is not a
 * predictor: the regex baseline and the LLM are what the evaluation scores.
 */
export const fakeExtractionResponder: FakeResponder = (request) => {
  const source = readSegments(request.user);
  if (!source) return { kind: "error", error: "rejected" };
  // Line breaks become spaces, so patterns can span lines without moving offsets.
  const flat = source.text.replaceAll("\n", " ");
  const fields: Field[] = [];
  const seen = new Set<ExtractionFieldPath>();

  const segmentAt = (offset: number) => {
    let id = source.segments[0]!.id;
    for (const segment of source.segments) {
      if (segment.start <= offset) id = segment.id;
    }
    return id;
  };
  const add = (
    path: ExtractionFieldPath,
    value: string | undefined,
    match: RegExpExecArray | null,
  ) => {
    if (!match || !value || seen.has(path)) return;
    seen.add(path);
    fields.push({
      path,
      value,
      quote: source.text.slice(match.index, match.index + match[0].length),
      segmentId: segmentAt(match.index),
    });
  };
  const find = (pattern: string) => new RegExp(pattern, "u").exec(flat);

  const deed = find(
    String.raw`\b(?:UR\.? ?-?Nr\.?|UVZ(?:-Nr\.)?) (\d+\/\d{4})`,
  );
  add("notarisation.deedNumber", deed?.[1], deed);
  const day = find(String.raw`(?:Heute, den|\bAm) (${DATE})`);
  add("notarisation.date", day?.[1], day);
  const notary = find(
    String.raw`(?:erschien vor mir,|vor (?:dem )?Notar(?:in)?) (${NAME}),`,
  );
  add("notarisation.notaryName", notary?.[1], notary);
  const seat = find(String.raw`Amtssitz(?: in)? (\p{Lu}[\p{L}-]+)`);
  add("notarisation.notarySeat", seat?.[1], seat);
  const video = find(String.raw`[^.]*Video[^.]*`);
  const appeared = find(String.raw`erschien(?: persönlich)? vor`);
  add("notarisation.mode", video ? "video" : "in_person", video ?? appeared);

  const person = find(PERSON);
  const entity = find(
    String.raw`(\p{Lu}[^,]{2,80}?(?:GmbH|mbH|AG)), mit Sitz in (\p{Lu}[\p{L}-]+), eingetragen beim (Amtsgericht \p{Lu}[\p{L}-]+) unter (HR[AB] \d+)`,
  );
  const founderIsEntity = Boolean(
    entity && (!person || entity.index < person.index),
  );
  if (entity && founderIsEntity) {
    add("founder.kind", "legal_entity", entity);
    add("founder.name", entity[1], entity);
    add("founder.seat", entity[2], entity);
    add("founder.registerCourt", entity[3], entity);
    add("founder.registerNumber", entity[4], entity);
    const agent = find(String.raw`vertreten durch ${NAME}`);
    add("founder.identificationDetails", agent?.[0], agent);
  } else if (person) {
    add("founder.kind", "natural_person", person);
    add(
      "founder.salutation",
      person[1]!.startsWith("Herr") ? "Herr" : "Frau",
      person,
    );
    add("founder.firstName", person[2], person);
    add("founder.lastName", person[3], person);
    add("founder.birthDate", person[4], person);
    const home = find(
      String.raw`wohnhaft (?:in )?(\p{Lu}[\p{L}ß.-]*(?: [\p{L}ß.-]+)* \d+[a-z]?), (\d{5}) (\p{Lu}[\p{L}-]+)`,
    );
    add("founder.address.street", home?.[1], home);
    add("founder.address.postalCode", home?.[2], home);
    add("founder.address.city", home?.[3], home);
    const identified = find(String.raw`ausgewiesen durch [^.,;]+`);
    add("founder.identificationDetails", identified?.[0], identified);
  }

  const firma = find(
    String.raw`(?:unter der Firma|Die Firma(?: der Gesellschaft)? lautet) (.{1,160}?(?:GmbH|UG \(haftungsbeschränkt\)))`,
  );
  add("company.name", firma?.[1], firma);
  const sitz = find(
    String.raw`(?:mit dem Sitz in|Der Sitz ist) (\p{Lu}[\p{L}-]+)`,
  );
  add("company.seat", sitz?.[1], sitz);
  const purpose = find(
    String.raw`(?:Gegenstand des Unternehmens ist|Unternehmensgegenstand ist) ([^.;]{1,300})`,
  );
  add("company.purpose", purpose?.[1], purpose);
  const capital = find(
    String.raw`Stammkapital[^\d.;]{0,40}?(\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{2})? ?(?:€|EUR|Euro)`,
  );
  add("shareCapitalCents", capital?.[1]?.replaceAll(".", ""), capital);
  const payment = find(String.raw`sofort in voller Höhe|zu 50 Prozent sofort`);
  add(
    "contribution",
    payment?.[0].startsWith("sofort") ? "full" : "half",
    payment,
  );

  const director = find(
    String.raw`Zum Geschäftsführer (?:der Gesellschaft )?wird (Herrn?|Frau) (\p{Lu}[\p{L}-]+(?: \p{Lu}[\p{L}-]+)*) (\p{Lu}[\p{L}-]+), geboren am (${DATE}), wohnhaft in (\p{Lu}[\p{L}-]+)`,
  );
  if (director) {
    const isFounder =
      !founderIsEntity &&
      director[2] === person?.[2] &&
      director[3] === person?.[3];
    add("managingDirector.kind", isFounder ? "founder" : "other", director);
    if (!isFounder) {
      add(
        "managingDirector.salutation",
        director[1]!.startsWith("Herr") ? "Herr" : "Frau",
        director,
      );
      add("managingDirector.firstName", director[2], director);
      add("managingDirector.lastName", director[3], director);
      add("managingDirector.birthDate", director[4], director);
      add("managingDirector.residence", director[5], director);
    }
  }
  const notes = find(String.raw`hingewiesen: ([^.\s][^.]*\.)`);
  add("notaryNotes", notes?.[1], notes);

  return {
    kind: "output",
    output: { fields, notes: [] } satisfies ExtractionOutput,
  };
};
