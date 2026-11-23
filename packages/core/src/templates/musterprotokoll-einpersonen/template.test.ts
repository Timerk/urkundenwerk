import { expect, it } from "vitest";
import { toPlainText } from "../../documents/plain-text";
import { getTemplate } from "../registry";
import {
  exampleCase,
  exampleDirector,
  exampleEntity,
  exampleFounder,
} from "./fixtures";
import type { MusterprotokollInput } from "./schema";
import source from "./SOURCE.md?raw";
import { buildMusterprotokoll, musterprotokollTemplate } from "./template";

// Fictional first names that match each salutation, so the goldens read naturally.
const firstNameFor = { Herr: "Jonas", Frau: "Erika", none: "Alex" } as const;

const matrix = (["Herr", "Frau", null] as const).flatMap((salutation) =>
  (["in_person", "video"] as const).flatMap((mode) =>
    (["full", "half"] as const).flatMap((contribution) =>
      (["founder", "other"] as const).map((director) => ({
        name: `${salutation?.toLowerCase() ?? "no-salutation"}-${mode}-${contribution}-${director}`,
        input: {
          ...exampleCase,
          founder: {
            ...exampleFounder,
            salutation,
            firstName: firstNameFor[salutation ?? "none"],
          },
          notarisation: { ...exampleCase.notarisation, mode },
          contribution,
          managingDirector:
            director === "founder" ? { kind: "founder" } : exampleDirector,
        },
      })),
    ),
  ),
) satisfies { name: string; input: MusterprotokollInput }[];

const variants: { name: string; input: MusterprotokollInput }[] = [
  ...matrix,
  {
    name: "legal-entity",
    input: {
      ...exampleCase,
      founder: exampleEntity,
      managingDirector: exampleDirector,
    },
  },
  {
    name: "ug",
    input: {
      ...exampleCase,
      company: {
        ...exampleCase.company,
        name: "Musterlicht Software UG (haftungsbeschränkt)",
      },
      shareCapitalCents: 100,
    },
  },
  {
    name: "notary-blanks",
    input: {
      ...exampleCase,
      notarisation: { mode: "in_person" },
      notaryNotes: undefined,
    },
  },
];

it.each(variants)(
  "matches the $name plain-text golden",
  async ({ name, input }) => {
    const document = toPlainText(buildMusterprotokoll(input));
    await expect(document).toMatchFileSnapshot(`./goldens/${name}.txt`);
  },
);

function normalizeWhitespace(text: string) {
  return text.trim().replace(/\s+/g, " ");
}

it("preserves all fixed statutory wording for every alternative after normalizing fill-in positions", () => {
  // The annex enumerates its variants as "a)" and "b)"; the deed omits that label.
  const statutoryText = source
    .split("```text")[1]!
    .split("\nHinweise:")[0]!
    .replace(/^\s*a\) /, "");
  for (const { name, input } of variants) {
    const founderSalutation =
      input.founder.kind === "natural_person" ? input.founder.salutation : null;
    const directorSalutation =
      input.managingDirector.kind === "other"
        ? input.managingDirector.salutation
        : founderSalutation;
    const selected = statutoryText
      .replaceAll(
        " [mittels Videokommunikation]^5",
        input.notarisation.mode === "video"
          ? " mittels Videokommunikation"
          : "",
      )
      .replace("Herr/Frau^1", founderSalutation ?? "")
      .replace(
        "Herrn/Frau^1 ",
        founderSalutation
          ? `${founderSalutation === "Herr" ? "Herrn" : "Frau"} `
          : "",
      )
      .replace(
        "Herr/Frau^4 ",
        directorSalutation ? `${directorSalutation} ` : "",
      )
      .replace(
        /sofort in voller Höhe\/(zu 50 Prozent[\s\S]+?)\^3/,
        input.contribution === "full" ? "sofort in voller Höhe" : "$1",
      )
      .replace(/\^\d/g, "")
      .replace(/\[BLANK[^\]]*\]/g, "\u0000");
    const expected = normalizeWhitespace(selected)
      .split("\u0000")
      .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join(".+?");
    const actual = normalizeWhitespace(
      toPlainText(buildMusterprotokoll(input)),
    );
    expect(actual, name).toMatch(new RegExp(`^${expected}$`, "u"));
    expect(actual, name).not.toMatch(
      /Hinweise:|\^\d|Herr\/?n?\/Frau|\[mittels/,
    );
  }
});

it("preserves field paths for preview highlighting, including blanks and reused founder data", () => {
  const input = {
    ...exampleCase,
    notarisation: { mode: "in_person" },
  } as const;
  const model = buildMusterprotokoll(input);
  const runs = model.blocks.flatMap((block) => block.runs);
  expect(model.templateVersion).toBe("2022-08-01");
  expect(runs).toContainEqual({ kind: "blank", path: "notarisation.date" });
  expect(runs).toContainEqual({
    kind: "field",
    path: "shareCapitalCents",
    text: "fünfundzwanzigtausend",
  });
  expect(
    runs.filter(
      (run) => run.kind === "field" && run.path === "founder.firstName",
    ),
  ).toHaveLength(3);
});

it("looks up a registered template and handles unknown ids", () => {
  expect(getTemplate("musterprotokoll-einpersonen")).toBe(
    musterprotokollTemplate,
  );
  expect(getTemplate("future-template")).toBeUndefined();
  expect(getTemplate("toString")).toBeUndefined();
});

it("rejects unvalidated input at build time", () => {
  expect(() =>
    buildMusterprotokoll({ ...exampleCase, shareCapitalCents: 123 }),
  ).toThrow();
});
