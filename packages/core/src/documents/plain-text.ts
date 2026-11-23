import type { DocumentModel, InlineRun } from "./model";

const dottedLine = "........................";

export function inlineRunText(run: InlineRun): string {
  return run.kind === "blank" ? dottedLine : run.text;
}

/** Render with LF line endings and one blank line between blocks. */
export function toPlainText(model: DocumentModel): string {
  return model.blocks
    .map((block) => {
      const prefix = block.kind === "clause" ? `${block.number}. ` : "";
      return prefix + block.runs.map(inlineRunText).join("");
    })
    .join("\n\n");
}
