import { describe, expect, it } from "vitest";
import type { DocumentModel, InlineRun } from "../../documents/model";
import { toPlainText } from "../../documents/plain-text";
import {
  exampleCase,
  exampleContext,
  exampleDirector,
  exampleEntity,
} from "./fixtures";
import { buildMusterprotokoll, buildMusterprotokollPreview } from "./template";

function runsOf(model: DocumentModel): InlineRun[] {
  return model.blocks.flatMap((block) =>
    block.kind === "signatures" ? block.closing : block.runs,
  );
}

function blankPaths(model: DocumentModel): string[] {
  return runsOf(model).flatMap((run) =>
    run.kind === "blank" ? [run.path] : [],
  );
}

describe("buildMusterprotokollPreview", () => {
  it("matches the validated model for complete input", () => {
    expect(buildMusterprotokollPreview(exampleCase)).toEqual(
      buildMusterprotokoll(exampleCase, exampleContext),
    );
    const entityCase = {
      ...exampleCase,
      notarisation: { mode: "video" },
      founder: exampleEntity,
      managingDirector: exampleDirector,
    } as const;
    expect(buildMusterprotokollPreview(entityCase)).toEqual(
      buildMusterprotokoll(entityCase, exampleContext),
    );
  });

  it("assembles an empty draft with a blank for every required value", () => {
    const model = buildMusterprotokollPreview({});

    expect(new Set(blankPaths(model))).toEqual(
      new Set([
        "notarisation.deedNumber",
        "notarisation.date",
        "notarisation.notaryName",
        "notarisation.notarySeat",
        "founder.firstName",
        "founder.lastName",
        "founder.birthDate",
        "founder.address.street",
        "founder.address.postalCode",
        "founder.address.city",
        "company.name",
        "company.seat",
        "company.purpose",
        "shareCapitalCents",
        "contribution",
        "managingDirector.kind",
        "notaryNotes",
      ]),
    );
    expect(model.blocks.at(-1)).toMatchObject({
      kind: "signatures",
      signatories: [{ label: "Gesellschafter/in" }, { label: "Notar/in" }],
    });
  });

  it("keeps the statutory wording around partial values", () => {
    const text = toPlainText(
      buildMusterprotokollPreview({
        company: { name: "  Musterlicht GmbH ", seat: "Musterstadt" },
        shareCapitalCents: 2_500_000,
      }),
    );

    expect(text).toContain(
      "unter der Firma Musterlicht GmbH mit dem Sitz in Musterstadt.",
    );
    expect(text).toContain(
      "beträgt 25.000 € (i. W. fünfundzwanzigtausend Euro)",
    );
  });

  it("leaves the amount in words blank for amounts with cents", () => {
    const runs = runsOf(
      buildMusterprotokollPreview({ shareCapitalCents: 150 }),
    );
    expect(runs).toContainEqual({
      kind: "field",
      path: "shareCapitalCents",
      text: "1,50 €",
    });
    expect(runs).toContainEqual({ kind: "blank", path: "shareCapitalCents" });
  });

  it("leaves the director blank when a legal entity would be appointed", () => {
    const model = buildMusterprotokollPreview({
      founder: { kind: "legal_entity", name: "Musterlicht Holding GmbH" },
      managingDirector: { kind: "founder" },
    });
    expect(blankPaths(model)).toContain("managingDirector.kind");
  });

  it("omits the signature block for video notarisation", () => {
    const model = buildMusterprotokollPreview({
      notarisation: { mode: "video" },
    });
    expect(model.blocks.at(-1)).toMatchObject({ kind: "clause", number: 7 });
  });
});
