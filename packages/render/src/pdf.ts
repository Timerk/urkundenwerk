import {
  inlineRunText,
  type DocumentBlock,
  type DocumentModel,
  type SignaturesBlock,
} from "@urkundenwerk/core";
import { buffer } from "node:stream/consumers";
import PDFDocument from "pdfkit";
import { author, documentTimestamp, fontData, layout } from "./layout";

function drawParagraph(
  pdf: PDFKit.PDFDocument,
  block: Exclude<DocumentBlock, SignaturesBlock>,
) {
  const heading = block.kind === "heading";
  const indent = block.kind === "clause" ? layout.clauseIndent : 0;
  const x = layout.left + indent;
  const width = pdf.page.width - layout.right - x;
  const options = {
    width,
    align: heading ? "center" : "left",
    lineGap: layout.lineGap,
  } as const;
  const text = block.runs.map(inlineRunText).join("");

  pdf.fontSize(heading ? layout.headingSize : layout.bodySize);
  if (block.kind === "clause") {
    const firstLines = Math.min(
      pdf.heightOfString(text, options),
      2 * (pdf.currentLineHeight(true) + layout.lineGap),
    );
    if (pdf.y + firstLines > pdf.page.height - layout.bottom) pdf.addPage();

    pdf.text(`${block.number}.`, layout.left, pdf.y, { lineBreak: false });
  }
  pdf.text(text, x, pdf.y, options);
  pdf.y += heading ? layout.headingGap : layout.paragraphGap;
}

function drawSignatures(pdf: PDFKit.PDFDocument, block: SignaturesBlock) {
  const x = layout.left;
  const width = pdf.page.width - layout.right - x;
  const options = { width, lineGap: layout.lineGap };
  const closing = block.closing.map(inlineRunText).join("");
  const closingHeight = pdf
    .fontSize(layout.bodySize)
    .heightOfString(closing, options);
  pdf.fontSize(layout.signatureLabelSize);
  const height = block.signatories.reduce(
    (total, { label }) =>
      total +
      layout.signatureSpace +
      layout.signatureLabelGap +
      pdf.heightOfString(label, options),
    closingHeight,
  );
  const bottom = pdf.page.height - layout.bottom;
  if (layout.top + height > bottom) {
    throw new Error(
      "Signature block exceeds the available height of a PDF page",
    );
  }
  if (pdf.y + height > bottom) pdf.addPage();

  pdf.fontSize(layout.bodySize).text(closing, x, pdf.y, options);
  pdf.fontSize(layout.signatureLabelSize);
  for (const { label } of block.signatories) {
    const lineY = pdf.y + layout.signatureSpace;
    pdf
      .save()
      .lineWidth(0.5)
      .moveTo(x, lineY)
      .lineTo(x + layout.signatureWidth, lineY)
      .stroke()
      .restore();
    pdf.text(label, x, lineY + layout.signatureLabelGap, options);
  }
  pdf.y += layout.paragraphGap;
}

function drawBlock(pdf: PDFKit.PDFDocument, block: DocumentBlock): void {
  switch (block.kind) {
    case "heading":
    case "paragraph":
    case "clause":
      return drawParagraph(pdf, block);
    case "signatures":
      return drawSignatures(pdf, block);
  }
  return block satisfies never;
}

export async function renderPdf(model: DocumentModel): Promise<Uint8Array> {
  const pdf = new PDFDocument({
    size: "A4",
    margins: {
      top: layout.top,
      right: layout.right,
      bottom: layout.bottom,
      left: layout.left,
    },
    bufferPages: true,
    info: {
      Title: model.title,
      Subject: `${model.templateId} @ ${model.templateVersion}`,
      Author: author,
      CreationDate: new Date(documentTimestamp),
      ModDate: new Date(documentTimestamp),
    },
  });

  pdf.font(fontData);
  for (const block of model.blocks) drawBlock(pdf, block);

  pdf.fontSize(layout.footerSize);
  const { start, count } = pdf.bufferedPageRange();
  for (let index = start; index < start + count; index++) {
    pdf.switchToPage(index);
    const number = String(index + 1);
    const x =
      (pdf.page.width +
        layout.left -
        layout.right -
        pdf.widthOfString(number)) /
      2;
    pdf.text(number, x, pdf.page.height - layout.footer - layout.footerSize, {
      lineBreak: false,
    });
  }

  const result = buffer(pdf);
  pdf.end();
  return result;
}
