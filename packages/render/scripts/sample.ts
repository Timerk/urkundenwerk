import { mkdir, writeFile } from "node:fs/promises";
import { buildMusterprotokoll } from "@urkundenwerk/core";
import { exampleCase } from "../../core/src/templates/musterprotokoll-einpersonen/fixtures";
import { renderDocx, renderPdf } from "../src";

const out = new URL("../out/", import.meta.url);
const model = buildMusterprotokoll({
  ...exampleCase,
  notarisation: { mode: "in_person" },
  notaryNotes: undefined,
});

await mkdir(out, { recursive: true });
const [docx, pdf] = await Promise.all([renderDocx(model), renderPdf(model)]);
await Promise.all([
  writeFile(new URL("musterprotokoll.docx", out), docx),
  writeFile(new URL("musterprotokoll.pdf", out), pdf),
]);
