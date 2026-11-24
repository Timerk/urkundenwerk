"use client";

import {
  type ButtonHTMLAttributes,
  type ReactNode,
  useEffect,
  useId,
  useRef,
} from "react";
import { Button } from "./button";

/**
 * The second step of a destructive action, shown in place of the control
 * that asked for it. It names what will be lost, offers the action again in
 * solid alert red, and lets the person back out with Cancel or Escape.
 * Focus moves to the question when it opens and back to the trigger when it
 * is cancelled, so keyboard and screen reader users stay where they were.
 */
export function ConfirmPanel({
  title,
  children,
  confirmLabel,
  pendingLabel,
  cancelLabel,
  pending = false,
  onCancel,
  confirmProps,
  className = "",
}: {
  title: ReactNode;
  children?: ReactNode;
  confirmLabel: ReactNode;
  pendingLabel?: ReactNode;
  cancelLabel: ReactNode;
  pending?: boolean;
  onCancel: () => void;
  /** Submit attributes, such as `name` and `value`, for the confirm button. */
  confirmProps?: ButtonHTMLAttributes<HTMLButtonElement>;
  className?: string;
}) {
  const id = useId();
  const heading = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);

  return (
    <div
      role="group"
      aria-labelledby={`${id}-title`}
      aria-describedby={children ? `${id}-body` : undefined}
      onKeyDown={(event) => {
        if (event.key === "Escape" && !pending) {
          event.preventDefault();
          onCancel();
        }
      }}
      className={`rounded-sm border-y border-r border-l-[3px] border-alert/30 border-l-alert bg-alert-wash px-4 py-3 text-sm ${className}`}
    >
      <p
        ref={heading}
        id={`${id}-title`}
        tabIndex={-1}
        className="font-medium text-ink outline-none"
      >
        {title}
      </p>
      {children ? (
        <div id={`${id}-body`} className="mt-1 max-w-prose text-ink-soft">
          {children}
        </div>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="submit"
          variant="destructive"
          size="sm"
          disabled={pending}
          {...confirmProps}
        >
          {pending && pendingLabel ? pendingLabel : confirmLabel}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={onCancel}
          disabled={pending}
        >
          {cancelLabel}
        </Button>
      </div>
    </div>
  );
}

/**
 * A message that screen readers announce when it changes. The region is
 * always rendered, because a live region that appears together with its
 * text is not reliably announced.
 */
export function StatusMessage({
  message,
  tone = "neutral",
  className = "",
}: {
  message?: ReactNode;
  tone?: "neutral" | "success" | "error";
  className?: string;
}) {
  const colour =
    tone === "success" ? "text-ok" : tone === "error" ? "text-alert" : "";
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={`text-sm empty:hidden ${colour} ${className}`}
    >
      {message ? (
        <span className="inline-flex items-start gap-1.5">
          {tone === "success" ? <CheckIcon /> : null}
          <span>{message}</span>
        </span>
      ) : null}
    </p>
  );
}

export function CheckIcon({ className = "mt-[3px] size-3.5" }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className={`shrink-0 ${className}`}
    >
      <path
        d="m3.5 8.5 3 3 6-7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
