"use client";

import type { MusterprotokollDraft } from "@urkundenwerk/core";
import { useLocale, useTranslations } from "next-intl";
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
import { formatIsoDate } from "../../../../../i18n/format";
import { useRuleMessages } from "../../../../../i18n/rule-messages";
import {
  controlId,
  type FieldPath,
  useFieldLabels,
} from "../../../../../lib/builder/fields";
import {
  type FieldIssue,
  formatEuros,
  getAt,
  parseEuros,
} from "../../../../../lib/builder/form-model";
import {
  dateInputHint,
  dateInputText,
  parseDateInput,
} from "../../../../../lib/date-input";

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
function useIssueMessages() {
  const rules = useRuleMessages();
  return (issue: FieldIssue | undefined, hint?: ReactNode) => {
    if (!issue) return { error: undefined, hint };
    const message = rules.message({ ...issue, paths: [issue.path] });
    return issue.severity === "error"
      ? { error: message, hint }
      : { error: undefined, hint: message };
  };
}

// Matches the draft schema's limits in @urkundenwerk/core.
const SHORT_TEXT = 200;
const LONG_TEXT = 2000;

export function TextField({
  path,
  label,
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
  const labels = useFieldLabels();
  const messages = useIssueMessages();
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
      label={label ?? labels.label(path)}
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

/**
 * A date typed as text in the UI language's order (`TT.MM.JJJJ` in German,
 * `DD/MM/YYYY` in English) and stored as an ISO date. Native date pickers
 * show the browser's locale, which made German users read US dates. The
 * format is the field's description, so it is announced with the label.
 */
export function DateField({
  path,
  label,
  description,
  optional,
  className,
  autoComplete = "off",
}: {
  path: FieldPath;
  label?: ReactNode;
  description?: ReactNode;
  optional?: boolean;
  className?: string;
  autoComplete?: string;
}) {
  const context = useDraft();
  const labels = useFieldLabels();
  const messages = useIssueMessages();
  const t = useTranslations("builder");
  const locale = useLocale();
  const stored = getAt(context.draft, path);
  const iso = typeof stored === "string" ? stored : undefined;
  const [text, setText] = useState(() => dateInputText(locale, iso));
  const [shownLocale, setShownLocale] = useState(locale);
  const [blurred, setBlurred] = useState(false);
  const parsed = parseDateInput(text);

  // A language switch keeps what was typed but rewrites a complete date
  // in the new language's order.
  if (shownLocale !== locale) {
    setShownLocale(locale);
    if (parsed.kind === "valid") setText(dateInputText(locale, parsed.iso));
  }

  const pattern = dateInputHint(locale);
  const issue = context.visibleIssue(path);
  // A format error waits for the user to leave the field, not mid-typing.
  const shown =
    parsed.kind === "invalid" && blurred
      ? {
          error:
            parsed.reason === "format"
              ? t("date.format", {
                  pattern,
                  example: formatIsoDate(locale, "1990-03-07"),
                })
              : t(`date.${parsed.reason}`),
          hint: undefined,
        }
      : messages(issue);

  return (
    <Field
      id={controlId(path)}
      label={label ?? labels.label(path)}
      description={description ?? t("hints.dateFormat", { pattern })}
      {...shown}
      optional={optional}
      className={className}
    >
      {(ids) => (
        <TextInput
          ids={ids}
          name={path}
          inputMode="numeric"
          autoComplete={autoComplete}
          placeholder={pattern}
          maxLength={10}
          value={text}
          readOnly={context.readOnly}
          data-field={path}
          className="max-w-44 tabular-nums"
          onChange={(event) => {
            const next = event.target.value;
            setText(next);
            const result = parseDateInput(next);
            context.update(
              path,
              result.kind === "valid" ? result.iso : undefined,
            );
          }}
          onFocus={() => context.setActivePath(path)}
          onBlur={() => {
            setBlurred(true);
            context.touch(path);
            context.setActivePath(undefined);
            if (parsed.kind === "valid") {
              setText(dateInputText(locale, parsed.iso));
            }
          }}
        />
      )}
    </Field>
  );
}

export function ChoiceField<T extends string>({
  path,
  legend,
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
  const labels = useFieldLabels();
  const messages = useIssueMessages();
  const issue = context.visibleIssue(path);

  return (
    <SegmentedControl
      legend={legend ?? labels.label(path)}
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

/** A euro amount in the UI language's format, stored as cents. */
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
  const labels = useFieldLabels();
  const messages = useIssueMessages();
  const t = useTranslations("builder.euro");
  const locale = useLocale();
  const allowCents = path === "filing.paidCents";
  const cents = getAt(context.draft, path);
  const [text, setText] = useState(() =>
    formatEuros(
      typeof cents === "number" ? cents : undefined,
      allowCents,
      locale,
    ),
  );
  const [shownLocale, setShownLocale] = useState(locale);
  const parsed = parseEuros(text, allowCents, shownLocale);

  // As for dates: a language switch rewrites a valid amount in its format.
  if (shownLocale !== locale) {
    setShownLocale(locale);
    if (parsed.kind === "valid") {
      setText(formatEuros(parsed.cents, allowCents, locale));
    }
  }
  const issue = context.visibleIssue(path);
  const shown =
    parsed.kind === "invalid"
      ? {
          error: allowCents
            ? t(parsed.reason === "format" ? "centsFormat" : "centsRange")
            : t(parsed.reason === "format" ? "wholeFormat" : "wholeRange"),
          hint,
        }
      : messages(issue, hint);

  return (
    <Field
      id={controlId(path)}
      label={labels.label(path)}
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
              const result = parseEuros(next, allowCents, locale);
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
                setText(formatEuros(parsed.cents, allowCents, locale));
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
  const labels = useFieldLabels();
  const messages = useIssueMessages();
  const id = controlId(path);
  const issue = context.visibleIssue(path);
  const error = messages(issue).error;
  const descriptionId = `${id}-description`;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className="space-y-1.5">
      <label className="flex items-start gap-2.5 text-sm font-medium text-ink">
        <input
          id={id}
          type="checkbox"
          checked={getAt(context.draft, path) === true}
          disabled={context.readOnly}
          data-field={path}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={
            errorId ? `${errorId} ${descriptionId}` : descriptionId
          }
          className="mt-0.5 size-4 shrink-0 accent-stamp"
          onChange={(event) => context.update(path, event.target.checked)}
          {...focusHandlers(path, context)}
        />
        {labels.label(path)}
      </label>
      <div className="pl-6">
        <FieldMessages
          description={description}
          descriptionId={descriptionId}
          error={error}
          errorId={errorId}
        />
      </div>
    </div>
  );
}
