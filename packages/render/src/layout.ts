import { readFileSync } from "node:fs";

export const fontName = "Source Serif 4";
export const fontData = readFileSync(
  new URL("../assets/SourceSerif4-Regular.ttf", import.meta.url),
);

/** Dimensions in points. */
export const layout = {
  top: 65,
  right: 70,
  bottom: 65,
  left: 80,
  footer: 35,
  bodySize: 11.5,
  headingSize: 16,
  footerSize: 9,
  clauseIndent: 21,
  paragraphGap: 10,
  headingGap: 19,
  lineGap: 2,
} as const;

export const author = "Urkundenwerk";
// Fixed export metadata is independent of dates appearing in the document body.
export const documentTimestamp = "2000-01-01T00:00:00.000Z";
