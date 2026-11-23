"use client";

import type { MusterprotokollDraft } from "@urkundenwerk/core";
import {
  type ChangeEvent,
  createContext,
  type ReactNode,
  use,
  useState,
} from "react";
import {
  Field,
  type FieldIds,
  TextArea,
  TextInput,
} from "../../../../../components/ui/field";
import {
  SegmentedControl,
  type SegmentedOption,
} from "../../../../../components/ui/segmented";
import {
  controlId,
  type FieldPath,
  fieldLabel,
} from "../../../../../lib/builder/fields";
import {
  type FieldIssue,
  formatEuros,
  getAt,
  parseEuros,
} from "../../../../../lib/builder/form-model";

type DraftContextValue = {
  draft: MusterprotokollDraft;
  readOnly: boolean;
  update: (path: string, value: unknown) => void;
  /** The issue to show for a path, if it should be shown yet. */
  visibleIssue: (path: string) => FieldIssue | undefined;
  touch: (path: string) => void;
  setActivePath: (path: string | undefined) => void;
};

const DraftContext = createContext<DraftContextValue | null>(null);

export const DraftProvider = DraftContext.Provider;

function useDraft(): DraftContextValue {
  const context = use(DraftContext);
  if (!context) throw new Error("Draft fields need a DraftProvider.");
  return context;
}

function focusHandlers(path: string, context: DraftContextValue) {
  return {
    onFocus: () => context.setActivePath(path),
    onBlur: () => {
      context.touch(path);
      context.setActivePath(undefined);
    },
  };
}

// Matches the draft schema's limits in @urkundenwerk/core.
const SHORT_TEXT = 200;
const LONG_TEXT = 2000;

export function TextField({
  path,
  label = fieldLabel(path),
  description,
  hint,
  optional,
  multiline,
  autoComplete = "off",
  placeholder,
  className,
}: {
  path: FieldPath;
  label?: ReactNode;
  description?: ReactNode;
  hint?: ReactNode;
  optional?: boolean;
  multiline?: boolean;
  autoComplete?: string;
  placeholder?: string;
  className?: string;
}) {
  const context = useDraft();
  const value = getAt(context.draft, path);
  const issue = context.visibleIssue(path);
  const shared = {
    name: path,
    value: typeof value === "string" ? value : "",
    readOnly: context.readOnly,
    placeholder,
    "data-field": path,
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      context.update(path, event.target.value),
    ...focusHandlers(path, context),
  };

  return (
    <Field
      id={controlId(path)}
      label={label}
      description={description}
      hint={hint}
      error={issue?.message}
      optional={optional}
      className={className}
    >
      {(ids: FieldIds) =>
        multiline ? (
          <TextArea ids={ids} maxLength={LONG_TEXT} rows={3} {...shared} />
        ) : (
          <TextInput
            ids={ids}
            maxLength={SHORT_TEXT}
            autoComplete={autoComplete}
            {...shared}
          />
        )
      }
    </Field>
  );
}

export function DateField({
  path,
  label = fieldLabel(path),
  description,
  optional,
  className,
}: {
  path: FieldPath;
  label?: ReactNode;
  description?: ReactNode;
  optional?: boolean;
  className?: string;
}) {
  const context = useDraft();
  const value = getAt(context.draft, path);
  const issue = context.visibleIssue(path);

  return (
    <Field
      id={controlId(path)}
      label={label}
      description={description}
      error={issue?.message}
      optional={optional}
      className={className}
    >
      {(ids) => (
        <TextInput
          ids={ids}
          type="date"
          name={path}
          min="1900-01-01"
          max="2099-12-31"
          value={typeof value === "string" ? value : ""}
          readOnly={context.readOnly}
          data-field={path}
          onChange={(event) =>
            context.update(path, event.target.value || undefined)
          }
          {...focusHandlers(path, context)}
        />
      )}
    </Field>
  );
}

export function ChoiceField<T extends string>({
  path,
  legend = fieldLabel(path),
  options,
  description,
  hint,
  layout,
  toValue = (value: T) => value,
  fromValue = (value: unknown) => value as T | undefined,
}: {
  path: FieldPath;
  legend?: ReactNode;
  options: readonly SegmentedOption<T>[];
  description?: ReactNode;
  hint?: ReactNode;
  layout?: "row" | "stack";
  /** Maps the option to the stored value, e.g. "none" to `null`. */
  toValue?: (value: T) => unknown;
  fromValue?: (value: unknown) => T | undefined;
}) {
  const context = useDraft();
  const issue = context.visibleIssue(path);

  return (
    <SegmentedControl
      legend={legend}
      name={path}
      dataField={path}
      value={fromValue(getAt(context.draft, path))}
      options={options}
      onChange={(value) => {
        context.update(path, toValue(value));
        context.touch(path);
      }}
      disabled={context.readOnly}
      error={issue?.message}
      hint={hint}
      description={description}
      layout={layout}
    />
  );
}

/** Stammkapital in whole euros, stored as cents. */
export function CapitalField({
  hint,
  description,
}: {
  hint?: ReactNode;
  description?: ReactNode;
}) {
  const context = useDraft();
  const path = "shareCapitalCents";
  const cents = getAt(context.draft, path);
  const [text, setText] = useState(() =>
    formatEuros(typeof cents === "number" ? cents : undefined),
  );
  const parsed = parseEuros(text);
  const issue = context.visibleIssue(path);
  const error = parsed.kind === "invalid" ? parsed.message : issue?.message;

  return (
    <Field
      id={controlId(path)}
      label={fieldLabel(path)}
      description={description}
      hint={hint}
      error={error}
    >
      {(ids) => (
        <div className="relative max-w-56">
          <TextInput
            ids={ids}
            name={path}
            inputMode="numeric"
            autoComplete="off"
            value={text}
            readOnly={context.readOnly}
            data-field={path}
            className="pr-9 text-right tabular-nums"
            onChange={(event) => {
              const next = event.target.value;
              setText(next);
              const result = parseEuros(next);
              context.update(
                path,
                result.kind === "valid" ? result.cents : undefined,
              );
            }}
            onFocus={() => context.setActivePath(path)}
            onBlur={() => {
              context.touch(path);
              context.setActivePath(undefined);
              if (parsed.kind === "valid") setText(formatEuros(parsed.cents));
            }}
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-ink-faint"
          >
            €
          </span>
        </div>
      )}
    </Field>
  );
}
