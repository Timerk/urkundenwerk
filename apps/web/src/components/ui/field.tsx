import { useTranslations } from "next-intl";
import {
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  useId,
} from "react";

/** Ids that tie a control to its label, description, hint, and error. */
export type FieldIds = {
  controlId: string;
  describedBy: string | undefined;
  invalid: boolean;
};

const controlBase =
  "block w-full rounded-sm border bg-paper px-3 text-base text-ink placeholder:text-ink-faint/70 transition-colors hover:border-ink-faint disabled:cursor-not-allowed disabled:bg-surface disabled:text-ink-soft disabled:hover:border-rule aria-invalid:border-alert aria-invalid:hover:border-alert";

export const inputClasses = `${controlBase} h-10 border-rule-strong`;
export const textareaClasses = `${controlBase} min-h-24 border-rule-strong py-2 leading-relaxed`;

/**
 * A labelled form field. The render prop receives the ids for the control so
 * that its description, hint, and error are announced with it.
 */
export function Field({
  label,
  description,
  hint,
  error,
  id,
  optional,
  className = "",
  children,
}: {
  label: ReactNode;
  description?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  id?: string;
  optional?: boolean;
  className?: string;
  children: (ids: FieldIds) => ReactNode;
}) {
  const generated = useId();
  const t = useTranslations("common");
  const controlId = id ?? `field${generated}`;
  const descriptionId = description ? `${controlId}-description` : undefined;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy =
    [errorId, hintId, descriptionId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={`space-y-1.5 ${className}`}>
      <label
        htmlFor={controlId}
        className="flex items-baseline justify-between gap-3 text-sm font-medium text-ink"
      >
        <span>{label}</span>
        {optional ? (
          <span className="text-xs font-normal text-ink-faint">
            {t("optional")}
          </span>
        ) : null}
      </label>
      {children({ controlId, describedBy, invalid: Boolean(error) })}
      <FieldMessages
        description={description}
        descriptionId={descriptionId}
        hint={hint}
        hintId={hintId}
        error={error}
        errorId={errorId}
      />
    </div>
  );
}

export function FieldMessages({
  description,
  descriptionId,
  hint,
  hintId,
  error,
  errorId,
}: {
  description?: ReactNode;
  descriptionId?: string;
  hint?: ReactNode;
  hintId?: string;
  error?: ReactNode;
  errorId?: string;
}) {
  return (
    <>
      {error ? (
        <p id={errorId} className="flex gap-1.5 text-sm text-alert">
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            className="mt-[3px] size-3.5 shrink-0"
          >
            <path d="M8 1.5 15 14H1L8 1.5Z" fill="currentColor" />
            <path
              d="M8 6v3.5M8 11.4v.1"
              stroke="#fff"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          <span>{error}</span>
        </p>
      ) : null}
      {hint ? (
        <p
          id={hintId}
          className="rounded-sm border-l-2 border-hint-rule bg-hint-wash px-2.5 py-1.5 text-sm text-hint"
        >
          {hint}
        </p>
      ) : null}
      {description ? (
        <p id={descriptionId} className="text-sm text-ink-faint">
          {description}
        </p>
      ) : null}
    </>
  );
}

export function TextInput({
  ids,
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { ids: FieldIds }) {
  return (
    <input
      id={ids.controlId}
      aria-describedby={ids.describedBy}
      aria-invalid={ids.invalid || undefined}
      className={`${inputClasses} ${className}`}
      {...props}
    />
  );
}

export function TextArea({
  ids,
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { ids: FieldIds }) {
  return (
    <textarea
      id={ids.controlId}
      aria-describedby={ids.describedBy}
      aria-invalid={ids.invalid || undefined}
      className={`${textareaClasses} ${className}`}
      {...props}
    />
  );
}

export function Select({
  ids,
  className = "",
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { ids: FieldIds }) {
  return (
    <select
      id={ids.controlId}
      aria-describedby={ids.describedBy}
      aria-invalid={ids.invalid || undefined}
      className={`${inputClasses} appearance-none bg-[url("data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2016%2016'%3E%3Cpath%20d='M4%206l4%204%204-4'%20fill='none'%20stroke='%2318213a'%20stroke-width='1.5'/%3E%3C/svg%3E")] bg-[length:1rem] bg-[right_0.6rem_center] bg-no-repeat pr-9 ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}
