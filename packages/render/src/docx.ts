import {
  inlineRunText,
  type DocumentBlock,
  type DocumentModel,
  type InlineRun,
  type SignaturesBlock,
} from "@urkundenwerk/core";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Packer,
  PageNumber,
  Paragraph,
  Tab,
  TabStopType,
  TextRun,
  convertMillimetersToTwip,
} from "docx";
import { normaliseDocx } from "./docx-determinism";
import { author, fontData, fontName, layout } from "./layout";

const twips = (points: number) => Math.round(points * 20);

function textRuns(runs: readonly InlineRun[], size?: number): TextRun[] {
  return runs.flatMap((run) =>
    inlineRunText(run)
      .split("\n")
      .map(
        (text, index) =>
          new TextRun({ text, size, break: index === 0 ? undefined : 1 }),
      ),
  );
}

function paragraph(block: Exclude<DocumentBlock, SignaturesBlock>): Paragraph {
  const heading = block.kind === "heading";
  const indent = twips(layout.clauseIndent);
  const children = textRuns(block.runs);
  if (block.kind === "clause") {
    children.unshift(
      new TextRun({ children: [`${block.number}.`, new Tab()] }),
    );
  }

  return new Paragraph({
    children,
    alignment: heading ? AlignmentType.CENTER : AlignmentType.LEFT,
    style: heading ? "DocumentTitle" : undefined,
    indent:
      block.kind === "clause" ? { left: indent, hanging: indent } : undefined,
    tabStops:
      block.kind === "clause"
        ? [{ type: TabStopType.LEFT, position: indent }]
        : undefined,
    keepNext: heading,
    widowControl: true,
    spacing: {
      after: twips(heading ? layout.headingGap : layout.paragraphGap),
    },
  });
}

function signatureParagraphs(block: SignaturesBlock): Paragraph[] {
  return [
    new Paragraph({
      children: textRuns(block.closing),
      keepNext: block.signatories.length > 0,
      keepLines: true,
    }),
    ...block.signatories.flatMap(({ label }, index) => [
      new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 4 } },
        indent: {
          right:
            convertMillimetersToTwip(210) -
            twips(layout.left + layout.right + layout.signatureWidth),
        },
        spacing: { line: twips(layout.signatureSpace), lineRule: "exact" },
        keepNext: true,
        keepLines: true,
      }),
      new Paragraph({
        children: textRuns(
          [{ kind: "text", text: label }],
          layout.signatureLabelSize * 2,
        ),
        spacing: { before: twips(layout.signatureLabelGap) },
        keepNext: index < block.signatories.length - 1,
        keepLines: true,
      }),
    ]),
  ];
}

function blockParagraphs(block: DocumentBlock): Paragraph[] {
  switch (block.kind) {
    case "heading":
    case "paragraph":
    case "clause":
      return [paragraph(block)];
    case "signatures":
      return signatureParagraphs(block);
  }
}

export async function renderDocx(model: DocumentModel): Promise<Uint8Array> {
  const document = new Document({
    title: model.title,
    subject: `${model.templateId} @ ${model.templateVersion}`,
    creator: author,
    lastModifiedBy: author,
    fonts: [{ name: fontName, data: fontData }],
    styles: {
      default: {
        document: {
          run: {
            font: fontName,
            size: layout.bodySize * 2,
            language: { value: "de-DE" },
          },
          paragraph: { spacing: { line: 280 } },
        },
      },
      paragraphStyles: [
        {
          id: "DocumentTitle",
          name: "Document Title",
          basedOn: "Normal",
          run: { size: layout.headingSize * 2 },
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              width: convertMillimetersToTwip(210),
              height: convertMillimetersToTwip(297),
            },
            margin: {
              top: twips(layout.top),
              right: twips(layout.right),
              bottom: twips(layout.bottom),
              left: twips(layout.left),
              footer: twips(layout.footer),
            },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: layout.footerSize * 2,
                  }),
                ],
              }),
            ],
          }),
        },
        children: model.blocks.flatMap(blockParagraphs),
      },
    ],
  });

  return normaliseDocx(await Packer.toBuffer(document));
}
