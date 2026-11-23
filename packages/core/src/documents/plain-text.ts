import type { DocumentModel, InlineRun } from "./model";

const dottedLine = "........................";

export function inlineRunText(run: InlineRun): string {
  return run.kind === "blank" ? dottedLine : run.text;
}

/** Render with LF line endings and one blank line between blocks. */
export function toPlainText(model: DocumentModel): string {
  return model.blocks
    .map((block): string => {
      switch (block.kind) {
        case "heading":
        case "paragraph":
          return block.runs.map(inlineRunText).join("");
        case "clause":
          return `${block.number}. ${block.runs.map(inlineRunText).join("")}`;
        case "signatures":
          return [
            block.closing.map(inlineRunText).join(""),
            ...block.signatories.map(
              ({ label }) => `______________________________\n${label}`,
            ),
          ].join("\n\n");
      }
    })
    .join("\n\n");
}
