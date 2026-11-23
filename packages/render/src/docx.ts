import {
  inlineRunText,
  type DocumentBlock,
  type DocumentModel,
} from "@urkundenwerk/core";
import {
  AlignmentType,
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

function paragraph(block: DocumentBlock): Paragraph {
  const heading = block.kind === "heading";
  const indent = twips(layout.clauseIndent);
  const children = block.runs.flatMap((run) =>
    inlineRunText(run)
      .split("\n")
      .map(
        (text, index) =>
          new TextRun({ text, break: index === 0 ? undefined : 1 }),
      ),
  );
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
        children: model.blocks.map(paragraph),
      },
    ],
  });

  return normaliseDocx(await Packer.toBuffer(document));
}
