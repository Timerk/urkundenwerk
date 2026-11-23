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
  FieldMessages,
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

/** Errors show as errors; warnings and notes take the place of the hint. */
function messages(issue: FieldIssue | undefined, hint?: ReactNode) {
  if (!issue) return { error: undefined, hint };
  return issue.severity === "error"
    ? { error: issue.message, hint }
    : { error: undefined, hint: issue.message };
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
      {...messages(issue, hint)}
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
      {...messages(issue)}
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
      {...messages(issue, hint)}
      description={description}
      layout={layout}
    />
  );
}

/** German euro input stored as cents. */
export function EuroField({
  path,
  hint,
  description,
}: {
  path: "shareCapitalCents" | "filing.paidCents";
  hint?: ReactNode;
  description?: ReactNode;
}) {
  const context = useDraft();
  const allowCents = path === "filing.paidCents";
  const cents = getAt(context.draft, path);
  const [text, setText] = useState(() =>
    formatEuros(typeof cents === "number" ? cents : undefined, allowCents),
  );
  const parsed = parseEuros(text, allowCents);
  const issue = context.visibleIssue(path);
  const shown =
    parsed.kind === "invalid"
      ? { error: parsed.message, hint }
      : messages(issue, hint);

  return (
    <Field
      id={controlId(path)}
      label={fieldLabel(path)}
      description={description}
      {...shown}
    >
      {(ids) => (
        <div className="relative max-w-56">
          <TextInput
            ids={ids}
            name={path}
            inputMode={allowCents ? "decimal" : "numeric"}
            autoComplete="off"
            value={text}
            readOnly={context.readOnly}
            data-field={path}
            className="pr-9 text-right tabular-nums"
            onChange={(event) => {
              const next = event.target.value;
              setText(next);
              const result = parseEuros(next, allowCents);
              context.update(
                path,
                result.kind === "valid" ? result.cents : undefined,
              );
            }}
            onFocus={() => context.setActivePath(path)}
            onBlur={() => {
              context.touch(path);
              context.setActivePath(undefined);
              if (parsed.kind === "valid")
                setText(formatEuros(parsed.cents, allowCents));
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

export function CheckboxField({
  path,
  description,
}: {
  path: FieldPath;
  description: string;
}) {
  const context = useDraft();
  const id = controlId(path);
  const issue = context.visibleIssue(path);
  const descriptionId = `${id}-description`;
  const errorId = issue ? `${id}-error` : undefined;
  return (
    <div className="space-y-1.5">
      <label className="flex items-start gap-2.5 text-sm font-medium text-ink">
        <input
          id={id}
          type="checkbox"
          checked={getAt(context.draft, path) === true}
          disabled={context.readOnly}
          data-field={path}
          aria-invalid={Boolean(issue) || undefined}
          aria-describedby={
            errorId ? `${errorId} ${descriptionId}` : descriptionId
          }
          className="mt-0.5 size-4 shrink-0 accent-stamp"
          onChange={(event) => context.update(path, event.target.checked)}
          {...focusHandlers(path, context)}
        />
        {fieldLabel(path)}
      </label>
      <div className="pl-6">
        <FieldMessages
          description={description}
          descriptionId={descriptionId}
          error={issue?.message}
          errorId={errorId}
        />
      </div>
    </div>
  );
}
