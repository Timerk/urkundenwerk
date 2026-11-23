import { createHash } from "node:crypto";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { documentTimestamp, fontData } from "./layout";

const stableKey = createHash("sha256")
  .update(fontData)
  .digest("hex")
  .slice(0, 32)
  .replace(/^(\w{8})(\w{4})(\w{4})(\w{4})(\w{12})$/, "$1-$2-$3-$4-$5")
  .toUpperCase();

function stableEmbeddedFont() {
  // ECMA-376 uses the reversed GUID bytes twice to XOR the first 32 font bytes.
  const key = Buffer.from(stableKey.replaceAll("-", ""), "hex").reverse();
  const font = Uint8Array.from(fontData);
  for (let index = 0; index < 32; index++) {
    font[index] = font[index]! ^ key[index % key.length]!;
  }
  return font;
}

export function normaliseDocx(bytes: Uint8Array): Uint8Array {
  const parts = unzipSync(bytes);
  const core = "docProps/core.xml";
  const fontTable = "word/fontTable.xml";
  const fontFile = "word/fonts/font1.odttf";
  if (!parts[core] || !parts[fontTable] || !parts[fontFile]) {
    throw new Error("Expected DOCX metadata and the embedded regular font");
  }

  // docx supplies current core property dates and a random obfuscation key.
  parts[core] = strToU8(
    strFromU8(parts[core]).replace(
      /(<dcterms:(?:created|modified)[^>]*>)[^<]+/g,
      `$1${documentTimestamp}`,
    ),
  );
  const fontKeyPattern = /w:fontKey="\{[\da-f-]+\}"/gi;
  const fontXml = strFromU8(parts[fontTable]);
  if ([...fontXml.matchAll(fontKeyPattern)].length !== 1) {
    throw new Error("Expected one embedded DOCX font key");
  }
  parts[fontTable] = strToU8(
    fontXml.replace(fontKeyPattern, `w:fontKey="{${stableKey}}"`),
  );
  parts[fontFile] = stableEmbeddedFont();

  // ZIP records local calendar time without a time zone.
  return zipSync(parts, { mtime: new Date(2000, 0, 1) });
}
