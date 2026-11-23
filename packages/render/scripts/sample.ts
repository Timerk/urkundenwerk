import { mkdir, writeFile } from "node:fs/promises";
import { buildMusterprotokoll, buildRegisterFiling } from "@urkundenwerk/core";
import { exampleFiling } from "../../core/src/templates/handelsregisteranmeldung-gmbh/fixtures";
import {
  exampleCase,
  exampleContext,
} from "../../core/src/templates/musterprotokoll-einpersonen/fixtures";
import { renderDocx, renderPdf } from "../src";

const out = new URL("../out/", import.meta.url);
const model = buildMusterprotokoll(
  {
    ...exampleCase,
    notarisation: { mode: "in_person" },
    notaryNotes: undefined,
  },
  exampleContext,
);

await mkdir(out, { recursive: true });
const [docx, pdf, filingPdf] = await Promise.all([
  renderDocx(model),
  renderPdf(model),
  renderPdf(buildRegisterFiling(exampleFiling, exampleContext)),
]);
await Promise.all([
  writeFile(new URL("musterprotokoll.docx", out), docx),
  writeFile(new URL("musterprotokoll.pdf", out), pdf),
  writeFile(new URL("handelsregisteranmeldung.pdf", out), filingPdf),
]);
