import { describe, expect, it } from "vitest";
import { readImportSample } from "./samples";

describe("readImportSample", () => {
  it.each([
    ["musterprotokoll", "Musterprotokoll.pdf", "%PDF"],
    ["articles", "Satzung.docx", "PK"],
  ])(
    "loads the committed fictional sample %s",
    async (id, filename, signature) => {
      const file = await readImportSample(id);
      expect(file?.name).toBe(filename);
      expect(await file?.slice(0, signature.length).text()).toBe(signature);
    },
  );

  it.each([
    "test",
    "../test/document.pdf",
    "toString",
    "",
    new File([], "document.pdf"),
  ])("rejects IDs outside the allowlist (%s)", async (id) => {
    expect(await readImportSample(id)).toBeNull();
  });
});
