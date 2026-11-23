"use client";

import { type ReactNode, useId } from "react";
import { FieldMessages } from "./field";

export type SegmentedOption<T extends string> = {
  value: T;
  label: ReactNode;
  description?: ReactNode;
};

/**
 * A radio group drawn as a segmented control. It keeps native radio
 * semantics: Tab enters the group, arrow keys move the selection.
 */
export function SegmentedControl<T extends string>({
  legend,
  name,
  value,
  options,
  onChange,
  disabled,
  error,
  hint,
  description,
  dataField,
  layout = "row",
}: {
  legend: ReactNode;
  name: string;
  value: T | undefined;
  options: readonly SegmentedOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
  error?: ReactNode;
  hint?: ReactNode;
  description?: ReactNode;
  /** The draft path, so the preview can move focus to this group. */
  dataField?: string;
  layout?: "row" | "stack";
}) {
  const id = useId();
  const errorId = error ? `${id}-error` : undefined;
  const hintId = hint ? `${id}-hint` : undefined;
  const descriptionId = description ? `${id}-description` : undefined;
  const describedBy =
    [errorId, hintId, descriptionId].filter(Boolean).join(" ") || undefined;

  return (
    <fieldset
      className="min-w-0 space-y-1.5"
      aria-describedby={describedBy}
      aria-invalid={error ? true : undefined}
      data-field={dataField}
      disabled={disabled}
    >
      <legend className="mb-1.5 text-sm font-medium text-ink">{legend}</legend>
      <div
        className={
          layout === "row"
            ? "flex flex-wrap rounded-sm border border-rule-strong bg-paper p-0.5 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-stamp"
            : "grid gap-2"
        }
      >
        {options.map((option) => {
          const checked = value === option.value;
          return (
            <label
              key={option.value}
              className={
                layout === "row"
                  ? `relative flex min-h-9 flex-1 cursor-pointer items-center justify-center rounded-[3px] px-3 text-center text-sm transition-colors has-[:disabled]:cursor-not-allowed ${
                      checked
                        ? "bg-ink font-medium text-white"
                        : "text-ink-soft hover:bg-surface hover:text-ink"
                    }`
                  : `relative flex cursor-pointer gap-3 rounded-sm border px-3 py-2.5 text-sm transition-colors has-[:disabled]:cursor-not-allowed has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-stamp ${
                      checked
                        ? "border-ink bg-paper shadow-[inset_3px_0_0_var(--color-ink)]"
                        : "border-rule-strong bg-paper hover:border-ink-faint"
                    }`
              }
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={checked}
                onChange={() => onChange(option.value)}
                className={
                  layout === "row"
                    ? "absolute inset-0 cursor-[inherit] opacity-0"
                    : "mt-0.5 size-4 shrink-0 accent-ink"
                }
              />
              <span className={layout === "stack" ? "space-y-0.5" : ""}>
                <span className="block">{option.label}</span>
                {option.description ? (
                  <span className="block text-ink-faint">
                    {option.description}
                  </span>
                ) : null}
              </span>
            </label>
          );
        })}
      </div>
      <FieldMessages
        error={error}
        errorId={errorId}
        hint={hint}
        hintId={hintId}
        description={description}
        descriptionId={descriptionId}
      />
    </fieldset>
  );
}
