import type {
  DocumentBlock,
  DocumentModel,
  InlineRun,
} from "@urkundenwerk/core";
import type { CSSProperties, KeyboardEvent, ReactNode } from "react";
import { blankLabel, fieldLabel } from "../lib/builder/fields";

type PreviewProps = {
  model: DocumentModel;
  /** Called with a field path when a value or blank is chosen. */
  onSelect?: (path: string) => void;
  /** The path whose values are highlighted, e.g. the focused input. */
  activePath?: string;
  className?: string;
  /** Limits the blocks shown, e.g. for an excerpt. */
  blockFilter?: (block: DocumentBlock, index: number) => boolean;
};

function Run({
  run,
  onSelect,
  activePath,
  index,
}: {
  run: InlineRun;
  onSelect?: (path: string) => void;
  activePath?: string;
  index: number;
}): ReactNode {
  if (run.kind === "text") return run.text;

  const active = run.path === activePath || undefined;
  const style = { "--write-index": index } as CSSProperties;
  // Inline spans rather than buttons: a button is laid out as an inline
  // block, so a long value could not wrap with the sentence around it.
  const interactive = onSelect && {
    role: "button",
    tabIndex: 0,
    onClick: () => onSelect(run.path),
    onKeyDown: (event: KeyboardEvent<HTMLSpanElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onSelect(run.path);
      }
    },
  };

  if (run.kind === "field") {
    return (
      <span
        className="deed-field"
        data-path={run.path}
        data-active={active}
        style={style}
        {...(interactive && {
          ...interactive,
          "aria-label": `${run.text.trim()}, edit ${fieldLabel(run.path)}`,
        })}
      >
        {run.text}
      </span>
    );
  }

  const label = blankLabel(run.path);
  return (
    <span
      className="deed-blank"
      data-path={run.path}
      data-active={active}
      {...(interactive && {
        ...interactive,
        "aria-label": `Missing: ${fieldLabel(run.path)}`,
      })}
    >
      {label}
    </span>
  );
}

/**
 * Renders a `DocumentModel` as a sheet of paper. The text comes from the
 * model only; this component adds layout and the field affordances.
 */
export function DocumentPreview({
  model,
  onSelect,
  activePath,
  className = "",
  blockFilter,
}: PreviewProps) {
  let fieldIndex = 0;
  const renderRuns = (runs: readonly InlineRun[]) =>
    runs.map((run, index) => (
      <Run
        key={index}
        run={run}
        onSelect={onSelect}
        activePath={activePath}
        index={run.kind === "field" ? fieldIndex++ : 0}
      />
    ));

  const blocks = model.blocks
    .map((block, index) => ({ block, index }))
    .filter(({ block, index }) => blockFilter?.(block, index) ?? true);

  return (
    <article
      className={`deed ${className}`}
      lang="de"
      aria-label={model.title}
      data-template={`${model.templateId}@${model.templateVersion}`}
    >
      {blocks.map(({ block, index }) => {
        switch (block.kind) {
          case "heading":
            return (
              <h2
                key={index}
                className="mb-[1.6em] text-center text-[1.39em] leading-snug font-semibold whitespace-pre-line"
              >
                {renderRuns(block.runs)}
              </h2>
            );
          case "paragraph":
            return (
              <p key={index} className="mb-[0.85em]">
                {renderRuns(block.runs)}
              </p>
            );
          case "clause":
            return (
              <p
                key={index}
                className="mb-[0.85em] grid grid-cols-[1.8em_1fr]"
                data-clause={block.number}
              >
                <span>{block.number}.</span>
                <span>{renderRuns(block.runs)}</span>
              </p>
            );
          case "signatures":
            return (
              <div key={index} className="mt-[1.6em] break-inside-avoid">
                <p>{renderRuns(block.closing)}</p>
                {block.signatories.map(({ label }) => (
                  <div key={label} className="mt-[2.6em] w-[48%] min-w-40">
                    <div className="border-b border-[#1b1f29]/70" />
                    <p className="mt-[0.3em] text-[0.8em]">{label}</p>
                  </div>
                ))}
              </div>
            );
        }
        return null;
      })}
    </article>
  );
}
